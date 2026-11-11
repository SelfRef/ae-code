import type {
  ComposerDraftContent,
  ComposerDraftsStreamEvent,
  ComposerDraftsPutInput,
  ComposerDraftsPutResult,
  SyncedComposerDraft,
} from "@t3tools/contracts";

/** Pushes wait for the typing to pause; a received draft waits this long after the last local edit. */
export const COMPOSER_DRAFT_PUSH_DEBOUNCE_MS = 600;
export const COMPOSER_DRAFT_QUIET_MS = 5_000;
const PUSH_RETRY_MS = 10_000;
const PUT_BATCH = 32;

export interface ComposerDraftSyncAdapter {
  /** What this client holds for an environment, by key. A draft with nothing to sync is absent. */
  readonly readLocal: (environmentId: string) => ReadonlyMap<string, ComposerDraftContent>;
  /** Fires after any local change, including the ones `applyRemote` makes. */
  readonly subscribeLocal: (listener: () => void) => () => void;
  /** Puts a received draft (or tombstone, `draft.deleted`) into the local store. */
  readonly applyRemote: (environmentId: string, draft: SyncedComposerDraft) => void;
  /** The thread a new-thread draft became when it was sent, if this client sent it. */
  readonly promotedTo?: (environmentId: string, key: string) => string | null;
}

export interface ComposerDraftSyncTransport {
  /** Live environments; called again whenever the set changes. */
  readonly watchEnvironments: (
    onChange: (environmentIds: ReadonlySet<string>) => void,
  ) => () => void;
  /** Every draft the environment's server holds, again after each change and each reconnect. */
  readonly subscribe: (
    environmentId: string,
    onState: (drafts: Readonly<Record<string, SyncedComposerDraft>>) => void,
  ) => () => void;
  readonly put: (
    environmentId: string,
    input: ComposerDraftsPutInput,
  ) => Promise<ComposerDraftsPutResult>;
}

/** What a client remembers per draft: the revision it last saw and a hash of the content it last synced. */
export type ComposerDraftSyncState = Record<
  string,
  Record<string, readonly [number, string | null]>
>;

export interface ComposerDraftSyncStorage {
  readonly load: () => ComposerDraftSyncState;
  readonly save: (state: ComposerDraftSyncState) => void;
}

export interface ComposerDraftSyncOptions {
  readonly adapter: ComposerDraftSyncAdapter;
  readonly transport: ComposerDraftSyncTransport;
  readonly storage: ComposerDraftSyncStorage;
  /** Names this client so it skips the echo of its own writes. */
  readonly clientId: string;
  readonly now?: () => number;
  /** Runs `run` after `delayMs`; returns a canceller. */
  readonly schedule: (run: () => void, delayMs: number) => () => void;
}

type Entry = readonly [revision: number, hash: string | null];

interface EnvironmentRuntime {
  readonly entries: Map<string, Entry>;
  /** Hash of each draft as last seen locally, to tell an edit from a received change. */
  readonly seen: Map<string, string>;
  readonly editedAt: Map<string, number>;
  readonly parked: Map<string, SyncedComposerDraft>;
  unsubscribe: () => void;
  hasState: boolean;
  pushing: boolean;
  cancelPush: (() => void) | null;
  cancelRecheck: (() => void) | null;
}

