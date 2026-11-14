import { OrchestratorMcpFailure, type Memory, type MemoryError } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import * as ServerEnvironment from "../../../environment/ServerEnvironment.ts";
import * as MemoryService from "../../../memory/MemoryService.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as McpToolAccess from "../../McpToolAccess.ts";
import { readCaller } from "../../threadAccess.ts";
import { MEMORY_SYNC_PAGE, MemoryToolkit } from "./tools.ts";

const RECALL_LIMIT = 10;

const failure = (error: MemoryError) =>
  new OrchestratorMcpFailure({
    code: error.code === "unavailable" ? "orchestration_error" : "invalid_request",
    message: error.message,
  });

const present = ({ id, scope, text, updatedAt }: Memory) => ({ id, scope, text, updatedAt });

export const layer = McpToolAccess.toLayer(MemoryToolkit, {
  t3_memory_recall: McpToolAccess.readsAsCaller(({ query }) =>
    Effect.gen(function* () {
      const { caller } = yield* readCaller();
      const memory = yield* MemoryService.MemoryService;
      yield* memory.requireEnabled.pipe(Effect.mapError(failure));
      const found = yield* memory
        .recall({ query, projectId: caller?.projectId, limit: RECALL_LIMIT })
        .pipe(Effect.mapError(failure));
      return { memories: found.map(present) };
    }),
  ),
  t3_memory_remember: McpToolAccess.actsAsCaller((input) =>
    Effect.gen(function* () {
      const { caller } = yield* readCaller();
      const memory = yield* MemoryService.MemoryService;
      yield* memory.requireEnabled.pipe(Effect.mapError(failure));
      const saved = yield* memory
        .save({
          id: input.memoryId,
          // A correction keeps the memory where it is; moving one is the user's call in Settings.
          scope: input.memoryId === undefined ? input.scope : undefined,
          projectId: input.scope === "project" ? caller?.projectId : undefined,
          text: input.text,
          source: "agent",
          sourceThreadId: caller?.id,
        })
        .pipe(Effect.mapError(failure));
      return { memory: present(saved) };
    }),
  ),
  t3_memory_forget: McpToolAccess.actsAsCaller(({ memoryId }) =>
    Effect.gen(function* () {
      const memory = yield* MemoryService.MemoryService;
      yield* memory.requireEnabled.pipe(Effect.mapError(failure));
      return yield* memory.remove(memoryId).pipe(Effect.mapError(failure));
    }),
  ),
  t3_memory_sync: McpToolAccess.writes(
    ({ from, label, since, changes }) =>
      Effect.gen(function* () {
        const scope = yield* McpInvocationContext.McpInvocationContext;
        if (scope.client?.linked !== true || scope.client.access !== "full-access")
          return yield* new OrchestratorMcpFailure({
            code: "capability_denied",
            message: "Memory syncs only over a full-access link.",
          });
        const memory = yield* MemoryService.MemoryService;
        const settings = yield* memory.settings.pipe(Effect.mapError(failure));
        if (!settings.sync)
          return yield* new OrchestratorMcpFailure({
            code: "capability_denied",
            message: "Memory sync is turned off on the linked environment.",
          });
        const here = yield* (yield* ServerEnvironment.ServerEnvironment).getEnvironmentId;
        // Read before merging, so the caller's own changes do not come straight back.
        const outgoing = yield* memory
          .changesSince(since, MEMORY_SYNC_PAGE, here)
          .pipe(Effect.mapError(failure));
        yield* memory
          .merge(changes.slice(0, MEMORY_SYNC_PAGE), here)
          .pipe(Effect.mapError(failure));
        yield* memory.recordPeer(from, { label, error: null });
        return { changes: outgoing.records, rev: outgoing.rev };
      }),
    { linkedCallers: "allowed" },
  ),
});
