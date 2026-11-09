import {
  MEMORY_TEXT_MAX_CHARS,
  MemoryId,
  MemoryScope,
  OrchestratorMcpFailure,
  TrimmedNonEmptyString,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { Tool, Toolkit } from "effect/ai";

import * as MemoryService from "../../../memory/MemoryService.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as ThreadManagementService from "../../../orchestration-v2/ThreadManagementService.ts";

const RecalledMemory = Schema.Struct({
  id: MemoryId,
  scope: MemoryScope,
  text: Schema.String,
  updatedAt: Schema.String,
});

const shared = {
  failure: OrchestratorMcpFailure,
  failureMode: "return" as const,
  dependencies: [
    McpInvocationContext.McpInvocationContext,
    ThreadManagementService.ThreadManagementService,
    MemoryService.MemoryService,
  ],
};

const MemoryRecallTool = Tool.make("t3_memory_recall", {
  ...shared,
  description:
    "Search saved memory: the user's preferences, decisions and facts for all projects, and this project's. Ranked by relevance and recency; may be stale, so verify changeable facts. No match: rephrase before concluding nothing exists.",
  parameters: Schema.Struct({
    query: TrimmedNonEmptyString.annotate({ description: "Natural-language search terms." }),
  }),
  success: Schema.Struct({ memories: Schema.Array(RecalledMemory) }),
})
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false);

const MemoryRememberTool = Tool.make("t3_memory_remember", {
  ...shared,
  description: `Save one lasting preference, decision or fact. \`user\` reaches every project; \`project\` only this one. Saving the same text again updates it. Pass \`memoryId\` to correct an existing memory. Max ${MEMORY_TEXT_MAX_CHARS} characters.`,
  parameters: Schema.Struct({
    text: Schema.String,
    scope: MemoryScope,
    memoryId: Schema.optional(MemoryId),
  }),
  success: Schema.Struct({ memory: RecalledMemory }),
}).annotate(Tool.Destructive, false);

const MemoryForgetTool = Tool.make("t3_memory_forget", {
  ...shared,
  description: "Delete one saved memory by id, from `t3_memory_recall`. Cannot be undone.",
  parameters: Schema.Struct({ memoryId: MemoryId }),
  success: Schema.Struct({ id: MemoryId }),
}).annotate(Tool.Destructive, true);

export const MemoryToolkit = Toolkit.make(MemoryRecallTool, MemoryRememberTool, MemoryForgetTool);
