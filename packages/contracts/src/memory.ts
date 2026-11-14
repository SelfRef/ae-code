import * as Schema from "effect/Schema";

import {
  EnvironmentId,
  IsoDateTime,
  ProjectId,
  ThreadId,
  TrimmedNonEmptyString,
} from "./baseSchemas.ts";

export const MemoryId = TrimmedNonEmptyString.pipe(Schema.brand("MemoryId"));
export type MemoryId = typeof MemoryId.Type;

/**
 * `user` reaches every project of every linked environment; `environment` every project of this
 * one only; `project` threads of one project (in every environment that has its repository).
 */
export const MemoryScope = Schema.Literals(["user", "environment", "project"]);
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
  /** A project here whose key matches; null for other scopes or a project this environment lacks. */
  projectId: Schema.NullOr(ProjectId),
  /** The repository's grouping key, or `local:<projectId>` for a project without a remote (never synced). */
  projectKey: Schema.NullOr(Schema.String),
  projectLabel: Schema.NullOr(Schema.String),
  /** The environment that saved it; null for this one. */
  originEnvironmentId: Schema.NullOr(EnvironmentId),
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
  /** Global and project memories sync with linked environments over full-access links. */
  sync: Schema.Boolean,
});
export type MemorySettings = typeof MemorySettings.Type;

export const DEFAULT_MEMORY_SETTINGS: MemorySettings = {
  enabled: true,
  disableNativeMemory: true,
  sync: true,
};

/** One environment this one syncs memory with, by a link from either side. */
export const MemorySyncPeer = Schema.Struct({
  environmentId: EnvironmentId,
  label: Schema.String,
  lastSyncedAt: Schema.NullOr(IsoDateTime),
  lastError: Schema.NullOr(Schema.String),
});
export type MemorySyncPeer = typeof MemorySyncPeer.Type;

export const MemoryListResult = Schema.Struct({
  memories: Schema.Array(Memory),
  settings: MemorySettings,
  peers: Schema.Array(MemorySyncPeer),
});
export type MemoryListResult = typeof MemoryListResult.Type;

export const MemorySetSettingsInput = Schema.Struct({
  enabled: Schema.optional(Schema.Boolean),
  disableNativeMemory: Schema.optional(Schema.Boolean),
  sync: Schema.optional(Schema.Boolean),
});
export type MemorySetSettingsInput = typeof MemorySetSettingsInput.Type;

export const MemorySetSettingsResult = Schema.Struct({ settings: MemorySettings });
export type MemorySetSettingsResult = typeof MemorySetSettingsResult.Type;

/** Without `id`, creates; with it, replaces the text of that memory and moves it to `scope`. */
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

/** `path` is the folder that holds one directory per project, as Claude Code keeps them: `~/.claude/projects`. */
export const MemoryImportScanInput = Schema.Struct({ path: Schema.optional(Schema.String) });
export type MemoryImportScanInput = typeof MemoryImportScanInput.Type;

export const MemoryImportEntry = Schema.Struct({
  file: Schema.String,
  name: Schema.String,
  /** Claude's own kind: user, feedback, project or reference. */
  kind: Schema.NullOr(Schema.String),
  /** What would be saved: the description, then the body. */
  text: Schema.String,
});
export type MemoryImportEntry = typeof MemoryImportEntry.Type;

export const MemoryImportGroup = Schema.Struct({
  /** The directory's name, the project's path with its separators turned into dashes. */
  directory: Schema.String,
  entries: Schema.Array(MemoryImportEntry),
});
export type MemoryImportGroup = typeof MemoryImportGroup.Type;

export const MemoryImportScanResult = Schema.Struct({
  path: Schema.String,
  groups: Schema.Array(MemoryImportGroup),
});
export type MemoryImportScanResult = typeof MemoryImportScanResult.Type;

/** What one environment sends another; `environment` scope and `local:` project keys never leave. */
export const MemorySyncRecord = Schema.Struct({
  id: MemoryId,
  scope: Schema.Literals(["user", "project"]),
  projectKey: Schema.NullOr(Schema.String),
  projectLabel: Schema.NullOr(Schema.String),
  originEnvironmentId: EnvironmentId,
  text: Schema.String,
  source: MemorySource,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  deletedAt: Schema.NullOr(IsoDateTime),
});
export type MemorySyncRecord = typeof MemorySyncRecord.Type;

export class MemoryError extends Schema.TaggedError<MemoryError>()("MemoryError", {
  code: Schema.Literals(["invalid", "not_found", "limit", "unavailable", "disabled"]),
  message: Schema.String,
}) {}
