import {
  type EnvironmentId,
  MemorySyncRecord,
  type PeerLinkSummary,
  repositoryGroupingDisplayNameOf,
  repositoryGroupingKeyOf,
} from "@t3tools/contracts";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import * as ServerEnvironment from "../environment/ServerEnvironment.ts";
import { MEMORY_SYNC_PAGE } from "../mcp/toolkits/memory/tools.ts";
import * as PeerLinks from "../peer/PeerLinks.ts";
import * as PeerMcpClient from "../peer/PeerMcpClient.ts";
import * as ProjectService from "../project/ProjectService.ts";
import * as MemoryService from "./MemoryService.ts";

const SYNC_INTERVAL = Duration.minutes(5);
// Lets a burst of saves go out in one exchange.
const SYNC_DEBOUNCE = Duration.seconds(3);
const PROJECT_KEYS_INTERVAL = Duration.minutes(1);
// One exchange moves at most this many pages each way, so a huge backlog cannot hold the loop.
const MAX_PAGES = 20;

const SyncResult = Schema.Struct({
  changes: Schema.Array(MemorySyncRecord),
  rev: Schema.Int,
});

/** Keeps each project's memory key current, and syncs memory over every full-access peer link from here. */
const make = Effect.gen(function* () {
  const memory = yield* MemoryService.MemoryService;
  const projects = yield* ProjectService.ProjectService;
  const links = yield* PeerLinks.PeerLinks;
  const peers = yield* PeerMcpClient.PeerMcpClient;
  const environment = yield* ServerEnvironment.ServerEnvironment;

  const refreshProjectKeys = projects.listShells().pipe(
    Effect.flatMap((shells) =>
      memory.setProjectKeys(
        shells.map((shell) => ({
          projectId: shell.id,
          key:
            shell.repositoryIdentity == null
              ? `local:${shell.id}`
              : repositoryGroupingKeyOf(shell.repositoryIdentity),
          label:
            (shell.repositoryIdentity == null
              ? undefined
              : repositoryGroupingDisplayNameOf(shell.repositoryIdentity)) ?? shell.title,
        })),
      ),
    ),
    Effect.catchCause((cause) => Effect.logWarning("memory project keys not refreshed", cause)),
  );

  const syncLink = Effect.fn("MemorySync.syncLink")(function* (
    link: PeerLinkSummary,
    here: EnvironmentId,
    hereLabel: string,
  ) {
    let cursor = yield* memory.peerCursor(link.environmentId);
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const outgoing = yield* memory.changesSince(cursor.pushRev, MEMORY_SYNC_PAGE, here);
      const answer = yield* peers.call({
        environmentId: link.environmentId,
        tool: "t3_memory_sync",
        arguments: {
          from: here,
          label: hereLabel,
          since: cursor.pullRev,
          changes: outgoing.records,
        },
        limits: { runtimeMode: "full-access", interactionMode: "default" },
        success: SyncResult,
      });
      yield* memory.merge(answer.changes, here);
      cursor = { pullRev: answer.rev, pushRev: outgoing.rev };
      if (outgoing.records.length < MEMORY_SYNC_PAGE && answer.changes.length < MEMORY_SYNC_PAGE)
        break;
    }
    return cursor;
  });

  const syncAll = Effect.gen(function* () {
    const settings = yield* memory.settings;
    if (!settings.sync || !(yield* links.enabled)) return;
    const descriptor = yield* environment.getDescriptor;
    const linked = yield* links.list;
    yield* memory.forgetLinksExcept(linked.map((link) => link.environmentId));
    yield* Effect.forEach(
      linked,
      (link) =>
        link.access !== "full-access"
          ? memory.recordPeer(link.environmentId, {
              label: link.label,
              cursor: { pullRev: 0, pushRev: 0 },
              error: "Memory syncs only over a full-access link.",
            })
          : syncLink(link, descriptor.environmentId, descriptor.label).pipe(
              Effect.matchEffect({
                onSuccess: (cursor) =>
                  memory.recordPeer(link.environmentId, { label: link.label, cursor, error: null }),
                onFailure: (error) =>
                  memory.peerCursor(link.environmentId).pipe(
                    Effect.flatMap((cursor) =>
                      memory.recordPeer(link.environmentId, {
                        label: link.label,
                        cursor,
                        error: error.message,
                      }),
                    ),
                  ),
              }),
            ),
      { concurrency: 4, discard: true },
    );
  }).pipe(Effect.catchCause((cause) => Effect.logWarning("memory sync failed", cause)));

  yield* refreshProjectKeys.pipe(
    Effect.andThen(Effect.sleep(PROJECT_KEYS_INTERVAL)),
    Effect.forever,
    Effect.forkScoped,
  );
  yield* syncAll.pipe(
    Effect.andThen(
      memory.awaitChange.pipe(
        Effect.andThen(Effect.sleep(SYNC_DEBOUNCE)),
        Effect.timeoutOrElse({ duration: SYNC_INTERVAL, orElse: () => Effect.void }),
      ),
    ),
    Effect.forever,
    Effect.forkScoped,
  );
});

export const layer = Layer.effectDiscard(make);
