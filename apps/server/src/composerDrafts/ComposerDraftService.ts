import {
  COMPOSER_DRAFT_MAX_LIVE,
  COMPOSER_DRAFT_MAX_PAYLOAD_BYTES,
  COMPOSER_DRAFT_TOMBSTONE_TTL_MS,
  ComposerDraftContent,
  ComposerDraftError,
  type ComposerDraftsPutInput,
  type ComposerDraftsPutResult,
  type ComposerDraftsStreamEvent,
  type SyncedComposerDraft,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as SqlClient from "effect/sql/SqlClient";

export class ComposerDraftService extends Context.Service<
  ComposerDraftService,
  {
    readonly put: (
      input: ComposerDraftsPutInput,
    ) => Effect.Effect<ComposerDraftsPutResult, ComposerDraftError>;
    /** A snapshot of every draft and tombstone, then each change; reconnecting starts over. */
    readonly subscribe: () => Stream.Stream<ComposerDraftsStreamEvent, ComposerDraftError>;
    /** Attachment ids that live drafts reference, which the pending-attachment sweep must keep. */
    readonly referencedAttachmentIds: Effect.Effect<ReadonlySet<string>, ComposerDraftError>;
  }
>()("t3/composerDrafts/ComposerDraftService") {}

interface DraftRow {
  readonly draft_key: string;
  readonly revision: number;
  readonly updated_at: string;
  readonly updated_by: string;
  readonly deleted: number;
  readonly promoted_to: string | null;
  readonly payload_json: string | null;
}

const ContentJson = Schema.fromJsonString(ComposerDraftContent);
const encodeContent = Schema.encodeEffect(ContentJson);
const decodeContent = Schema.decodeUnknownSync(ContentJson);
const encoder = new TextEncoder();

const unavailable = () =>
  new ComposerDraftError({ code: "unavailable", message: "Drafts could not be read or saved." });

const toDraft = (row: DraftRow): SyncedComposerDraft | null => {
  try {
    return {
      key: row.draft_key as SyncedComposerDraft["key"],
      revision: row.revision,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      deleted: row.deleted === 1,
      promotedTo: row.promoted_to as SyncedComposerDraft["promotedTo"],
      content: row.payload_json === null ? null : decodeContent(row.payload_json),
    };
  } catch {
    // A row this version cannot read (written by a newer one) is skipped, not fatal.
    return null;
  }
};

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const changes = yield* PubSub.unbounded<ReadonlyArray<SyncedComposerDraft>>();

  // Created here, not by a numbered migration, so upstream migrations can never claim the same id.
  yield* sql`
    CREATE TABLE IF NOT EXISTS composer_drafts (
      draft_key TEXT PRIMARY KEY,
      revision INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      deleted INTEGER NOT NULL,
      promoted_to TEXT,
      payload_json TEXT
    ) WITHOUT ROWID
  `;
  // A counter of its own: the highest revision in the table can fall when old tombstones are purged.
  yield* sql`
    CREATE TABLE IF NOT EXISTS composer_draft_counter (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      revision INTEGER NOT NULL
    )
  `;

  const purgeTombstones = DateTime.now.pipe(
    Effect.flatMap((now) => {
      const cutoff = DateTime.formatIso(
        DateTime.subtract(now, { milliseconds: COMPOSER_DRAFT_TOMBSTONE_TTL_MS }),
      );
      return sql`DELETE FROM composer_drafts WHERE deleted = 1 AND updated_at < ${cutoff}`;
    }),
    Effect.ignore,
  );
  yield* purgeTombstones;

  const readAll = sql<DraftRow>`
    SELECT draft_key, revision, updated_at, updated_by, deleted, promoted_to, payload_json
    FROM composer_drafts ORDER BY revision
  `.pipe(
    Effect.map((rows) => rows.flatMap((row) => toDraft(row) ?? [])),
    Effect.mapError(unavailable),
  );

  const put: ComposerDraftService["Service"]["put"] = Effect.fn("ComposerDraftService.put")(
    function* (input) {
      const payloads = new Map<string, string>();
      for (const write of input.writes) {
        if (write.deleted || write.content === undefined) continue;
        const json = yield* encodeContent(write.content).pipe(
          Effect.mapError(
            () => new ComposerDraftError({ code: "invalid", message: "That draft is not valid." }),
          ),
        );
        if (encoder.encode(json).byteLength > COMPOSER_DRAFT_MAX_PAYLOAD_BYTES) {
          return yield* new ComposerDraftError({
            code: "limit",
            message: "That draft is too large to sync.",
          });
        }
        payloads.set(write.key, json);
      }
      const stamp = DateTime.formatIso(yield* DateTime.now);
      const written = yield* sql
        .withTransaction(
          Effect.gen(function* () {
            const out: SyncedComposerDraft[] = [];
            for (const write of input.writes) {
              const payload = payloads.get(write.key) ?? null;
              if (!write.deleted && payload === null) {
                return yield* new ComposerDraftError({
                  code: "invalid",
                  message: "A live draft needs content.",
                });
              }
              if (!write.deleted) {
                const live = yield* sql<{ readonly count: number; readonly mine: number }>`
                  SELECT COUNT(*) AS count, COALESCE(SUM(draft_key = ${write.key}), 0) AS mine
                  FROM composer_drafts WHERE deleted = 0
                `;
                if (
                  (live[0]?.mine ?? 0) === 0 &&
                  (live[0]?.count ?? 0) >= COMPOSER_DRAFT_MAX_LIVE
                ) {
                  return yield* new ComposerDraftError({
                    code: "limit",
                    message: `At most ${COMPOSER_DRAFT_MAX_LIVE} drafts sync. Send or discard some.`,
                  });
                }
              }
              const counter = yield* sql<{ readonly revision: number }>`
                INSERT INTO composer_draft_counter (id, revision) VALUES (1, 1)
                ON CONFLICT (id) DO UPDATE SET revision = revision + 1
                RETURNING revision
              `;
              const revision = counter[0]?.revision ?? 1;
              yield* sql`
                INSERT INTO composer_drafts
                  (draft_key, revision, updated_at, updated_by, deleted, promoted_to, payload_json)
                VALUES (${write.key}, ${revision}, ${stamp}, ${input.clientId},
                  ${write.deleted ? 1 : 0}, ${write.promotedTo ?? null}, ${write.deleted ? null : payload})
                ON CONFLICT (draft_key) DO UPDATE SET
                  revision = excluded.revision, updated_at = excluded.updated_at,
                  updated_by = excluded.updated_by, deleted = excluded.deleted,
                  promoted_to = excluded.promoted_to, payload_json = excluded.payload_json
              `;
              out.push({
                key: write.key,
                revision,
                updatedAt: stamp,
                updatedBy: input.clientId,
                deleted: write.deleted,
                promotedTo: write.promotedTo ?? null,
                content: write.deleted ? null : (write.content ?? null),
              });
            }
            return out;
          }),
        )
        .pipe(
          Effect.catchTags({
            SqlError: () => Effect.fail(unavailable()),
          }),
        );
      yield* PubSub.publish(changes, written);
      yield* purgeTombstones;
      return { revisions: written.map(({ key, revision }) => ({ key, revision })) };
    },
  );

  const subscribe: ComposerDraftService["Service"]["subscribe"] = () =>
    Stream.unwrap(
      Effect.gen(function* () {
        // Subscribe before reading so a change made in between is not lost.
        const subscription = yield* PubSub.subscribe(changes);
        const snapshot = yield* readAll;
        const first: ComposerDraftsStreamEvent = { type: "snapshot", drafts: snapshot };
        return Stream.concat(
          Stream.make(first),
          Stream.fromSubscription(subscription).pipe(
            Stream.map((drafts): ComposerDraftsStreamEvent => ({ type: "upsert", drafts })),
          ),
        );
      }),
    );

  const referencedAttachmentIds = readAll.pipe(
    Effect.map((drafts) => {
      const ids = new Set<string>();
      for (const draft of drafts) {
        for (const record of draft.content?.records ?? []) {
          if ("attachmentId" in record && typeof record.attachmentId === "string") {
            ids.add(record.attachmentId);
          }
        }
      }
      return ids as ReadonlySet<string>;
    }),
  );

  return ComposerDraftService.of({ put, subscribe, referencedAttachmentIds });
});

export const layer = Layer.effect(ComposerDraftService, make);
