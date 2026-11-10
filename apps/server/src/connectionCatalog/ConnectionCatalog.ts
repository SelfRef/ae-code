import {
  CONNECTION_CATALOG_MAX_BYTES,
  type EnvironmentConnectionCatalog,
  NonNegativeInt,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";

const SECRET_NAME = "connection-catalog";

const Stored = Schema.Struct({ revision: NonNegativeInt, document: Schema.String });
const StoredJson = Schema.fromJsonString(Stored);
const decodeStored = Schema.decodeUnknownEffect(StoredJson);
const encodeStored = Schema.encodeEffect(StoredJson);

export class ConnectionCatalogStoreError extends Schema.TaggedError<ConnectionCatalogStoreError>()(
  "ConnectionCatalogStoreError",
  { cause: Schema.Defect() },
) {
  override get message(): string {
    return "Failed to read or write the saved environments.";
  }
}

/** The caller wrote from a revision that is no longer the stored one. */
export class ConnectionCatalogConflictError extends Schema.TaggedError<ConnectionCatalogConflictError>()(
  "ConnectionCatalogConflictError",
  { revision: NonNegativeInt },
) {
  override get message(): string {
    return "The saved environments changed since they were read.";
  }
}

export class ConnectionCatalogTooLargeError extends Schema.TaggedError<ConnectionCatalogTooLargeError>()(
  "ConnectionCatalogTooLargeError",
  {},
) {
  override get message(): string {
    return "The saved environments are too large to store.";
  }
}

/**
 * The saved-environments document the browsers signed in to this environment share. It holds the
 * bearer tokens of other environments, so it lives in the secret store, and the server never
 * interprets it: the clients own its shape.
 */
export class ConnectionCatalog extends Context.Service<
  ConnectionCatalog,
  {
    readonly get: Effect.Effect<EnvironmentConnectionCatalog, ConnectionCatalogStoreError>;
    readonly put: (input: {
      readonly baseRevision: number;
      readonly document: string;
    }) => Effect.Effect<
      { readonly revision: number },
      ConnectionCatalogConflictError | ConnectionCatalogTooLargeError | ConnectionCatalogStoreError
    >;
  }
>()("t3/connectionCatalog/ConnectionCatalog") {}

const make = Effect.gen(function* () {
  const secrets = yield* ServerSecretStore.ServerSecretStore;
  const lock = yield* Semaphore.make(1);

  const read = secrets.get(SECRET_NAME).pipe(
    Effect.flatMap((stored): Effect.Effect<EnvironmentConnectionCatalog, Schema.SchemaError> =>
      Option.isNone(stored)
        ? Effect.succeed({ revision: 0, document: null })
        : decodeStored(new TextDecoder().decode(stored.value)),
    ),
    Effect.mapError((cause) => new ConnectionCatalogStoreError({ cause })),
  );

  const put = Effect.fn("ConnectionCatalog.put")(function* (input: {
    readonly baseRevision: number;
    readonly document: string;
  }) {
    if (new TextEncoder().encode(input.document).length > CONNECTION_CATALOG_MAX_BYTES) {
      return yield* new ConnectionCatalogTooLargeError();
    }
    return yield* lock.withPermits(1)(
      Effect.gen(function* () {
        const current = yield* read;
        if (current.revision !== input.baseRevision) {
          return yield* new ConnectionCatalogConflictError({ revision: current.revision });
        }
        const revision = current.revision + 1;
        yield* encodeStored({ revision, document: input.document }).pipe(
          Effect.flatMap((encoded) => secrets.set(SECRET_NAME, new TextEncoder().encode(encoded))),
          Effect.mapError((cause) => new ConnectionCatalogStoreError({ cause })),
        );
        return { revision };
      }),
    );
  });

  return ConnectionCatalog.of({ get: read, put });
});

export const layer = Layer.effect(ConnectionCatalog, make);
