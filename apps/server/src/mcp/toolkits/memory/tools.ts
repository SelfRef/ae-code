import {
  EnvironmentId,
  MEMORY_TEXT_MAX_CHARS,
  MemoryId,
  MemoryScope,
  MemorySyncRecord,
  OrchestratorMcpFailure,
  TrimmedNonEmptyString,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { McpSchema, Tool, Toolkit } from "effect/ai";

import * as MemoryService from "../../../memory/MemoryService.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as ThreadManagementService from "../../../orchestration-v2/ThreadManagementService.ts";
import * as ServerEnvironment from "../../../environment/ServerEnvironment.ts";

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
    "Search saved memory: the user's preferences, decisions and facts for all projects, this environment and this project. Ranked by relevance and recency; may be stale, so verify changeable facts. No match: rephrase before concluding nothing exists.",
  parameters: Schema.Struct({
    query: TrimmedNonEmptyString.annotate({ description: "Natural-language search terms." }),
  }),
  success: Schema.Struct({ memories: Schema.Array(RecalledMemory) }),
})
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  // Claude Code defers MCP tools behind ToolSearch; an agent that has to search for these first skips them.
  .annotate(Tool.Meta, { "anthropic/alwaysLoad": true });

const MemoryRememberTool = Tool.make("t3_memory_remember", {
  ...shared,
  description: `Save one lasting preference, decision or fact. \`user\` reaches every project on every linked machine; \`environment\` every project on this machine only; \`project\` only this project. Saving the same text again updates it. Pass \`memoryId\` to correct an existing memory (its scope stays). Max ${MEMORY_TEXT_MAX_CHARS} characters.`,
  parameters: Schema.Struct({
    text: Schema.String,
    scope: MemoryScope,
    memoryId: Schema.optional(MemoryId),
  }),
  success: Schema.Struct({ memory: RecalledMemory }),
})
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Meta, { "anthropic/alwaysLoad": true });

const MemoryForgetTool = Tool.make("t3_memory_forget", {
  ...shared,
  description: "Delete one saved memory by id, from `t3_memory_recall`. Cannot be undone.",
  parameters: Schema.Struct({ memoryId: MemoryId }),
  success: Schema.Struct({ id: MemoryId }),
}).annotate(Tool.Destructive, true);

/** Hidden from agents: another environment's peer link calls it to exchange memory changes. */
const MemorySyncTool = Tool.make("t3_memory_sync", {
  failure: OrchestratorMcpFailure,
  failureMode: "return" as const,
  dependencies: [
    McpInvocationContext.McpInvocationContext,
    ThreadManagementService.ThreadManagementService,
    MemoryService.MemoryService,
    ServerEnvironment.ServerEnvironment,
  ],
  description: "Exchange saved-memory changes with a linked environment.",
  parameters: Schema.Struct({
    from: EnvironmentId,
    label: Schema.String,
    since: Schema.Int,
    changes: Schema.Array(MemorySyncRecord),
  }),
  success: Schema.Struct({
    changes: Schema.Array(MemorySyncRecord),
    rev: Schema.Int,
  }),
})
  .annotate(Tool.Destructive, false)
  .annotate(McpSchema.EnabledWhen, McpInvocationContext.onlyForPeerLinks);

export const MEMORY_SYNC_PAGE = 200;

export const MemoryToolkit = Toolkit.make(
  MemoryRecallTool,
  MemoryRememberTool,
  MemoryForgetTool,
  MemorySyncTool,
);
