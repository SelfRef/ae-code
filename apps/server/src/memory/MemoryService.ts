import {
  DEFAULT_MEMORY_SETTINGS,
  MEMORY_MAX_COUNT,
  MEMORY_TEXT_MAX_CHARS,
  Memory,
  MemoryError,
  MemoryId,
  type MemoryDeleteResult,
  type MemoryListInput,
  type MemoryListResult,
  type MemorySaveInput,
  type MemorySetSettingsInput,
  type MemorySettings,
  type MemorySource,
  type ProjectId,
  type ThreadId,
} from "@t3tools/contracts";
import { setMemoryPolicy } from "@t3tools/provider-core/server/memoryPolicy";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as SqlClient from "effect/sql/SqlClient";

import { rankMemories } from "./memoryRanking.ts";

export interface MemorySaveRequest extends MemorySaveInput {
  readonly source: MemorySource;
  readonly sourceThreadId?: ThreadId | undefined;
}

export interface MemoryRecallRequest {
  readonly query: string;
  /** The caller's project; its project memories are visible next to the user's. */
  readonly projectId?: ProjectId | undefined;
  readonly limit: number;
}

export class MemoryService extends Context.Service<
  MemoryService,
  {
    readonly list: (input: MemoryListInput) => Effect.Effect<MemoryListResult, MemoryError>;
    readonly recall: (
      input: MemoryRecallRequest,
    ) => Effect.Effect<ReadonlyArray<Memory>, MemoryError>;
    readonly save: (input: MemorySaveRequest) => Effect.Effect<Memory, MemoryError>;
    readonly remove: (id: MemoryId) => Effect.Effect<MemoryDeleteResult, MemoryError>;
    readonly setSettings: (
      patch: MemorySetSettingsInput,
    ) => Effect.Effect<MemorySettings, MemoryError>;
    /** What the MCP tools check first: fails with `disabled` while memory is turned off. */
    readonly requireEnabled: Effect.Effect<void, MemoryError>;
  }
>()("t3/memory/MemoryService") {}

