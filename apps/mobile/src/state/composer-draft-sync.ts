import {
  type ComposerDraftSyncAdapter,
  type ComposerDraftSyncState,
  type ComposerDraftSyncTransport,
  startComposerDraftSync,
} from "@t3tools/client-runtime/composer-draft-sync";
import {
  parseScopedThreadKey,
  scopedThreadKey,
  scopeThreadRef,
} from "@t3tools/client-runtime/environment";
import { enabledEnvironmentIds } from "@t3tools/client-runtime/state/connections";
import { createComposerDraftEnvironmentAtoms } from "@t3tools/client-runtime/state/composer-drafts";
import { runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import { type ComposerDraftContent, EnvironmentId } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";

import {
  composerDraftToSyncContent,
  syncedContentToDraftChange,
} from "./composer-draft-sync-content";
import { environmentCatalog } from "../connection/catalog";
import { connectionAtomRuntime } from "../connection/runtime";
import { writeFileAtomically } from "../lib/atomic-file";
import { SerializedAsyncQueue } from "../lib/serialized-async-queue";
import { uuidv4 } from "../lib/uuid";
import { appAtomRegistry } from "./atom-registry";
import { isNewTaskDraftKey, newTaskDraftKey } from "./new-task-draft-key";
import { isQueuedEditDraftKey } from "./queued-edit-draft-key";
import { environmentServerConfigsAtom } from "./server";
import { environmentShell } from "./shell";
import {
  type ComposerDraft,
  clearComposerDraft,
  composerDraftsAtom,
  getComposerDraftSnapshot,
  setComposerDraftText,
  updateComposerDraftSettings,
  waitForComposerDraftsLoaded,
} from "./use-composer-drafts";

const composerDraftEnvironment = createComposerDraftEnvironmentAtoms(connectionAtomRuntime);

const SYNC_DIRECTORY = "composer-drafts";
const SYNC_FILE = "sync-state.json";

let previousLiveEnvironmentIds: ReadonlySet<EnvironmentId> = new Set();
/** Environments whose threads reflect the server now, not a cache or a resync in flight. */
const liveEnvironmentIdsAtom = Atom.make((get) => {
  const next = new Set<EnvironmentId>();
  for (const environmentId of enabledEnvironmentIds(get(environmentCatalog.catalogValueAtom))) {
    // An older server has no draft RPC.
    if (
      get(environmentShell.statusAtom(environmentId)) === "live" &&
      get(environmentServerConfigsAtom).get(environmentId)?.environment.capabilities
        .composerDraftSync === true
    ) {
      next.add(environmentId);
    }
  }
  if (
    next.size === previousLiveEnvironmentIds.size &&
    [...next].every((environmentId) => previousLiveEnvironmentIds.has(environmentId))
  ) {
    return previousLiveEnvironmentIds;
  }
  previousLiveEnvironmentIds = next;
  return next;
}).pipe(Atom.withLabel("mobile-live-shell-environment-ids"));

let builtFor: Record<string, ComposerDraft> | null = null;
let built = new Map<string, Map<string, ComposerDraftContent>>();

function readAll(): Map<string, Map<string, ComposerDraftContent>> {
  const drafts = appAtomRegistry.get(composerDraftsAtom);
  if (builtFor === drafts) return built;
  const next = new Map<string, Map<string, ComposerDraftContent>>();
  for (const [key, draft] of Object.entries(drafts)) {
    if (isQueuedEditDraftKey(key)) continue;
    const content = composerDraftToSyncContent(key, draft);
    if (content === null) continue;
    let environmentId: string;
    let syncKey: string;
    if (isNewTaskDraftKey(key)) {
      if (draft.project === undefined) continue;
      environmentId = draft.project.environmentId;
      syncKey = `draft:${key.slice(newTaskDraftKey("").length)}`;
    } else {
      const ref = parseScopedThreadKey(key);
      if (ref === null) continue;
      environmentId = ref.environmentId;
      syncKey = `thread:${ref.threadId}`;
    }
    let byKey = next.get(environmentId);
    if (byKey === undefined) next.set(environmentId, (byKey = new Map()));
    byKey.set(syncKey, content);
  }
  builtFor = drafts;
  built = next;
  return next;
}

const EMPTY: ReadonlyMap<string, ComposerDraftContent> = new Map();

function applyRemote(
  environmentId: string,
  synced: Parameters<ComposerDraftSyncAdapter["applyRemote"]>[1],
) {
  const id = synced.key.slice(synced.key.indexOf(":") + 1);
  const isNewTask = synced.key.startsWith("draft:");
  const key = isNewTask
    ? newTaskDraftKey(id)
    : scopedThreadKey(scopeThreadRef(EnvironmentId.make(environmentId), id as never));
  const content = synced.deleted ? null : synced.content;
  const existing = getComposerDraftSnapshot(key);
  if (content === null) {
    // Only the text came from the other device: a draft that still holds attachments stays.
    if (existing.attachments.length === 0) clearComposerDraft(key);
    else setComposerDraftText(key, "");
    return;
  }
  const change = syncedContentToDraftChange(
    existing,
    content,
    isNewTask,
    EnvironmentId.make(environmentId),
  );
  if (change === null) return;
  if (change.text !== null) setComposerDraftText(key, change.text);
  if (Object.keys(change.settings).length > 0) updateComposerDraftSettings(key, change.settings);
}

const adapter: ComposerDraftSyncAdapter = {
  readLocal: (environmentId) => readAll().get(environmentId) ?? EMPTY,
  subscribeLocal: (listener) => appAtomRegistry.subscribe(composerDraftsAtom, () => listener()),
  applyRemote,
};

const transport: ComposerDraftSyncTransport = {
  watchEnvironments: (onChange) =>
    appAtomRegistry.subscribe(liveEnvironmentIdsAtom, (ids) => onChange(ids), {
      immediate: true,
    }),
  subscribe: (environmentId, onState) =>
    appAtomRegistry.subscribe(
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
      appAtomRegistry,
      composerDraftEnvironment.put,
      { environmentId: EnvironmentId.make(environmentId), input },
      { reportFailure: false },
    );
    if (result._tag !== "Success") throw new Error("Drafts could not be saved.");
    return result.value;
  },
};

