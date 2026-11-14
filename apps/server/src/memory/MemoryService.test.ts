import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect, it } from "@effect/vitest";
import { EnvironmentId, MEMORY_MAX_COUNT, MemoryId, ProjectId } from "@t3tools/contracts";
import { getMemoryPolicy, nativeMemoryDisabled } from "@t3tools/provider-core/server/memoryPolicy";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";

import * as MemoryService from "./MemoryService.ts";

const layer = MemoryService.layer.pipe(
  Layer.provideMerge(NodeSqliteClient.layer({ filename: ":memory:" })),
  Layer.provideMerge(NodeCrypto.layer),
);

const projectA = ProjectId.make("project:a");
const projectB = ProjectId.make("project:b");

it.layer(layer)("MemoryService", (it) => {
  it.effect("saves, lists, edits and forgets a memory", () =>
    Effect.gen(function* () {
      const memory = yield* MemoryService.MemoryService;
      const created = yield* memory.save({
        scope: "user",
        text: "  Prefer pnpm  ",
        source: "agent",
      });
      expect(created).toMatchObject({
        scope: "user",
        projectId: null,
        text: "Prefer pnpm",
        source: "agent",
      });

      const edited = yield* memory.save({
        id: created.id,
        scope: "user",
        text: "Prefer pnpm 12",
        source: "user",
      });
      expect(edited).toMatchObject({ id: created.id, text: "Prefer pnpm 12", source: "user" });

      // An agent's correction does not take back a person's vouching.
      const corrected = yield* memory.save({
        id: created.id,
        scope: "user",
        text: "Prefer pnpm 12.14",
        source: "agent",
      });
      expect(corrected.source).toBe("user");

      expect((yield* memory.list({})).memories.map((entry) => entry.text)).toEqual([
        "Prefer pnpm 12.14",
      ]);
      yield* memory.remove(created.id);
      expect((yield* memory.list({})).memories).toEqual([]);
    }),
  );

  it.effect("saving the same text again updates it instead of adding a copy", () =>
    Effect.gen(function* () {
      const memory = yield* MemoryService.MemoryService;
      const first = yield* memory.save({
        scope: "project",
        projectId: projectA,
        text: "Use oxfmt",
        source: "agent",
      });
      const again = yield* memory.save({
        scope: "project",
        projectId: projectA,
        text: "use OXFMT",
        source: "agent",
      });
      const other = yield* memory.save({
        scope: "project",
        projectId: projectB,
        text: "Use oxfmt",
        source: "agent",
      });

      expect(again.id).toBe(first.id);
      expect(other.id).not.toBe(first.id);
      yield* memory.remove(first.id);
      yield* memory.remove(other.id);
    }),
  );

  it.effect(
    "recall shows global, environment and the caller's project memory, never another project's",
    () =>
      Effect.gen(function* () {
        const memory = yield* MemoryService.MemoryService;
        const user = yield* memory.save({ scope: "user", text: "Reply in Polish", source: "user" });
        const here = yield* memory.save({
          scope: "environment",
          text: "Polish locale is installed here",
          source: "user",
        });
        const mine = yield* memory.save({
          scope: "project",
          projectId: projectA,
          text: "Polish docs live in docs/pl",
          source: "user",
        });
        const theirs = yield* memory.save({
          scope: "project",
          projectId: projectB,
          text: "Polish changelog",
          source: "user",
        });

        const found = yield* memory.recall({ query: "polish", projectId: projectA, limit: 10 });
        expect(found.map((entry) => entry.id).toSorted()).toEqual(
          [user.id, here.id, mine.id].toSorted(),
        );
        expect(yield* memory.recall({ query: "polish", limit: 10 })).toHaveLength(2);
        expect(
          yield* memory.recall({ query: "polish", projectId: projectA, limit: 1 }),
        ).toHaveLength(1);

        // The Settings list sees every project, and can narrow to one.
        expect((yield* memory.list({ query: "polish" })).memories).toHaveLength(4);
        expect(
          (yield* memory.list({ projectId: projectB })).memories.map((entry) => entry.id),
        ).toEqual([theirs.id]);
        for (const entry of [user, here, mine, theirs]) yield* memory.remove(entry.id);
      }),
  );

  it.effect("rejects blank, oversized, projectless and unknown writes", () =>
    Effect.gen(function* () {
      const memory = yield* MemoryService.MemoryService;
      const blank = yield* memory
        .save({ scope: "user", text: "   ", source: "user" })
        .pipe(Effect.flip);
      const oversized = yield* memory
        .save({ scope: "user", text: "x".repeat(2001), source: "user" })
        .pipe(Effect.flip);
      const projectless = yield* memory
        .save({ scope: "project", text: "needs a project", source: "user" })
        .pipe(Effect.flip);
      const unknown = yield* memory
        .save({ id: MemoryId.make("mem_missing"), scope: "user", text: "x", source: "user" })
        .pipe(Effect.flip);

      expect([blank.code, oversized.code, projectless.code, unknown.code]).toEqual([
        "invalid",
        "invalid",
        "invalid",
        "not_found",
      ]);
    }),
  );

  it.effect("starts on, keeps what is saved while off, and tells the adapters", () =>
    Effect.gen(function* () {
      const memory = yield* MemoryService.MemoryService;
      expect((yield* memory.list({})).settings).toEqual({
        enabled: true,
        disableNativeMemory: true,
        sync: true,
      });
      yield* memory.requireEnabled;

      const saved = yield* memory.save({ scope: "user", text: "Reply in Polish", source: "user" });
      expect(yield* memory.setSettings({ enabled: false })).toEqual({
        enabled: false,
        disableNativeMemory: true,
        sync: true,
      });
      // Off for agents; the page still lists, edits and forgets.
      expect((yield* memory.requireEnabled.pipe(Effect.flip)).code).toBe("disabled");
      expect(getMemoryPolicy()).toEqual({ enabled: false, disableNativeMemory: true });
      expect(nativeMemoryDisabled()).toBe(false);
      expect((yield* memory.list({})).memories.map((entry) => entry.id)).toEqual([saved.id]);

      yield* memory.setSettings({ enabled: true, disableNativeMemory: false });
      yield* memory.requireEnabled;
      expect(nativeMemoryDisabled()).toBe(false);
      expect((yield* memory.list({})).settings).toEqual({
        enabled: true,
        disableNativeMemory: false,
        sync: true,
      });
      yield* memory.setSettings({ disableNativeMemory: true });
      expect(nativeMemoryDisabled()).toBe(true);
      yield* memory.remove(saved.id);
    }),
  );

  it.effect("refuses a new memory once the store is full, but still updates", () =>
    Effect.gen(function* () {
      const memory = yield* MemoryService.MemoryService;
      for (let index = 0; index < MEMORY_MAX_COUNT; index += 1)
        yield* memory.save({ scope: "user", text: `fact number ${index}`, source: "agent" });
      const full = yield* memory
        .save({ scope: "user", text: "one too many", source: "agent" })
        .pipe(Effect.flip);
      expect(full.code).toBe("limit");
      const again = yield* memory.save({ scope: "user", text: "fact number 0", source: "agent" });
      expect(again.text).toBe("fact number 0");
      for (const entry of (yield* memory.list({})).memories) yield* memory.remove(entry.id);
    }),
  );
});

