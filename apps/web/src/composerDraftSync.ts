import {
  type ComposerDraftSyncAdapter,
  type ComposerDraftSyncState,
  type ComposerDraftSyncStorage,
  type ComposerDraftSyncTransport,
  startComposerDraftSync,
} from "@t3tools/client-runtime/composer-draft-sync";
import { parseScopedThreadKey } from "@t3tools/client-runtime/environment";
import { runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import {
  type ComposerDraftContent,
  EnvironmentId,
  type SyncedComposerDraft,
} from "@t3tools/contracts";
import { AsyncResult, Atom, type AtomRegistry } from "effect/reactivity";

import {
  type ComposerThreadDraftState,
  type DraftSessionState,
  useComposerDraftStore,
} from "./composerDraftStore";
import { randomUUID } from "./lib/utils";
import { environmentServerConfigsAtom } from "./state/server";
import { liveShellEnvironmentIdsAtom } from "./state/shell";
import { composerDraftEnvironment } from "./state/composerDrafts";

const SYNC_STATE_STORAGE_KEY = "t3code:composer-draft-sync:v1";

const contentCache = new WeakMap<
  ComposerThreadDraftState,
  { session: DraftSessionState | undefined; content: ComposerDraftContent | null }
>();

/** What of a draft other devices can show: its text, explicit model pick, modes and new-thread session. */
function toContent(
  draft: ComposerThreadDraftState,
  session: DraftSessionState | undefined,
): ComposerDraftContent | null {
  const cached = contentCache.get(draft);
  if (cached !== undefined && cached.session === session) return cached.content;
  const content: ComposerDraftContent | null =
    draft.prompt.trim().length === 0
      ? null
      : {
          prompt: draft.prompt,
          records: [],
          modelSelection:
            draft.modelSelectionExplicit && draft.activeProvider !== null
              ? (draft.modelSelectionByProvider[draft.activeProvider] ?? null)
              : null,
          runtimeMode: draft.runtimeMode,
          interactionMode: draft.interactionMode,
          session:
            session === undefined
              ? null
              : {
                  projectId: session.projectId,
                  threadId: session.threadId,
                  branch: session.branch,
                  worktreePath: session.worktreePath,
                  envMode: session.envMode,
                  startFromOrigin: session.startFromOrigin,
                  createdAt: session.createdAt,
                },
        };
  contentCache.set(draft, { session, content });
  return content;
}

let builtFor: { drafts: unknown; sessions: unknown } | null = null;
let built = new Map<string, Map<string, ComposerDraftContent>>();

/** Every syncable draft by environment, rebuilt only when the store's draft maps change. */
function readAll(): Map<string, Map<string, ComposerDraftContent>> {
  const state = useComposerDraftStore.getState();
  if (
    builtFor !== null &&
    builtFor.drafts === state.draftsByThreadKey &&
    builtFor.sessions === state.draftThreadsByThreadKey
  ) {
    return built;
  }
  const next = new Map<string, Map<string, ComposerDraftContent>>();
  const add = (environmentId: string, key: string, content: ComposerDraftContent | null) => {
    if (content === null) return;
    let byKey = next.get(environmentId);
    if (byKey === undefined) next.set(environmentId, (byKey = new Map()));
    byKey.set(key, content);
  };
  for (const [threadKey, draft] of Object.entries(state.draftsByThreadKey)) {
    const session = state.draftThreadsByThreadKey[threadKey];
    if (session !== undefined) {
      // A draft being sent is the server's now; its tombstone tells the other devices.
      if (session.promotedTo) continue;
      add(session.environmentId, `draft:${threadKey}`, toContent(draft, session));
      continue;
    }
    const ref = parseScopedThreadKey(threadKey);
    if (ref !== null) add(ref.environmentId, `thread:${ref.threadId}`, toContent(draft, undefined));
  }
  builtFor = { drafts: state.draftsByThreadKey, sessions: state.draftThreadsByThreadKey };
  built = next;
  return next;
}

const EMPTY: ReadonlyMap<string, ComposerDraftContent> = new Map();

const adapter: ComposerDraftSyncAdapter = {
  readLocal: (environmentId) => readAll().get(environmentId) ?? EMPTY,
  subscribeLocal: (listener) => useComposerDraftStore.subscribe(listener),
  applyRemote: (environmentId, draft: SyncedComposerDraft) =>
    useComposerDraftStore.getState().applySyncedDraft(EnvironmentId.make(environmentId), draft),
  promotedTo: (_environmentId, key) => {
    const state = useComposerDraftStore.getState();
    const draftId = key.slice(key.indexOf(":") + 1);
    return (
      state.draftThreadsByThreadKey[draftId]?.promotedTo?.threadId ??
      state.promotedDraftRedirects[draftId]?.threadId ??
      null
    );
  },
};

/** Live environments whose server keeps drafts; an older one has no such RPC. */
const syncEnvironmentIdsAtom = Atom.make((get) => {
  const configs = get(environmentServerConfigsAtom);
  return new Set(
    [...get(liveShellEnvironmentIdsAtom)].filter(
      (environmentId) =>
        configs.get(environmentId)?.environment.capabilities.composerDraftSync === true,
    ),
  );
}).pipe(Atom.withLabel("web-composer-draft-sync-environment-ids"));

function makeTransport(registry: AtomRegistry.AtomRegistry): ComposerDraftSyncTransport {
  return {
    watchEnvironments: (onChange) =>
      registry.subscribe(syncEnvironmentIdsAtom, (ids) => onChange(ids), {
        immediate: true,
      }),
    subscribe: (environmentId, onState) =>
      registry.subscribe(
        composerDraftEnvironment.drafts({
          environmentId: EnvironmentId.make(environmentId),
          input: {},
        }),
        (result) => {
          // A server without drafts fails the stream; there is nothing to sync with it.
          if (AsyncResult.isSuccess(result)) onState(result.value);
        },
        { immediate: true },
      ),
    put: async (environmentId, input) => {
      const result = await runAtomCommand(
        registry,
        composerDraftEnvironment.put,
        { environmentId: EnvironmentId.make(environmentId), input },
        { reportFailure: false },
      );
      if (result._tag !== "Success") throw new Error("Drafts could not be saved.");
      return result.value;
    },
  };
}

const storage: ComposerDraftSyncStorage = {
  load: () => {
    try {
      const raw = localStorage.getItem(SYNC_STATE_STORAGE_KEY);
      return raw === null ? {} : (JSON.parse(raw) as ComposerDraftSyncState);
    } catch {
      return {};
    }
  },
  save: (state) => {
    try {
      localStorage.setItem(SYNC_STATE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Sync state is a cache: losing it makes the next run re-put its drafts.
    }
  },
};

/** Keeps this client's composer drafts in step with the ones on each connected environment's server. */
export function startComposerDraftSyncService(registry: AtomRegistry.AtomRegistry): () => void {
  return startComposerDraftSync({
    adapter,
    transport: makeTransport(registry),
    storage,
    clientId: randomUUID(),
    schedule: (run, delayMs) => {
      const timer = setTimeout(run, delayMs);
      return () => clearTimeout(timer);
    },
  });
}
