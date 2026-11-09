import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect, it } from "@effect/vitest";
import { MEMORY_MAX_COUNT, MemoryId, ProjectId } from "@t3tools/contracts";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

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

  it.effect("recall shows user memory and the caller's project, never another project's", () =>
    Effect.gen(function* () {
      const memory = yield* MemoryService.MemoryService;
      const user = yield* memory.save({ scope: "user", text: "Reply in Polish", source: "user" });
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
      expect(found.map((entry) => entry.id).toSorted()).toEqual([user.id, mine.id].toSorted());
      expect(yield* memory.recall({ query: "polish", limit: 10 })).toHaveLength(1);
      expect(yield* memory.recall({ query: "polish", projectId: projectA, limit: 1 })).toHaveLength(
        1,
      );

      // The Settings list sees every project, and can narrow to one.
      expect((yield* memory.list({ query: "polish" })).memories).toHaveLength(3);
      expect(
        (yield* memory.list({ projectId: projectB })).memories.map((entry) => entry.id),
      ).toEqual([theirs.id]);
      for (const entry of [user, mine, theirs]) yield* memory.remove(entry.id);
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