const freshLayer = () =>
  MemoryService.layer.pipe(
    Layer.provideMerge(NodeSqliteClient.layer({ filename: ":memory:" })),
    Layer.provideMerge(NodeCrypto.layer),
  );
const build = Layer.build(freshLayer()).pipe(
  Effect.map((context) => Context.get(context, MemoryService.MemoryService)),
);
const envA = EnvironmentId.make("environment:a");
const envB = EnvironmentId.make("environment:b");

/** One exchange the way MemorySync runs it, from `a`'s side. */
const exchange = (
  a: MemoryService.MemoryService["Service"],
  b: MemoryService.MemoryService["Service"],
) =>
  Effect.gen(function* () {
    const cursor = yield* a.peerCursor(envB);
    const outgoing = yield* a.changesSince(cursor.pushRev, 200, envA);
    const answer = yield* b.changesSince(cursor.pullRev, 200, envB);
    yield* b.merge(outgoing.records, envB);
    yield* a.merge(answer.records, envA);
    yield* a.recordPeer(envB, {
      label: "B",
      cursor: { pullRev: answer.rev, pushRev: outgoing.rev },
      error: null,
    });
  });

const texts = (memory: MemoryService.MemoryService["Service"]) =>
  memory
    .list({})
    .pipe(Effect.map((result) => result.memories.map((entry) => entry.text).toSorted()));

it.effect("moves a memory between scopes and projects", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const memory = yield* build;
      const saved = yield* memory.save({ scope: "user", text: "Use oxfmt", source: "user" });
      const toProject = yield* memory.save({
        id: saved.id,
        scope: "project",
        projectId: projectA,
        text: "Use oxfmt",
        source: "user",
      });
      expect(toProject).toMatchObject({ scope: "project", projectId: projectA });
      // An edit that names no project keeps the memory where it is.
      const edited = yield* memory.save({
        id: saved.id,
        scope: "project",
        text: "Use oxfmt 2",
        source: "user",
      });
      expect(edited).toMatchObject({ scope: "project", projectKey: "local:project:a" });
      const toEnvironment = yield* memory.save({
        id: saved.id,
        scope: "environment",
        text: "Use oxfmt 2",
        source: "user",
      });
      expect(toEnvironment).toMatchObject({ scope: "environment", projectKey: null });
      expect((yield* memory.list({ scope: "environment" })).memories).toHaveLength(1);
    }),
  ),
);

