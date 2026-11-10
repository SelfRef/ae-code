import {
  EnvironmentAuthInvalidError,
  EnvironmentRequestInvalidError,
  EnvironmentScopeRequiredError,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { HttpClientError } from "effect/http";

import { PrimaryEnvironmentHttpClient } from "../environments/primary/httpClient";
import { runPrimaryHttp } from "../lib/runtime";
import { CatalogRemoteError, type CatalogRemote } from "./serverCatalogBackend";

const isInvalidRequest = Schema.is(EnvironmentRequestInvalidError);
const isNotAllowed = Schema.is(
  Schema.Union([EnvironmentAuthInvalidError, EnvironmentScopeRequiredError]),
);

function failureKind(cause: unknown): CatalogRemoteError["kind"] {
  if (isInvalidRequest(cause)) {
    return cause.reason === "connection_catalog_conflict" ? "conflict" : "unavailable";
  }
  // Signed out, a session without access to it, a server without it, or a host that answers with
  // something else (a static site): nothing to retry on this page.
  if (isNotAllowed(cause) || Schema.isSchemaError(cause)) return "unsupported";
  if (HttpClientError.isHttpClientError(cause) && cause.response !== undefined) {
    const { status } = cause.response;
    return status === 404 || status < 300 ? "unsupported" : "unavailable";
  }
  return "unavailable";
}

const run = <A, E>(
  request: (client: Effect.Success<typeof PrimaryEnvironmentHttpClient>) => Effect.Effect<A, E>,
) =>
  Effect.tryPromise({
    try: () => runPrimaryHttp(PrimaryEnvironmentHttpClient.pipe(Effect.flatMap(request))),
    catch: (cause) => new CatalogRemoteError({ kind: failureKind(cause), cause }),
  });

/** The environment this page was served from, with the browser's own session. */
export const primaryCatalogRemote: CatalogRemote = {
  get: run((client) => client.connectionCatalog.get({ headers: {} })),
  put: (payload) => run((client) => client.connectionCatalog.put({ headers: {}, payload })),
};
