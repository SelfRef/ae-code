import type {
  ComposerDraftContent,
  ComposerDraftsPutInput,
  SyncedComposerDraft,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  COMPOSER_DRAFT_PUSH_DEBOUNCE_MS,
  COMPOSER_DRAFT_QUIET_MS,
  type ComposerDraftSyncState,
  reduceComposerDraftEvent,
  startComposerDraftSync,
} from "./composerDraftSync.ts";

const ENV = "env-1";
const content = (prompt: string): ComposerDraftContent => ({
  prompt,
  records: [],
  modelSelection: null,
  runtimeMode: null,
  interactionMode: null,
  session: null,
});

function remote(
  key: string,
  revision: number,
  prompt: string | null,
  by = "other",
): SyncedComposerDraft {
  return {
    key,
    revision,
    updatedAt: "2026-11-11T00:00:00.000Z",
    updatedBy: by,
    deleted: prompt === null,
    promotedTo: null,
    content: prompt === null ? null : content(prompt),
  } as SyncedComposerDraft;
}

function setup(initialState: ComposerDraftSyncState = {}) {
  let clock = 1_000_000;
  const local = new Map<string, ComposerDraftContent>();
  const localListeners = new Set<() => void>();
  const timers: Array<{ run: () => void; at: number; cancelled: boolean }> = [];
  const puts: ComposerDraftsPutInput[] = [];
  let revision = 100;
  let failPuts = false;
  let pushState: ((drafts: Record<string, SyncedComposerDraft>) => void) | null = null;
  let saved: ComposerDraftSyncState = initialState;
  const applied: SyncedComposerDraft[] = [];

  const inflight: Array<Promise<unknown>> = [];
  const settle = async (): Promise<void> => {
    const due = timers
      .filter((timer) => !timer.cancelled && timer.at <= clock)
      .sort((a, b) => a.at - b.at)[0];
    if (due === undefined) return;
    due.cancelled = true;
    due.run();
    await Promise.all(inflight.splice(0));
    return settle();
  };

  const stop = startComposerDraftSync({
    clientId: "me",
    now: () => clock,
    schedule: (run, delayMs) => {
      const timer = { run, at: clock + delayMs, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
    storage: { load: () => saved, save: (state) => (saved = state) },
    adapter: {
      readLocal: () => new Map(local),
      subscribeLocal: (listener) => {
        localListeners.add(listener);
        return () => localListeners.delete(listener);
      },
      applyRemote: (_environmentId, draft) => {
        applied.push(draft);
        if (draft.content === null) local.delete(draft.key);
        else local.set(draft.key, draft.content);
        localListeners.forEach((listener) => listener());
      },
      promotedTo: (_environmentId, key) => (key === "draft:sent" ? "thread-9" : null),
    },
    transport: {
      watchEnvironments: (onChange) => {
        onChange(new Set([ENV]));
        return () => undefined;
      },
      subscribe: (_environmentId, onState) => {
        pushState = onState;
        return () => undefined;
      },
      put: (_environmentId, input) => {
        const result = (async () => {
          if (failPuts) throw new Error("offline");
          puts.push(input);
          return {
            revisions: input.writes.map((write) => ({ key: write.key, revision: ++revision })),
          } as never;
        })();
        inflight.push(result.catch(() => undefined));
        return result;
      },
    },
  });

  return {
    stop,
    local,
    puts,
    applied,
    get saved() {
      return saved;
    },
    edit(key: string, prompt: string | null) {
      if (prompt === null) local.delete(key);
      else local.set(key, content(prompt));
      localListeners.forEach((listener) => listener());
    },
    receive: (drafts: SyncedComposerDraft[]) =>
      pushState!(Object.fromEntries(drafts.map((draft) => [draft.key, draft]))),
    setFail: (value: boolean) => (failPuts = value),
    /** Moves the clock forward and runs every timer that fell due, oldest first. */
    async advance(ms: number) {
      clock += ms;
      await settle();
    },
  };
}

describe("startComposerDraftSync", () => {
  it("pushes never-synced local drafts once the server's state arrived, and batches typing", async () => {
    const sync = setup();
    sync.local.set("thread:a", content("hello"));
    sync.receive([]);
    await sync.advance(COMPOSER_DRAFT_PUSH_DEBOUNCE_MS);
    expect(sync.puts).toHaveLength(1);
    expect(sync.puts[0]!.writes.map((write) => write.key)).toEqual(["thread:a"]);

    sync.edit("thread:a", "hello w");
    sync.edit("thread:a", "hello wo");
    await sync.advance(COMPOSER_DRAFT_PUSH_DEBOUNCE_MS);
    expect(sync.puts).toHaveLength(2);
    expect(sync.puts[1]!.writes[0]).toMatchObject({ deleted: false });
    expect(sync.saved[ENV]?.["thread:a"]?.[0]).toBeGreaterThan(100);
    sync.stop();
  });

  it("writes a tombstone when a synced draft is cleared, naming the thread a sent draft became", async () => {
    const sync = setup();
    sync.local.set("draft:sent", content("x"));
    sync.local.set("thread:b", content("y"));
    sync.receive([]);
    await sync.advance(COMPOSER_DRAFT_PUSH_DEBOUNCE_MS);
    sync.edit("draft:sent", null);
    sync.edit("thread:b", null);
    await sync.advance(COMPOSER_DRAFT_PUSH_DEBOUNCE_MS);
    expect(sync.puts[1]!.writes).toEqual([
      { key: "draft:sent", deleted: true, promotedTo: "thread-9" },
      { key: "thread:b", deleted: true },
    ]);
    sync.stop();
  });

  it("applies a draft from another device to a clean draft, and skips its own echo", async () => {
    const sync = setup();
    sync.receive([remote("thread:a", 5, "from phone")]);
    expect(sync.local.get("thread:a")?.prompt).toBe("from phone");
    await sync.advance(COMPOSER_DRAFT_PUSH_DEBOUNCE_MS);
    expect(sync.puts).toHaveLength(0);

    sync.receive([remote("thread:a", 6, "mine", "me")]);
    expect(sync.applied).toHaveLength(1);
    sync.receive([remote("thread:a", 7, null)]);
    expect(sync.local.has("thread:a")).toBe(false);
    sync.stop();
  });

  it("keeps the typing device's text, then takes a newer remote one once it goes quiet", async () => {
    const sync = setup();
    sync.receive([remote("thread:a", 5, "old")]);
    sync.edit("thread:a", "typing here");
    sync.receive([remote("thread:a", 6, "typed elsewhere")]);
    expect(sync.local.get("thread:a")?.prompt).toBe("typing here");

    // The push lands first (revision 101), so the remote 6 is stale and dropped.
    await sync.advance(COMPOSER_DRAFT_PUSH_DEBOUNCE_MS);
    await sync.advance(COMPOSER_DRAFT_QUIET_MS);
    expect(sync.local.get("thread:a")?.prompt).toBe("typing here");

    // A remote edit the server ordered after ours waits for the pause, then wins.
    sync.edit("thread:a", "typing more");
    sync.receive([remote("thread:a", 500, "later elsewhere")]);
    expect(sync.local.get("thread:a")?.prompt).toBe("typing more");
    await sync.advance(COMPOSER_DRAFT_QUIET_MS);
    expect(sync.local.get("thread:a")?.prompt).toBe("later elsewhere");
    sync.stop();
  });

  it("retries a failed push without losing the draft", async () => {
    const sync = setup();
    sync.receive([]);
    sync.setFail(true);
    sync.edit("thread:a", "offline text");
    await sync.advance(COMPOSER_DRAFT_PUSH_DEBOUNCE_MS);
    expect(sync.puts).toHaveLength(0);
    sync.setFail(false);
    await sync.advance(10_000);
    expect(sync.puts[0]!.writes[0]).toMatchObject({ key: "thread:a" });
    sync.stop();
  });
});

describe("reduceComposerDraftEvent", () => {
  it("replaces on a snapshot and keeps the newest revision on an upsert", () => {
    const first = reduceComposerDraftEvent(
      {},
      { type: "snapshot", drafts: [remote("thread:a", 2, "a")] },
    );
    const merged = reduceComposerDraftEvent(first, {
      type: "upsert",
      drafts: [remote("thread:a", 1, "stale"), remote("thread:b", 3, "b")],
    });
    expect(Object.keys(merged)).toEqual(["thread:a", "thread:b"]);
    expect(merged["thread:a"]?.content?.prompt).toBe("a");
    expect(Object.keys(reduceComposerDraftEvent(merged, { type: "snapshot", drafts: [] }))).toEqual(
      [],
    );
  });
});
