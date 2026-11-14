import {
  DEFAULT_MEMORY_SETTINGS,
  EnvironmentId,
  MEMORY_MAX_COUNT,
  MEMORY_TEXT_MAX_CHARS,
  Memory,
  MemoryError,
  MemoryId,
  type MemoryDeleteResult,
  type MemoryListInput,
  type MemoryListResult,
  type MemorySaveInput,
  type MemoryScope,
  type MemorySetSettingsInput,
  type MemorySettings,
  type MemorySource,
  type MemorySyncPeer,
  type MemorySyncRecord,
  ProjectId,
  type ThreadId,
} from "@t3tools/contracts";
import { setMemoryDigestSource, setMemoryPolicy } from "@t3tools/provider-core/server/memoryPolicy";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as SqlClient from "effect/sql/SqlClient";

import { renderMemoryDigest } from "./memoryDigest.ts";
import { rankMemories } from "./memoryRanking.ts";

export interface MemorySaveRequest extends Omit<MemorySaveInput, "scope"> {
  /** Required to create; with `id`, moves the memory there, or keeps its scope when omitted. */
  readonly scope?: MemoryScope | undefined;
  readonly source: MemorySource;
  readonly sourceThreadId?: ThreadId | undefined;
}

export interface MemoryRecallRequest {
  readonly query: string;
  /** The caller's project; its project memories are visible next to the global and environment ones. */
  readonly projectId?: ProjectId | undefined;
  readonly limit: number;
}

/** A project here and the key its memories are stored under. */
export interface MemoryProjectKey {
  readonly projectId: ProjectId;
  readonly key: string;
  readonly label: string | null;
}

export interface MemoryPeerCursor {
  /** The peer's rev last received from it. */
  readonly pullRev: number;
  /** This environment's rev last sent to it. */
  readonly pushRev: number;
}

export interface MemoryPeerOutcome {
  readonly label: string;
  /** Set for a link from here, whose cursors this environment keeps. */
  readonly cursor?: MemoryPeerCursor | undefined;
  readonly error: string | null;
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
    readonly settings: Effect.Effect<MemorySettings, MemoryError>;
    readonly setSettings: (
      patch: MemorySetSettingsInput,
    ) => Effect.Effect<MemorySettings, MemoryError>;
    /** What the MCP tools check first: fails with `disabled` while memory is turned off. */
    readonly requireEnabled: Effect.Effect<void, MemoryError>;
    /**
     * Publishes which key each project here has. Project memories saved under `local:<id>` move to
     * the project's repository key once it has one.
     */
    readonly setProjectKeys: (
      projects: ReadonlyArray<MemoryProjectKey>,
    ) => Effect.Effect<void, MemoryError>;
    /** Changes after `since`, oldest first; ones that must not leave go out as deletions. */
    readonly changesSince: (
      since: number,
      limit: number,
      localEnvironmentId: EnvironmentId,
    ) => Effect.Effect<
      { readonly records: ReadonlyArray<MemorySyncRecord>; readonly rev: number },
      MemoryError
    >;
    /** Applies a peer's changes, newest write wins. */
    readonly merge: (
      records: ReadonlyArray<MemorySyncRecord>,
      localEnvironmentId: EnvironmentId,
    ) => Effect.Effect<void, MemoryError>;
    readonly peerCursor: (environmentId: EnvironmentId) => Effect.Effect<MemoryPeerCursor>;
    readonly recordPeer: (
      environmentId: EnvironmentId,
      outcome: MemoryPeerOutcome,
    ) => Effect.Effect<void>;
    /** Forgets the cursors and status of links from here that no longer exist. */
    readonly forgetLinksExcept: (
      environmentIds: ReadonlyArray<EnvironmentId>,
    ) => Effect.Effect<void>;
    /** Completes after the next local or merged change. */
    readonly awaitChange: Effect.Effect<void>;
  }
>()("t3/memory/MemoryService") {}