interface MemoryRow {
  readonly id: string;
  readonly scope: string;
  readonly project_id: string | null;
  readonly text: string;
  readonly source: string;
  readonly source_thread_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

const decodeMemory = Schema.decodeUnknownSync(Memory);

const toMemory = (row: MemoryRow): Memory =>
  decodeMemory({
    id: row.id,
    scope: row.scope,
    projectId: row.project_id,
    text: row.text,
    source: row.source,
    sourceThreadId: row.source_thread_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

const unavailable = () =>
  new MemoryError({ code: "unavailable", message: "Memory could not be read or saved." });

const invalid = (message: string) => new MemoryError({ code: "invalid", message });

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const random = yield* SecureRandom.SecureRandom;

  // Created here, not by a numbered migration, so upstream migrations can never claim the same id.
  yield* sql`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL CHECK (scope IN ('user', 'project')),
      project_id TEXT,
      text TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('user', 'agent')),
      source_thread_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK ((scope = 'project') = (project_id IS NOT NULL))
    ) WITHOUT ROWID
  `;
  yield* sql`
    CREATE INDEX IF NOT EXISTS memories_by_scope ON memories (scope, project_id, updated_at DESC)
  `;
  yield* sql`
    CREATE TABLE IF NOT EXISTS memory_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL,
      disable_native INTEGER NOT NULL
    )
  `;

  const readSettings = sql<{ readonly enabled: number; readonly disable_native: number }>`
    SELECT enabled, disable_native FROM memory_settings WHERE id = 1
  `.pipe(
    Effect.map((rows): MemorySettings =>
      rows[0] === undefined
        ? DEFAULT_MEMORY_SETTINGS
        : { enabled: rows[0].enabled === 1, disableNativeMemory: rows[0].disable_native === 1 },
    ),
    Effect.mapError(unavailable),
  );
  const publishPolicy = (settings: MemorySettings) => Effect.sync(() => setMemoryPolicy(settings));
  yield* readSettings.pipe(Effect.flatMap(publishPolicy), Effect.ignore);

  const readAll = sql<MemoryRow>`
    SELECT id, scope, project_id, text, source, source_thread_id, created_at, updated_at
    FROM memories
    ORDER BY updated_at DESC, id
    LIMIT ${MEMORY_MAX_COUNT}
  `.pipe(
    Effect.map((rows) => rows.map(toMemory)),
    Effect.mapError(unavailable),
  );

  const readOne = (id: MemoryId) =>
    sql<MemoryRow>`
      SELECT id, scope, project_id, text, source, source_thread_id, created_at, updated_at
      FROM memories WHERE id = ${id}
    `.pipe(
      Effect.map((rows) => (rows[0] === undefined ? undefined : toMemory(rows[0]))),
      Effect.mapError(unavailable),
    );

  const now = DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const nowMillis = DateTime.now.pipe(Effect.map(DateTime.toEpochMillis));

  const list = Effect.fn("MemoryService.list")(function* (input: MemoryListInput) {
    const all = yield* readAll;
    const visible = all.filter(
      (memory) =>
        (input.scope === undefined || memory.scope === input.scope) &&
        (input.projectId === undefined || memory.projectId === input.projectId),
    );
    const query = input.query?.trim() ?? "";
    return {
      memories: query === "" ? visible : rankMemories(visible, query, yield* nowMillis),
      settings: yield* readSettings,
    };
  });

  const setSettings = Effect.fn("MemoryService.setSettings")(function* (
    patch: MemorySetSettingsInput,
  ) {
    const current = yield* readSettings;
    const next: MemorySettings = {
      enabled: patch.enabled ?? current.enabled,
      disableNativeMemory: patch.disableNativeMemory ?? current.disableNativeMemory,
    };
    yield* sql`
      INSERT INTO memory_settings (id, enabled, disable_native)
      VALUES (1, ${next.enabled ? 1 : 0}, ${next.disableNativeMemory ? 1 : 0})
      ON CONFLICT (id) DO UPDATE SET enabled = excluded.enabled, disable_native = excluded.disable_native
    `.pipe(Effect.mapError(unavailable));
    yield* publishPolicy(next);
    return next;
  });

  const requireEnabled = readSettings.pipe(
    Effect.flatMap((settings) =>
      settings.enabled
        ? Effect.void
        : Effect.fail(
            new MemoryError({
              code: "disabled",
              message: "Memory is turned off in Settings → Memory.",
            }),
          ),
    ),
  );

  const recall = Effect.fn("MemoryService.recall")(function* (input: MemoryRecallRequest) {
    const all = yield* readAll;
    const visible = all.filter(
      (memory) =>
        memory.scope === "user" ||
        (input.projectId !== undefined && memory.projectId === input.projectId),
    );
    return rankMemories(visible, input.query, yield* nowMillis).slice(0, input.limit);
  });

  const save = Effect.fn("MemoryService.save")(function* (input: MemorySaveRequest) {
    const text = input.text.trim();
    if (text === "") return yield* invalid("A memory needs text.");
    if (Array.from(text).length > MEMORY_TEXT_MAX_CHARS)
      return yield* invalid(
        `A memory is at most ${MEMORY_TEXT_MAX_CHARS} characters. Save it as several memories.`,
      );
    const stamp = yield* now;
    if (input.id !== undefined) {
      const existing = yield* readOne(input.id);
      if (existing === undefined)
        return yield* new MemoryError({
          code: "not_found",
          message: "That memory does not exist.",
        });
      // A person's edit vouches for the text; an agent's correction does not take that back.
      const source = input.source === "user" ? "user" : existing.source;
      yield* sql`
        UPDATE memories SET text = ${text}, source = ${source}, updated_at = ${stamp}
        WHERE id = ${input.id}
      `.pipe(Effect.mapError(unavailable));
      return { ...existing, text, source, updatedAt: stamp };
    }
    if (input.scope === "project" && input.projectId === undefined)
      return yield* invalid("A project memory needs a project.");
    const projectId = input.scope === "project" ? (input.projectId ?? null) : null;
    const same = yield* sql<MemoryRow>`
      SELECT id, scope, project_id, text, source, source_thread_id, created_at, updated_at
      FROM memories
      WHERE scope = ${input.scope} AND project_id IS ${projectId} AND lower(text) = lower(${text})
    `.pipe(
      Effect.map((rows) => (rows[0] === undefined ? undefined : toMemory(rows[0]))),
      Effect.mapError(unavailable),
    );
    if (same !== undefined) {
      yield* sql`UPDATE memories SET updated_at = ${stamp} WHERE id = ${same.id}`.pipe(
        Effect.mapError(unavailable),
      );
      return { ...same, updatedAt: stamp };
    }
    const counted = yield* sql<{ readonly count: number }>`
      SELECT COUNT(*) AS count FROM memories
    `.pipe(Effect.mapError(unavailable));
    if ((counted[0]?.count ?? 0) >= MEMORY_MAX_COUNT)
      return yield* new MemoryError({
        code: "limit",
        message: `Memory is full (${MEMORY_MAX_COUNT}). Forget some memories first.`,
      });
    const id = MemoryId.make(`mem_${yield* random.uuidV4().pipe(Effect.mapError(unavailable))}`);
    const created: Memory = {
      id,
      scope: input.scope,
      projectId,
      text,
      source: input.source,
      sourceThreadId: input.sourceThreadId ?? null,
      createdAt: stamp,
      updatedAt: stamp,
    };
    yield* sql`
      INSERT INTO memories (id, scope, project_id, text, source, source_thread_id, created_at, updated_at)
      VALUES (${id}, ${created.scope}, ${created.projectId}, ${text}, ${created.source},
        ${created.sourceThreadId}, ${stamp}, ${stamp})
    `.pipe(Effect.mapError(unavailable));
    return created;
  });

  const remove = Effect.fn("MemoryService.remove")(function* (id: MemoryId) {
    yield* sql`DELETE FROM memories WHERE id = ${id}`.pipe(Effect.mapError(unavailable));
    return { id };
  });

  return MemoryService.of({ list, recall, save, remove, setSettings, requireEnabled });
});

export const layer = Layer.effect(MemoryService, make);