it.effect("keys project memory by repository, so clones of one repository share it", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const memory = yield* build;
      const saved = yield* memory.save({
        scope: "project",
        projectId: projectA,
        text: "Deploys go through Nomad",
        source: "user",
      });
      expect(saved.projectKey).toBe("local:project:a");
      yield* memory.setProjectKeys([
        { projectId: projectA, key: "github.com/me/app", label: "me/app" },
        { projectId: projectB, key: "github.com/me/app", label: "me/app" },
      ]);
      const found = yield* memory.recall({ query: "nomad", projectId: projectB, limit: 10 });
      expect(found).toMatchObject([
        { id: saved.id, projectKey: "github.com/me/app", projectLabel: "me/app" },
      ]);
    }),
  ),
);

it.effect("syncs global and repository memory both ways; environment memory never leaves", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const a = yield* build;
      const b = yield* build;
      yield* a.setProjectKeys([{ projectId: projectA, key: "github.com/me/app", label: null }]);
      const global = yield* a.save({ scope: "user", text: "Reply in Polish", source: "user" });
      yield* a.save({ scope: "environment", text: "GPU is a 7800 XT", source: "user" });
      yield* a.save({ scope: "project", projectId: projectA, text: "Use oxfmt", source: "user" });
      yield* a.save({
        scope: "project",
        projectId: projectB,
        text: "No remote, stays here",
        source: "user",
      });
      yield* exchange(a, b);
      expect(yield* texts(b)).toEqual(["Reply in Polish", "Use oxfmt"]);
      expect(
        (yield* b.list({})).memories.every((entry) => entry.originEnvironmentId === envA),
      ).toBe(true);

      // B's later edit wins on A; A's deletion then reaches B.
      yield* TestClock.adjust("1 second");
      yield* b.save({ id: global.id, scope: "user", text: "Reply in English", source: "user" });
      yield* exchange(a, b);
      expect(yield* texts(a)).toContain("Reply in English");
      yield* TestClock.adjust("1 second");
      yield* a.remove(global.id);
      yield* exchange(a, b);
      expect(yield* texts(b)).toEqual(["Use oxfmt"]);

      // Moving one out of a synced scope deletes it on peers but keeps it here.
      const oxfmt = (yield* a.list({ scope: "project" })).memories.find(
        (entry) => entry.text === "Use oxfmt",
      );
      yield* TestClock.adjust("1 second");
      yield* a.save({ id: oxfmt!.id, scope: "environment", text: "Use oxfmt", source: "user" });
      yield* exchange(a, b);
      expect(yield* texts(b)).toEqual([]);
      expect(yield* texts(a)).toContain("Use oxfmt");
      // Nothing left to send: both sides are quiet.
      const cursor = yield* a.peerCursor(envB);
      expect((yield* a.changesSince(cursor.pushRev, 200, envA)).records).toEqual([]);
    }),
  ),
);

it.effect("two environments that saved the same text keep the one with the smaller id", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const a = yield* build;
      const b = yield* build;
      yield* a.save({ scope: "user", text: "Prefer pnpm", source: "user" });
      yield* b.save({ scope: "user", text: "prefer PNPM", source: "user" });
      yield* exchange(a, b);
      yield* exchange(a, b);
      const left = (yield* a.list({})).memories.map((entry) => entry.id);
      const right = (yield* b.list({})).memories.map((entry) => entry.id);
      expect(left).toHaveLength(1);
      expect(right).toEqual(left);
    }),
  ),
);

it.effect("rebuilds the first table layout, keeping every memory", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`
        CREATE TABLE memories (
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
        INSERT INTO memories VALUES
          ('mem_1', 'user', NULL, 'Reply in Polish', 'user', NULL, '2026-11-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z'),
          ('mem_2', 'project', 'project:a', 'Use oxfmt', 'agent', NULL, '2026-11-02T00:00:00.000Z', '2026-11-02T00:00:00.000Z')
      `;
      const context = yield* Layer.build(MemoryService.layer);
      const memory = Context.get(context, MemoryService.MemoryService);
      expect((yield* memory.list({})).memories).toMatchObject([
        { id: "mem_2", scope: "project", projectId: projectA, projectKey: "local:project:a" },
        { id: "mem_1", scope: "user", projectKey: null },
      ]);
      expect((yield* memory.changesSince(0, 10, envA)).records).toHaveLength(2);
    }),
  ).pipe(
    Effect.provide(Layer.merge(NodeSqliteClient.layer({ filename: ":memory:" }), NodeCrypto.layer)),
  ),
);
