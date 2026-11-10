import { ConnectionTransientError } from "@t3tools/client-runtime/connection";
import {
  ConnectionCatalogDocument,
  EMPTY_CONNECTION_CATALOG_DOCUMENT,
  mergeSharedCatalog,
  sharedCatalogPart,
} from "@t3tools/client-runtime/platform";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";

import type { CatalogBackend } from "./storage";

/**
 * How the server's shared copy failed. `unsupported` is permanent for this page (no such endpoint,
 * or this session may not use it); `unavailable` is worth another try on the next load.
 */
export class CatalogRemoteError extends Schema.TaggedError<CatalogRemoteError>()(
  "CatalogRemoteError",
  { kind: Schema.Literals(["unsupported", "unavailable", "conflict"]), cause: Schema.Defect() },
) {}

/** The server's copy changed since it was read, so the change must be made again on top of it. */
export class CatalogConflictError extends Schema.TaggedError<CatalogConflictError>()(
  "CatalogConflictError",
  {},
) {}

export interface CatalogRemote {
  readonly get: Effect.Effect<
    { readonly revision: number; readonly document: string | null },
    CatalogRemoteError
  >;
  readonly put: (input: {
    readonly baseRevision: number;
    readonly document: string;
  }) => Effect.Effect<{ readonly revision: number }, CatalogRemoteError>;
}

type Mode =
  | { readonly _tag: "local" }
  // `revision` is null when the server could not be read: changes to the shared part are refused
  // rather than saved here only, where the next load would drop them.
  | { readonly _tag: "synced"; readonly revision: number | null; readonly shared: string };

const documentJson = Schema.fromJsonString(ConnectionCatalogDocument);
const decode = Schema.decodeUnknownEffect(documentJson);
const encode = Schema.encodeEffect(documentJson);

const transient = (detail: string) =>
  new ConnectionTransientError({ reason: "remote-unavailable", detail });

/**
 * Keeps the part of a catalog every device should have on the server this page came from, with
 * `local` as the offline cache and the home of everything device-bound.
 */
export const withSharedCatalog = Effect.fn("web.connectionStorage.withSharedCatalog")(function* (
  local: CatalogBackend,
  remote: CatalogRemote,
) {
  const mode = yield* Ref.make<Mode>({ _tag: "local" });

  const read = Effect.gen(function* () {
    const localRaw = yield* local.read;
    const localDocument =
      localRaw === null || localRaw.trim() === ""
        ? Option.some(EMPTY_CONNECTION_CATALOG_DOCUMENT)
        : yield* Effect.option(decode(localRaw));
    // The store quarantines a document it cannot decode.
    if (Option.isNone(localDocument)) return localRaw;
    const own = localDocument.value;

    const fetched = yield* Effect.gen(function* () {
      const { revision, document } = yield* remote.get;
      const shared =
        document === null
          ? null
          : yield* decode(document).pipe(
              Effect.mapError((cause) => new CatalogRemoteError({ kind: "unsupported", cause })),
            );
      return { ok: true as const, revision, shared };
    }).pipe(Effect.catch((error) => Effect.succeed({ ok: false as const, kind: error.kind })));
    if (!fetched.ok) {
      yield* Ref.set(
        mode,
        fetched.kind === "unsupported"
          ? { _tag: "local" }
          : {
              _tag: "synced",
              revision: null,
              shared: yield* encode(sharedCatalogPart(own)).pipe(Effect.orDie),
            },
      );
      return localRaw;
    }

    const { revision, shared } = fetched;
    const merged = mergeSharedCatalog(own, shared);
    const sharedJson = yield* encode(sharedCatalogPart(merged.document)).pipe(Effect.orDie);
    const pushed = merged.push
      ? yield* remote.put({ baseRevision: revision, document: sharedJson }).pipe(Effect.option)
      : Option.some({ revision });
    // An unpushed first sync stays unmarked, so the next load tries to add those entries again.
    const sharedRevision = Option.match(pushed, {
      onNone: () => own.sharedRevision,
      onSome: (value) => value.revision,
    });
    yield* Ref.set(mode, {
      _tag: "synced",
      revision: Option.isSome(pushed) ? pushed.value.revision : null,
      shared: sharedJson,
    });
    const raw = yield* encode({
      ...merged.document,
      ...(sharedRevision === undefined ? {} : { sharedRevision }),
    }).pipe(Effect.orDie);
    yield* local.write(raw).pipe(
      Effect.catch((cause) =>
        Effect.logWarning("Could not cache the shared connection catalog.", {
          error: cause.message,
        }),
      ),
    );
    return raw;
  });

  const write = Effect.fn("web.connectionStorage.writeSharedCatalog")(function* (raw: string) {
    const current = yield* Ref.get(mode);
    if (current._tag === "local") return yield* local.write(raw);
    const document = yield* decode(raw).pipe(
      Effect.mapError((cause) => transient(`Could not read the connection catalog: ${cause}`)),
    );
    const shared = yield* encode(sharedCatalogPart(document)).pipe(Effect.orDie);
    if (shared === current.shared) return yield* local.write(raw);
    if (current.revision === null) {
      return yield* transient(
        "The saved environments could not be loaded from this server, so this change was not saved. Reload and try again.",
      );
    }
    const { revision } = yield* remote
      .put({ baseRevision: current.revision, document: shared })
      .pipe(
        Effect.mapError((error) =>
          error.kind === "conflict"
            ? new CatalogConflictError()
            : transient(`Could not save the shared connection catalog: ${error.cause}`),
        ),
      );
    yield* Ref.set(mode, { _tag: "synced", revision, shared });
    yield* local.write(yield* encode({ ...document, sharedRevision: revision }).pipe(Effect.orDie));
  });

  return {
    read,
    write,
    ...(local.quarantine === undefined ? {} : { quarantine: local.quarantine }),
  };
});