interface MemoryRow {
  readonly id: string;
  readonly scope: string;
  readonly project_key: string | null;
  readonly project_label: string | null;
  readonly origin_environment_id: string | null;
  readonly text: string;
  readonly source: string;
  readonly source_thread_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
  readonly rev: number;
}

const decodeMemory = Schema.decodeUnknownSync(Memory);

const LOCAL_KEY_PREFIX = "local:";
const localKey = (projectId: ProjectId) => `${LOCAL_KEY_PREFIX}${projectId}`;
// Deleted memories are kept this long so the deletion reaches every peer.
const TOMBSTONE_TTL = Duration.days(90);

const syncable = (row: Pick<MemoryRow, "scope" | "project_key">) =>
  row.scope === "user" ||
  (row.scope === "project" && row.project_key?.startsWith(LOCAL_KEY_PREFIX) === false);

/** Newest write wins; ties go to a deletion, then to the greater text, so every peer picks the same one. */
const wins = (
  incoming: { readonly updatedAt: string; readonly deleted: boolean; readonly text: string },
  local: { readonly updatedAt: string; readonly deleted: boolean; readonly text: string },
) =>
  incoming.updatedAt !== local.updatedAt
    ? incoming.updatedAt > local.updatedAt
    : incoming.deleted !== local.deleted
      ? incoming.deleted
      : incoming.text > local.text;

const unavailable = () =>
  new MemoryError({ code: "unavailable", message: "Memory could not be read or saved." });

const invalid = (message: string) => new MemoryError({ code: "invalid", message });

const notFound = () =>
  new MemoryError({ code: "not_found", message: "That memory does not exist." });