async function getSyncFile() {
  const { Directory, File, Paths } = await import("expo-file-system");
  const directory = new Directory(Paths.document, SYNC_DIRECTORY);
  directory.create({ idempotent: true, intermediates: true });
  return new File(directory, SYNC_FILE);
}

async function loadSyncState(): Promise<ComposerDraftSyncState> {
  try {
    const file = await getSyncFile();
    return file.exists ? (JSON.parse(await file.text()) as ComposerDraftSyncState) : {};
  } catch {
    return {};
  }
}

const writeQueue = new SerializedAsyncQueue();

/** Keeps the app's composer drafts in step with the ones on each connected environment's server. */
export function installComposerDraftSync(): () => void {
  let stop: (() => void) | null = null;
  let stopped = false;
  // Syncing before the stored drafts load would read them as cleared and delete them everywhere.
  const startWhenReady = async () => {
    await waitForComposerDraftsLoaded();
    const state = await loadSyncState();
    if (stopped) return;
    stop = startComposerDraftSync({
      adapter,
      transport,
      clientId: uuidv4(),
      schedule: (run, delayMs) => {
        const timer = setTimeout(run, delayMs);
        return () => clearTimeout(timer);
      },
      storage: {
        load: () => state,
        save: (next) => {
          void writeQueue
            .run(async () => writeFileAtomically(await getSyncFile(), JSON.stringify(next)))
            .catch(() => undefined);
        },
      },
    });
  };
  void startWhenReady();
  return () => {
    stopped = true;
    stop?.();
  };
}
