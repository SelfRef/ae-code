import { OrchestratorMcpFailure, type Memory, type MemoryError } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import * as MemoryService from "../../../memory/MemoryService.ts";
import * as McpToolAccess from "../../McpToolAccess.ts";
import { readCaller } from "../../threadAccess.ts";
import { MemoryToolkit } from "./tools.ts";

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
      const saved = yield* memory
        .save({
          id: input.memoryId,
          scope: input.scope,
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
      return yield* memory.remove(memoryId).pipe(Effect.mapError(failure));
    }),
  ),
});