const COLUMNS = `id, scope, project_key, project_label, origin_environment_id, text, source,
  source_thread_id, created_at, updated_at, deleted_at, rev`;

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const random = yield* SecureRandom.SecureRandom;

  // Created here, not by a numbered migration, so upstream migrations can never claim the same id.
  const createMemories = (name: string) => sql`
    CREATE TABLE IF NOT EXISTS ${sql(name)} (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL CHECK (scope IN ('user', 'environment', 'project')),
      project_key TEXT,
      project_label TEXT,
      origin_environment_id TEXT,
      text TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('user', 'agent')),
      source_thread_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      rev INTEGER NOT NULL,
      CHECK ((scope = 'project') = (project_key IS NOT NULL))
    ) WITHOUT ROWID
  `;
  const existing = yield* sql<{ readonly sql: string }>`
    SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'memories'
  `;
  // The first layout keyed project memories by project id and had no scopes beyond user and project.
  if (existing[0]?.sql.includes("project_id") === true) {
    yield* sql.withTransaction(
      Effect.gen(function* () {
        yield* createMemories("memories_v2");
        yield* sql`
          INSERT INTO memories_v2 (id, scope, project_key, project_label, origin_environment_id,
            text, source, source_thread_id, created_at, updated_at, deleted_at, rev)
          SELECT id, scope, CASE WHEN project_id IS NULL THEN NULL ELSE 'local:' || project_id END,
            NULL, NULL, text, source, source_thread_id, created_at, updated_at, NULL,
            ROW_NUMBER() OVER (ORDER BY updated_at, id)
          FROM memories
        `;
        yield* sql`DROP TABLE memories`;
        yield* sql`ALTER TABLE memories_v2 RENAME TO memories`;
      }),
    );
  } else {
    yield* createMemories("memories");
  }
  yield* sql`DROP INDEX IF EXISTS memories_by_scope`;
  yield* sql`CREATE INDEX IF NOT EXISTS memories_by_rev ON memories (rev)`;
  yield* sql`
    CREATE TABLE IF NOT EXISTS memory_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL,
      disable_native INTEGER NOT NULL
    )
  `;
  const settingsColumns = yield* sql<{ readonly name: string }>`PRAGMA table_info(memory_settings)`;
  if (!settingsColumns.some((column) => column.name === "sync"))
    yield* sql`ALTER TABLE memory_settings ADD COLUMN sync INTEGER NOT NULL DEFAULT 1`;
  yield* sql`
    CREATE TABLE IF NOT EXISTS memory_sync_peers (
      environment_id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      outgoing INTEGER NOT NULL,
      pull_rev INTEGER NOT NULL DEFAULT 0,
      push_rev INTEGER NOT NULL DEFAULT 0,
      last_synced_at TEXT,
      last_error TEXT
    )
  `;

  const now = DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const nowMillis = DateTime.now.pipe(Effect.map(DateTime.toEpochMillis));
  const nextRev = sql`(SELECT COALESCE(MAX(rev), 0) + 1 FROM memories)`;

  const pruneBefore = DateTime.formatIso(
    DateTime.subtractDuration(yield* DateTime.now, TOMBSTONE_TTL),
  );
  yield* sql`DELETE FROM memories WHERE deleted_at IS NOT NULL AND deleted_at < ${pruneBefore}`;

  const readSettings = sql<{
    readonly enabled: number;
    readonly disable_native: number;
    readonly sync: number;
  }>`
    SELECT enabled, disable_native, sync FROM memory_settings WHERE id = 1
  `.pipe(
    Effect.map((rows): MemorySettings =>
      rows[0] === undefined
        ? DEFAULT_MEMORY_SETTINGS
        : {
            enabled: rows[0].enabled === 1,
            disableNativeMemory: rows[0].disable_native === 1,
            sync: rows[0].sync === 1,
          },
    ),
    Effect.mapError(unavailable),
  );
  const publishPolicy = ({ enabled, disableNativeMemory }: MemorySettings) =>
    Effect.sync(() => setMemoryPolicy({ enabled, disableNativeMemory }));
  yield* readSettings.pipe(Effect.flatMap(publishPolicy), Effect.ignore);

  // Adapters read keys synchronously for the digest, so they live in memory, published by MemorySync.
  let keysById = new Map<string, MemoryProjectKey>();
  let projectByKey = new Map<string, ProjectId>();
  const keyOf = (projectId: ProjectId) =>
    keysById.get(projectId) ?? { projectId, key: localKey(projectId), label: null };
  const projectIdOf = (key: string | null) =>
    key === null
      ? null
      : (projectByKey.get(key) ??
        (key.startsWith(LOCAL_KEY_PREFIX)
          ? ProjectId.make(key.slice(LOCAL_KEY_PREFIX.length))
          : null));

  const toMemory = (row: MemoryRow): Memory =>
    decodeMemory({
      id: row.id,
      scope: row.scope,
      projectId: projectIdOf(row.project_key),
      projectKey: row.project_key,
      projectLabel: row.project_label,
      originEnvironmentId: row.origin_environment_id,
      text: row.text,
      source: row.source,
      sourceThreadId: row.source_thread_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });

  const readRows = sql<MemoryRow>`
    SELECT ${sql.literal(COLUMNS)} FROM memories
    WHERE deleted_at IS NULL
    ORDER BY updated_at DESC, id
  `.pipe(Effect.mapError(unavailable));
  const readAll = readRows.pipe(Effect.map((rows) => rows.map(toMemory)));

  const readRow = (id: string) =>
    sql<MemoryRow>`SELECT ${sql.literal(COLUMNS)} FROM memories WHERE id = ${id}`.pipe(
      Effect.map((rows) => rows[0]),
      Effect.mapError(unavailable),
    );

  // One Deferred per wait: every change completes the current one and starts the next.
  const changed = yield* Ref.make(yield* Deferred.make<void>());
  const signalChange = Effect.gen(function* () {
    const next = yield* Deferred.make<void>();
    const previous = yield* Ref.getAndSet(changed, next);
    yield* Deferred.succeed(previous, undefined);
  });
  const awaitChange = Ref.get(changed).pipe(Effect.flatMap(Deferred.await));

  // Adapters read the digest synchronously, so a session starts from a cache refreshed on every write.
  let cached: ReadonlyArray<Memory> = [];
  const refreshCache = readAll.pipe(
    Effect.tap((all) =>
      Effect.sync(() => {
        cached = all;
      }),
    ),
    Effect.ignore,
  );
  setMemoryDigestSource((projectId) =>
    renderMemoryDigest(
      cached,
      projectId === undefined ? undefined : keyOf(ProjectId.make(projectId)).key,
    ),
  );
  yield* refreshCache;
  const afterChange = Effect.andThen(refreshCache, signalChange);

  const visibleFor = (memory: Memory, projectKey: string | undefined) =>
    memory.scope !== "project" || (projectKey !== undefined && memory.projectKey === projectKey);

  const readPeers = sql<{
    readonly environment_id: string;
    readonly label: string;
    readonly last_synced_at: string | null;
    readonly last_error: string | null;
  }>`
    SELECT environment_id, label, last_synced_at, last_error FROM memory_sync_peers ORDER BY label
  `.pipe(
    Effect.map((rows) =>
      rows.map((row): MemorySyncPeer => ({
        environmentId: EnvironmentId.make(row.environment_id),
        label: row.label,
        lastSyncedAt: row.last_synced_at,
        lastError: row.last_error,
      })),
    ),
    Effect.mapError(unavailable),
  );

  const list = Effect.fn("MemoryService.list")(function* (input: MemoryListInput) {
    const all = yield* readAll;
    const key = input.projectId === undefined ? undefined : keyOf(input.projectId).key;
    const visible = all.filter(
      (memory) =>
        (input.scope === undefined || memory.scope === input.scope) &&
        (key === undefined || memory.projectKey === key),
    );
    const query = input.query?.trim() ?? "";
    return {
      memories: query === "" ? visible : rankMemories(visible, query, yield* nowMillis),
      settings: yield* readSettings,
      peers: yield* readPeers,
    };
  });

  const setSettings = Effect.fn("MemoryService.setSettings")(function* (
    patch: MemorySetSettingsInput,
  ) {
    const current = yield* readSettings;
    const next: MemorySettings = {
      enabled: patch.enabled ?? current.enabled,
      disableNativeMemory: patch.disableNativeMemory ?? current.disableNativeMemory,
      sync: patch.sync ?? current.sync,
    };
    yield* sql`
      INSERT INTO memory_settings (id, enabled, disable_native, sync)
      VALUES (1, ${next.enabled ? 1 : 0}, ${next.disableNativeMemory ? 1 : 0}, ${next.sync ? 1 : 0})
      ON CONFLICT (id) DO UPDATE SET enabled = excluded.enabled,
        disable_native = excluded.disable_native, sync = excluded.sync
    `.pipe(Effect.mapError(unavailable));
    yield* publishPolicy(next);
    if (next.sync && !current.sync) yield* signalChange;
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
    const key = input.projectId === undefined ? undefined : keyOf(input.projectId).key;
    const visible = all.filter((memory) => visibleFor(memory, key));
    return rankMemories(visible, input.query, yield* nowMillis).slice(0, input.limit);
  });

  /** Where a memory of `scope` lives: its project key and label, or none. */
  const placement = Effect.fn("MemoryService.placement")(function* (
    scope: MemoryScope,
    projectId: ProjectId | undefined,
  ) {
    if (scope !== "project") return { key: null, label: null };
    if (projectId === undefined) return yield* invalid("A project memory needs a project.");
    const { key, label } = keyOf(projectId);
    return { key, label };
  });

  const saveMemory = Effect.fn("MemoryService.save")(
    function* (input: MemorySaveRequest) {
      const text = input.text.trim();
      if (text === "") return yield* invalid("A memory needs text.");
      if (Array.from(text).length > MEMORY_TEXT_MAX_CHARS)
        return yield* invalid(
          `A memory is at most ${MEMORY_TEXT_MAX_CHARS} characters. Save it as several memories.`,
        );
      const stamp = yield* now;
      if (input.id !== undefined) {
        const row = yield* readRow(input.id);
        if (row === undefined || row.deleted_at !== null) return yield* notFound();
        const scope = input.scope ?? (row.scope as MemoryScope);
        // Same scope and no project named: an edit in place, even of another environment's project.
        const moved = scope !== row.scope || input.projectId !== undefined;
        const { key, label } = moved
          ? yield* placement(scope, input.projectId)
          : { key: row.project_key, label: row.project_label };
        // A person's edit vouches for the text; an agent's correction does not take that back.
        const source = input.source === "user" ? "user" : row.source;
        yield* sql`
        UPDATE memories SET text = ${text}, source = ${source}, scope = ${scope},
          project_key = ${key}, project_label = ${label}, updated_at = ${stamp}, rev = ${nextRev}
        WHERE id = ${input.id}
      `.pipe(Effect.mapError(unavailable));
        return toMemory({
          ...row,
          scope,
          project_key: key,
          project_label: label,
          text,
          source,
          updated_at: stamp,
        });
      }
      if (input.scope === undefined) return yield* invalid("A new memory needs a scope.");
      const { key, label } = yield* placement(input.scope, input.projectId);
      const same = yield* sql<MemoryRow>`
      SELECT ${sql.literal(COLUMNS)} FROM memories
      WHERE deleted_at IS NULL AND scope = ${input.scope} AND project_key IS ${key}
        AND lower(text) = lower(${text})
    `.pipe(Effect.mapError(unavailable));
      if (same[0] !== undefined) {
        yield* sql`
        UPDATE memories SET updated_at = ${stamp}, rev = ${nextRev} WHERE id = ${same[0].id}
      `.pipe(Effect.mapError(unavailable));
        return toMemory({ ...same[0], updated_at: stamp });
      }
      const counted = yield* sql<{ readonly count: number }>`
      SELECT COUNT(*) AS count FROM memories WHERE deleted_at IS NULL
    `.pipe(Effect.mapError(unavailable));
      if ((counted[0]?.count ?? 0) >= MEMORY_MAX_COUNT)
        return yield* new MemoryError({
          code: "limit",
          message: `Memory is full (${MEMORY_MAX_COUNT}). Forget some memories first.`,
        });
      const id = MemoryId.make(`mem_${yield* random.uuidV4().pipe(Effect.mapError(unavailable))}`);
      const row: MemoryRow = {
        id,
        scope: input.scope,
        project_key: key,
        project_label: label,
        origin_environment_id: null,
        text,
        source: input.source,
        source_thread_id: input.sourceThreadId ?? null,
        created_at: stamp,
        updated_at: stamp,
        deleted_at: null,
        rev: 0,
      };
      yield* sql`
      INSERT INTO memories (${sql.literal(COLUMNS)})
      VALUES (${id}, ${row.scope}, ${key}, ${label}, NULL, ${text}, ${row.source},
        ${row.source_thread_id}, ${stamp}, ${stamp}, NULL, ${nextRev})
    `.pipe(Effect.mapError(unavailable));
      return toMemory(row);
    },
    Effect.tap(() => afterChange),
  );

  // A deletion stays as a tombstone until every peer has heard of it.
  const removeMemory = Effect.fn("MemoryService.remove")(
    function* (id: MemoryId) {
      const stamp = yield* now;
      yield* sql`
      UPDATE memories SET deleted_at = ${stamp}, updated_at = ${stamp}, text = '', rev = ${nextRev}
      WHERE id = ${id} AND deleted_at IS NULL
    `.pipe(Effect.mapError(unavailable));
      return { id };
    },
    Effect.tap(() => afterChange),
  );

  const setProjectKeys = Effect.fn("MemoryService.setProjectKeys")(function* (
    projects: ReadonlyArray<MemoryProjectKey>,
  ) {
    keysById = new Map(projects.map((project) => [project.projectId, project]));
    projectByKey = new Map();
    for (const project of projects)
      if (!projectByKey.has(project.key)) projectByKey.set(project.key, project.projectId);
    let upgraded = false;
    for (const project of projects) {
      if (project.key === localKey(project.projectId)) continue;
      const rows = yield* sql<{ readonly id: string }>`
        SELECT id FROM memories WHERE project_key = ${localKey(project.projectId)}
      `.pipe(Effect.mapError(unavailable));
      // One row at a time, so each gets its own rev and a sync page never splits a rev.
      for (const row of rows) {
        yield* sql`
          UPDATE memories SET project_key = ${project.key}, project_label = ${project.label},
            rev = ${nextRev}
          WHERE id = ${row.id}
        `.pipe(Effect.mapError(unavailable));
        upgraded = true;
      }
    }
    yield* upgraded ? afterChange : refreshCache;
  });

  const changesSince = Effect.fn("MemoryService.changesSince")(function* (
    since: number,
    limit: number,
    localEnvironmentId: EnvironmentId,
  ) {
    const rows = yield* sql<MemoryRow>`
      SELECT ${sql.literal(COLUMNS)} FROM memories WHERE rev > ${since} ORDER BY rev LIMIT ${limit}
    `.pipe(Effect.mapError(unavailable));
    const records = rows.map((row): MemorySyncRecord => {
      const origin = EnvironmentId.make(row.origin_environment_id ?? localEnvironmentId);
      const live = row.deleted_at === null && syncable(row);
      return {
        id: MemoryId.make(row.id),
        scope: live && row.scope === "project" ? "project" : "user",
        projectKey: live ? row.project_key : null,
        projectLabel: live ? row.project_label : null,
        originEnvironmentId: origin,
        text: live ? row.text : "",
        source: row.source === "user" ? "user" : "agent",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        // A memory moved out of a synced scope leaves its peers as a deletion.
        deletedAt: live ? null : (row.deleted_at ?? row.updated_at),
      };
    });
    return { records, rev: rows.at(-1)?.rev ?? since };
  });

  const mergeOne = Effect.fn("MemoryService.mergeOne")(function* (
    record: MemorySyncRecord,
    localEnvironmentId: EnvironmentId,
  ) {
    const origin =
      record.originEnvironmentId === localEnvironmentId ? null : record.originEnvironmentId;
    const deleted = record.deletedAt !== null;
    const projectKey = record.scope === "project" ? record.projectKey : null;
    if (record.scope === "project" && projectKey === null) return false;
    const local = yield* readRow(record.id);
    if (local === undefined) {
      // A deletion of something never seen here has nothing to delete.
      if (deleted) return false;
      // Two environments saved the same text: every peer keeps the smaller id.
      const same = yield* sql<{ readonly id: string }>`
        SELECT id FROM memories
        WHERE deleted_at IS NULL AND scope = ${record.scope} AND project_key IS ${projectKey}
          AND lower(text) = lower(${record.text})
      `.pipe(Effect.mapError(unavailable));
      const twin = same[0];
      if (twin !== undefined && twin.id < record.id) return false;
      if (twin !== undefined)
        yield* sql`
          UPDATE memories SET deleted_at = ${record.updatedAt}, text = '', rev = ${nextRev}
          WHERE id = ${twin.id}
        `.pipe(Effect.mapError(unavailable));
      yield* sql`
        INSERT INTO memories (${sql.literal(COLUMNS)})
        VALUES (${record.id}, ${record.scope}, ${projectKey}, ${record.projectLabel}, ${origin},
          ${record.text}, ${record.source}, NULL, ${record.createdAt}, ${record.updatedAt}, NULL,
          ${nextRev})
      `.pipe(Effect.mapError(unavailable));
      return true;
    }
    // This environment moved it out of a synced scope; peers no longer decide it.
    if (!syncable(local)) return false;
    if (
      !wins(
        { updatedAt: record.updatedAt, deleted, text: record.text },
        { updatedAt: local.updated_at, deleted: local.deleted_at !== null, text: local.text },
      )
    )
      return false;
    yield* sql`
      UPDATE memories SET scope = ${record.scope}, project_key = ${projectKey},
        project_label = ${record.projectLabel}, origin_environment_id = ${origin},
        text = ${deleted ? "" : record.text}, source = ${record.source},
        updated_at = ${record.updatedAt}, deleted_at = ${record.deletedAt}, rev = ${nextRev}
      WHERE id = ${record.id}
    `.pipe(Effect.mapError(unavailable));
    return true;
  });

  const merge = Effect.fn("MemoryService.merge")(function* (
    records: ReadonlyArray<MemorySyncRecord>,
    localEnvironmentId: EnvironmentId,
  ) {
    let any = false;
    for (const record of records) {
      if (record.text.length > MEMORY_TEXT_MAX_CHARS * 4) continue;
      if (yield* mergeOne(record, localEnvironmentId)) any = true;
    }
    // ponytail: peers' memories are kept past MEMORY_MAX_COUNT so environments never disagree; cap merges if that grows.
    if (any) yield* afterChange;
  });

  const peerCursor = (environmentId: EnvironmentId) =>
    sql<{ readonly pull_rev: number; readonly push_rev: number }>`
      SELECT pull_rev, push_rev FROM memory_sync_peers WHERE environment_id = ${environmentId}
    `.pipe(
      Effect.map((rows) => ({ pullRev: rows[0]?.pull_rev ?? 0, pushRev: rows[0]?.push_rev ?? 0 })),
      Effect.orElseSucceed(() => ({ pullRev: 0, pushRev: 0 })),
    );

  const recordPeer = Effect.fn("MemoryService.recordPeer")(
    function* (environmentId: EnvironmentId, outcome: MemoryPeerOutcome) {
      const stamp = outcome.error === null ? yield* now : null;
      const outgoing = outcome.cursor === undefined ? 0 : 1;
      yield* sql`
        INSERT INTO memory_sync_peers (environment_id, label, outgoing, pull_rev, push_rev,
          last_synced_at, last_error)
        VALUES (${environmentId}, ${outcome.label}, ${outgoing}, ${outcome.cursor?.pullRev ?? 0},
          ${outcome.cursor?.pushRev ?? 0}, ${stamp}, ${outcome.error})
        ON CONFLICT (environment_id) DO UPDATE SET
          label = excluded.label,
          outgoing = MAX(outgoing, excluded.outgoing),
          pull_rev = CASE WHEN ${outgoing} = 1 THEN excluded.pull_rev ELSE pull_rev END,
          push_rev = CASE WHEN ${outgoing} = 1 THEN excluded.push_rev ELSE push_rev END,
          last_synced_at = COALESCE(excluded.last_synced_at, last_synced_at),
          last_error = excluded.last_error
      `;
    },
    (effect) => Effect.ignore(effect),
  );

  const forgetLinksExcept = (environmentIds: ReadonlyArray<EnvironmentId>) =>
    sql`
      DELETE FROM memory_sync_peers
      WHERE outgoing = 1 AND environment_id NOT IN ${sql.in(environmentIds.length === 0 ? [""] : environmentIds)}
    `.pipe(Effect.ignore);

  return MemoryService.of({
    list,
    recall,
    save: saveMemory,
    remove: removeMemory,
    settings: readSettings,
    setSettings,
    requireEnabled,
    setProjectKeys,
    changesSince,
    merge,
    peerCursor,
    recordPeer,
    forgetLinksExcept,
    awaitChange,
  });
});

export const layer = Layer.effect(MemoryService, make);
