import { AuthAccessWriteScope, EnvironmentHttpApi } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";

import {
  annotateEnvironmentRequest,
  failEnvironmentInternal,
  failEnvironmentInvalidRequest,
  requireEnvironmentScope,
} from "../auth/http.ts";
import * as ConnectionCatalog from "./ConnectionCatalog.ts";

// Both calls need `access:write`: the document carries other environments' bearer tokens.
export const layer = HttpApiBuilder.group(
  EnvironmentHttpApi,
  "connectionCatalog",
  Effect.fnUntraced(function* (handlers) {
    const catalog = yield* ConnectionCatalog.ConnectionCatalog;
    const guard = Effect.fnUntraced(function* (endpoint: string) {
      yield* annotateEnvironmentRequest(endpoint);
      yield* requireEnvironmentScope(AuthAccessWriteScope);
    });
    return handlers
      .handle(
        "get",
        Effect.fn("environment.connectionCatalog.get")(function* (args) {
          yield* guard(args.endpoint.name);
          return yield* catalog.get.pipe(
            Effect.catch((error) => failEnvironmentInternal("internal_error", error)),
          );
        }),
      )
      .handle(
        "put",
        Effect.fn("environment.connectionCatalog.put")(function* (args) {
          yield* guard(args.endpoint.name);
          return yield* catalog.put(args.payload).pipe(
            Effect.catchTags({
              ConnectionCatalogConflictError: () =>
                failEnvironmentInvalidRequest("connection_catalog_conflict"),
              ConnectionCatalogTooLargeError: () =>
                failEnvironmentInvalidRequest("connection_catalog_too_large"),
              ConnectionCatalogStoreError: (error) =>
                failEnvironmentInternal("internal_error", error),
            }),
          );
        }),
      );
  }),
);
