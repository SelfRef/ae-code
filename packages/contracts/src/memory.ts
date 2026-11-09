import * as Schema from "effect/Schema";

import { IsoDateTime, ProjectId, ThreadId, TrimmedNonEmptyString } from "./baseSchemas.ts";

export const MemoryId = TrimmedNonEmptyString.pipe(Schema.brand("MemoryId"));
export type MemoryId = typeof MemoryId.Type;

/** `user` reaches every project; `project` only threads of one project. */
export const MemoryScope = Schema.Literals(["user", "project"]);
export type MemoryScope = typeof MemoryScope.Type;

export const MemorySource = Schema.Literals(["user", "agent"]);
export type MemorySource = typeof MemorySource.Type;

export const MEMORY_TEXT_MAX_CHARS = 2000;
export const MEMORY_MAX_COUNT = 2000;

const MemoryText = Schema.String.check(
  Schema.makeFilter((value: string) => value.trim().length > 0, {
    expected: "a non-blank string",
  }),
  Schema.isMaxLength(MEMORY_TEXT_MAX_CHARS),
);

export const Memory = Schema.Struct({
  id: MemoryId,
  scope: MemoryScope,
  projectId: Schema.NullOr(ProjectId),
  text: Schema.String,
  source: MemorySource,
  sourceThreadId: Schema.NullOr(ThreadId),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type Memory = typeof Memory.Type;

export const MemoryListInput = Schema.Struct({
  query: Schema.optional(Schema.String),
  scope: Schema.optional(MemoryScope),
  projectId: Schema.optional(ProjectId),
});
export type MemoryListInput = typeof MemoryListInput.Type;

export const MemorySettings = Schema.Struct({
  /** Off: agents get no memory instructions and the memory tools refuse. Saved memories are kept. */
  enabled: Schema.Boolean,
  /** On while memory is on: new sessions of a provider with its own memory (Claude) run without it. */
  disableNativeMemory: Schema.Boolean,
});
export type MemorySettings = typeof MemorySettings.Type;

export const DEFAULT_MEMORY_SETTINGS: MemorySettings = { enabled: true, disableNativeMemory: true };

export const MemoryListResult = Schema.Struct({
  memories: Schema.Array(Memory),
  settings: MemorySettings,
});
export type MemoryListResult = typeof MemoryListResult.Type;

export const MemorySetSettingsInput = Schema.Struct({
  enabled: Schema.optional(Schema.Boolean),
  disableNativeMemory: Schema.optional(Schema.Boolean),
});
export type MemorySetSettingsInput = typeof MemorySetSettingsInput.Type;

export const MemorySetSettingsResult = Schema.Struct({ settings: MemorySettings });
export type MemorySetSettingsResult = typeof MemorySetSettingsResult.Type;

/** Without `id`, creates; with it, replaces the text of that memory and keeps its scope. */
export const MemorySaveInput = Schema.Struct({
  id: Schema.optional(MemoryId),
  scope: MemoryScope,
  projectId: Schema.optional(ProjectId),
  text: MemoryText,
});
export type MemorySaveInput = typeof MemorySaveInput.Type;

export const MemorySaveResult = Schema.Struct({ memory: Memory });
export type MemorySaveResult = typeof MemorySaveResult.Type;

export const MemoryDeleteInput = Schema.Struct({ id: MemoryId });
export type MemoryDeleteInput = typeof MemoryDeleteInput.Type;

export const MemoryDeleteResult = Schema.Struct({ id: MemoryId });
export type MemoryDeleteResult = typeof MemoryDeleteResult.Type;

export class MemoryError extends Schema.TaggedError<MemoryError>()("MemoryError", {
  code: Schema.Literals(["invalid", "not_found", "limit", "unavailable", "disabled"]),
  message: Schema.String,
}) {}