// cyrb53: a short, well spread non-cryptographic hash; collisions only delay one push.
function hashString(value: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function startComposerDraftSync(options: ComposerDraftSyncOptions): () => void {
  const { adapter, transport, storage, clientId } = options;
  const now = options.now ?? Date.now;
  const schedule = options.schedule;

  const persisted = storage.load();
  const environments = new Map<string, EnvironmentRuntime>();
  const hashes = new WeakMap<object, string>();
  let applying = false;

  const hashOf = (content: ComposerDraftContent | undefined): string | null => {
    if (content === undefined) return null;
    let hash = hashes.get(content);
    if (hash === undefined) {
      hash = hashString(JSON.stringify(content));
      hashes.set(content, hash);
    }
    return hash;
  };

  const save = () => {
    const state: ComposerDraftSyncState = {};
    for (const [environmentId, runtime] of environments) {
      state[environmentId] = Object.fromEntries(runtime.entries);
    }
    // Environments that are offline right now keep what they had.
    storage.save({ ...persisted, ...state });
  };

  const isDirty = (
    runtime: EnvironmentRuntime,
    key: string,
    local: ReadonlyMap<string, ComposerDraftContent>,
  ) => hashOf(local.get(key)) !== (runtime.entries.get(key)?.[1] ?? null);

  const anyDirty = (
    runtime: EnvironmentRuntime,
    local: ReadonlyMap<string, ComposerDraftContent>,
  ) => {
    for (const key of local.keys()) if (isDirty(runtime, key, local)) return true;
    for (const key of runtime.entries.keys()) if (isDirty(runtime, key, local)) return true;
    return false;
  };

  /** Marks local edits as they happen, so a received change can wait out a person who is typing. */
  const observe = (environmentId: string, runtime: EnvironmentRuntime) => {
    const local = adapter.readLocal(environmentId);
    const stamp = now();
    for (const [key, content] of local) {
      const hash = hashOf(content)!;
      if (runtime.seen.get(key) !== hash) {
        runtime.seen.set(key, hash);
        runtime.editedAt.set(key, stamp);
      }
    }
    for (const key of runtime.seen.keys()) {
      if (!local.has(key)) {
        runtime.seen.delete(key);
        runtime.editedAt.set(key, stamp);
      }
    }
    return local;
  };

  const scheduleRecheck = (environmentId: string, runtime: EnvironmentRuntime) => {
    runtime.cancelRecheck?.();
    runtime.cancelRecheck = schedule(() => {
      runtime.cancelRecheck = null;
      reprocessParked(environmentId, runtime);
    }, COMPOSER_DRAFT_QUIET_MS);
  };

  const decide = (
    environmentId: string,
    runtime: EnvironmentRuntime,
    draft: SyncedComposerDraft,
  ) => {
    const local = adapter.readLocal(environmentId);
    const recentlyEdited =
      now() - (runtime.editedAt.get(draft.key) ?? -Infinity) < COMPOSER_DRAFT_QUIET_MS;
    if (isDirty(runtime, draft.key, local) || recentlyEdited) {
      runtime.parked.set(draft.key, draft);
      scheduleRecheck(environmentId, runtime);
      return;
    }
    runtime.parked.delete(draft.key);
    applying = true;
    try {
      adapter.applyRemote(environmentId, draft);
    } finally {
      applying = false;
    }
    const after = hashOf(adapter.readLocal(environmentId).get(draft.key));
    runtime.entries.set(draft.key, [draft.revision, after]);
    if (after === null) runtime.seen.delete(draft.key);
    else runtime.seen.set(draft.key, after);
  };

  const reprocessParked = (environmentId: string, runtime: EnvironmentRuntime) => {
    for (const draft of runtime.parked.values()) {
      if (draft.revision <= (runtime.entries.get(draft.key)?.[0] ?? -1)) {
        runtime.parked.delete(draft.key);
      } else {
        decide(environmentId, runtime, draft);
      }
    }
    save();
  };

  const push = async (environmentId: string, runtime: EnvironmentRuntime) => {
    if (runtime.pushing || !runtime.hasState) return;
    runtime.pushing = true;
    try {
      const local = adapter.readLocal(environmentId);
      const writes: Array<{
        write: ComposerDraftsPutInput["writes"][number];
        hash: string | null;
      }> = [];
      const keys = new Set([...local.keys(), ...runtime.entries.keys()]);
      for (const key of keys) {
        const content = local.get(key);
        const hash = hashOf(content);
        if (hash === (runtime.entries.get(key)?.[1] ?? null)) continue;
        if (content !== undefined) {
          writes.push({ write: { key, deleted: false, content } as never, hash });
        } else {
          const promotedTo = adapter.promotedTo?.(environmentId, key) ?? null;
          writes.push({
            write: { key, deleted: true, ...(promotedTo === null ? {} : { promotedTo }) } as never,
            hash,
          });
        }
      }
      for (let start = 0; start < writes.length; start += PUT_BATCH) {
        const batch = writes.slice(start, start + PUT_BATCH);
        const result = await transport.put(environmentId, {
          clientId,
          writes: batch.map((entry) => entry.write),
        });
        for (const { key, revision } of result.revisions) {
          const sent = batch.find((entry) => entry.write.key === key);
          if (sent !== undefined) runtime.entries.set(key, [revision, sent.hash]);
        }
        save();
      }
      reprocessParked(environmentId, runtime);
    } catch {
      runtime.cancelPush?.();
      runtime.cancelPush = schedule(() => {
        runtime.cancelPush = null;
        void push(environmentId, runtime);
      }, PUSH_RETRY_MS);
    } finally {
      runtime.pushing = false;
    }
    // Typing during a push left more to send.
    if (runtime.cancelPush === null) {
      const again = adapter.readLocal(environmentId);
      if (anyDirty(runtime, again)) schedulePush(environmentId, runtime);
    }
  };

  const schedulePush = (environmentId: string, runtime: EnvironmentRuntime) => {
    runtime.cancelPush?.();
    runtime.cancelPush = schedule(() => {
      runtime.cancelPush = null;
      void push(environmentId, runtime);
    }, COMPOSER_DRAFT_PUSH_DEBOUNCE_MS);
  };

  const onRemoteState = (
    environmentId: string,
    runtime: EnvironmentRuntime,
    drafts: Readonly<Record<string, SyncedComposerDraft>>,
  ) => {
    observe(environmentId, runtime);
    for (const draft of Object.values(drafts)) {
      // Our own echo is already reflected locally.
      if (draft.updatedBy === clientId) continue;
      if (draft.revision <= (runtime.entries.get(draft.key)?.[0] ?? -1)) continue;
      decide(environmentId, runtime, draft);
    }
    runtime.hasState = true;
    save();
    schedulePush(environmentId, runtime);
  };

  const connect = (environmentId: string) => {
    const entries = new Map<string, Entry>(
      Object.entries(persisted[environmentId] ?? {}).map(([key, entry]) => [key, entry as Entry]),
    );
    const runtime: EnvironmentRuntime = {
      entries,
      seen: new Map(),
      editedAt: new Map(),
      parked: new Map(),
      unsubscribe: () => undefined,
      hasState: false,
      pushing: false,
      cancelPush: null,
      cancelRecheck: null,
    };
    // What is already on screen is not an edit.
    for (const [key, content] of adapter.readLocal(environmentId))
      runtime.seen.set(key, hashOf(content)!);
    environments.set(environmentId, runtime);
    runtime.unsubscribe = transport.subscribe(environmentId, (drafts) =>
      onRemoteState(environmentId, runtime, drafts),
    );
  };

  const disconnect = (environmentId: string) => {
    const runtime = environments.get(environmentId);
    if (runtime === undefined) return;
    save();
    runtime.unsubscribe();
    runtime.cancelPush?.();
    runtime.cancelRecheck?.();
    environments.delete(environmentId);
  };

  const stopWatching = transport.watchEnvironments((ids) => {
    for (const environmentId of environments.keys()) {
      if (!ids.has(environmentId)) disconnect(environmentId);
    }
    for (const environmentId of ids) {
      if (!environments.has(environmentId)) connect(environmentId);
    }
  });

  const stopLocal = adapter.subscribeLocal(() => {
    if (applying) return;
    for (const [environmentId, runtime] of environments) {
      const local = observe(environmentId, runtime);
      if (runtime.hasState && anyDirty(runtime, local)) schedulePush(environmentId, runtime);
    }
  });

  return () => {
    stopLocal();
    stopWatching();
    for (const environmentId of environments.keys()) disconnect(environmentId);
  };
}

export type DraftsByKey = Readonly<Record<string, SyncedComposerDraft>>;

/** Folds the stream into every draft the server holds: a snapshot replaces, an upsert merges. */
export function reduceComposerDraftEvent(
  current: DraftsByKey,
  event: ComposerDraftsStreamEvent,
): DraftsByKey {
  const next: Record<string, SyncedComposerDraft> = event.type === "snapshot" ? {} : { ...current };
  for (const draft of event.drafts) {
    const existing = next[draft.key];
    if (existing === undefined || existing.revision < draft.revision) next[draft.key] = draft;
  }
  return next;
}
