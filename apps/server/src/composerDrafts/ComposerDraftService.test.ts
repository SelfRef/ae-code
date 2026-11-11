import { expect, it } from "@effect/vitest";
import {
  COMPOSER_DRAFT_MAX_LIVE,
  ComposerDraftKey,
  type ComposerDraftContent,
  type ComposerDraftsStreamEvent,
} from "@t3tools/contracts";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import * as SqlClient from "effect/sql/SqlClient";

import * as ComposerDraftService from "./ComposerDraftService.ts";

const layer = ComposerDraftService.layer.pipe(
  Layer.provideMerge(NodeSqliteClient.layer({ filename: ":memory:" })),
);

const content = (prompt: string): ComposerDraftContent => ({
  prompt,
  records: [
    {
      version: 1,
      contextId: "ctx1",
      label: "shot.png",
      kind: "image",
      attachmentId: "att-1",
      name: "shot.png",
      mimeType: "image/png",
      sizeBytes: 3,
    } as never,
  ],
  modelSelection: null,
  runtimeMode: null,
  interactionMode: null,
  session: null,
});

const key = (value: string) => ComposerDraftKey.make(value);

it.layer(layer)("ComposerDraftService", (it) => {
  it.effect("streams a snapshot, then each change, with rising revisions", () =>
    Effect.gen(function* () {
      const drafts = yield* ComposerDraftService.ComposerDraftService;
      yield* drafts.put({
        clientId: "a",
        writes: [{ key: key("thread:t1"), deleted: false, content: content("one") }],
      });
      const events: ComposerDraftsStreamEvent[] = [];
      const collected = yield* drafts.subscribe().pipe(
        Stream.take(3),
        Stream.runForEach((event) => Effect.sync(() => events.push(event))),
        Effect.forkChild,
      );
      yield* Effect.yieldNow;
      const first = yield* drafts.put({
        clientId: "b",
        writes: [{ key: key("thread:t1"), deleted: false, content: content("two") }],
      });
      const second = yield* drafts.put({
        clientId: "b",
        writes: [{ key: key("thread:t1"), deleted: true }],
      });
      yield* Fiber.join(collected);

      expect(events.map((event) => event.type)).toEqual(["snapshot", "upsert", "upsert"]);
      expect(events[0]?.type === "snapshot" && events[0].drafts[0]?.content?.prompt).toBe("one");
      expect(events[1]?.drafts[0]).toMatchObject({ updatedBy: "b", deleted: false });
      expect(events[2]?.drafts[0]).toMatchObject({ deleted: true, content: null });
      expect(second.revisions[0]!.revision).toBeGreaterThan(first.revisions[0]!.revision);
      expect(yield* drafts.referencedAttachmentIds).toEqual(new Set());
    }),
  );

  it.effect("refuses a payload over the cap and a live draft over the count cap", () =>
    Effect.gen(function* () {
      const drafts = yield* ComposerDraftService.ComposerDraftService;
      const sql = yield* SqlClient.SqlClient;
      const tooBig = yield* drafts
        .put({
          clientId: "a",
          writes: [
            { key: key("draft:big"), deleted: false, content: content("x".repeat(300 * 1024)) },
          ],
        })
        .pipe(Effect.flip);
      expect(tooBig.code).toBe("limit");

      yield* sql`DELETE FROM composer_drafts`;
      for (let index = 0; index < COMPOSER_DRAFT_MAX_LIVE; index += 1) {
        yield* sql`
          INSERT INTO composer_drafts VALUES (${`draft:${index}`}, ${index}, '2026-01-01T00:00:00.000Z', 'a', 0, NULL, ${JSON.stringify(content("x"))})
        `;
      }
      const full = yield* drafts
        .put({
          clientId: "a",
          writes: [{ key: key("draft:new"), deleted: false, content: content("y") }],
        })
        .pipe(Effect.flip);
      expect(full.code).toBe("limit");
      // Editing a draft that already counts is still allowed.
      yield* drafts.put({
        clientId: "a",
        writes: [{ key: key("draft:3"), deleted: false, content: content("edited") }],
      });
    }),
  );

  it.effect("keeps a fresh tombstone and purges an old one", () =>
    Effect.gen(function* () {
      const drafts = yield* ComposerDraftService.ComposerDraftService;
      const sql = yield* SqlClient.SqlClient;
      yield* TestClock.setTime(Date.parse("2026-11-11T00:00:00.000Z"));
      yield* sql`DELETE FROM composer_drafts`;
      yield* sql`
        INSERT INTO composer_drafts VALUES ('thread:old', 1, '2020-01-01T00:00:00.000Z', 'a', 1, NULL, NULL)
      `;
      yield* drafts.put({
        clientId: "a",
        writes: [{ key: key("thread:fresh"), deleted: true }],
      });
      const rows = yield* sql<{
        readonly draft_key: string;
      }>`SELECT draft_key FROM composer_drafts`;
      expect(rows.map((row) => row.draft_key)).toEqual(["thread:fresh"]);
    }),
  );
});
