import * as NodeServices from "@effect/platform-node/NodeServices";
import { it as effectIt } from "@effect/vitest";
import { expect, vi } from "vite-plus/test";
import {
  AuthAccessWriteScope,
  AuthOrchestrationOperateScope,
  AuthSessionId,
  type AuthEnvironmentScope,
  EnvironmentAuthenticatedAuth,
  EnvironmentAuthenticatedPrincipal,
  EnvironmentConnectionCatalogHttpApi,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";

import * as ConnectionCatalog from "./ConnectionCatalog.ts";
import { layer } from "./http.ts";

const decodeSessionId = Schema.decodeUnknownSync(AuthSessionId);

const principal = (...scopes: AuthEnvironmentScope[]) =>
  Layer.succeed(EnvironmentAuthenticatedAuth, (effect) =>
    effect.pipe(
      Effect.provideService(EnvironmentAuthenticatedPrincipal, {
        sessionId: decodeSessionId("catalog-test"),
        subject: "test",
        method: "bearer-access-token",
        scopes: new Set(scopes),
      }),
    ),
  );

const makeCall = (
  scopes: AuthEnvironmentScope[],
  service: Partial<ConnectionCatalog.ConnectionCatalog["Service"]>,
) =>
  Effect.gen(function* () {
    const { handler, dispose } = HttpRouter.toWebHandler(
      HttpApiBuilder.layer(
        HttpApi.make("environment").add(EnvironmentConnectionCatalogHttpApi),
      ).pipe(
        Layer.provide(layer),
        Layer.provide(principal(...scopes)),
        Layer.provide(Layer.mock(ConnectionCatalog.ConnectionCatalog)(service)),
        Layer.provide(HttpServer.layerServices),
        Layer.provide(NodeServices.layer),
      ),
      { disableLogger: true },
    );
    yield* Effect.addFinalizer(() => Effect.promise(dispose));
    const context = yield* Layer.build(NodeServices.layer);
    return (init?: RequestInit) =>
      Effect.promise(() =>
        handler(new Request("http://localhost/api/connection-catalog", init), context),
      );
  });

const put = (body: unknown): RequestInit => ({
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

effectIt.effect("refuses a session without access:write, which would read other tokens", () =>
  Effect.gen(function* () {
    const get = vi.fn(() => Effect.succeed({ revision: 1, document: "secret" }));
    const write = vi.fn(() => Effect.succeed({ revision: 2 }));
    const call = yield* makeCall([AuthOrchestrationOperateScope], {
      get: Effect.suspend(get),
      put: write,
    });
    expect((yield* call()).status).toBe(403);
    expect((yield* call(put({ baseRevision: 1, document: "x" }))).status).toBe(403);
    expect(get).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  }).pipe(Effect.scoped),
);

effectIt.effect("reads and writes with access:write and reports a stale write as a conflict", () =>
  Effect.gen(function* () {
    const call = yield* makeCall([AuthAccessWriteScope], {
      get: Effect.succeed({ revision: 1, document: "doc" }),
      put: ({ baseRevision }) =>
        baseRevision === 1
          ? Effect.succeed({ revision: 2 })
          : Effect.fail(new ConnectionCatalog.ConnectionCatalogConflictError({ revision: 1 })),
    });
    const read = yield* call();
    expect(yield* Effect.promise(() => read.json())).toEqual({ revision: 1, document: "doc" });
    const saved = yield* call(put({ baseRevision: 1, document: "next" }));
    expect(yield* Effect.promise(() => saved.json())).toEqual({ revision: 2 });
    const stale = yield* call(put({ baseRevision: 0, document: "next" }));
    expect(stale.status).toBe(400);
    expect(yield* Effect.promise(() => stale.json())).toMatchObject({
      reason: "connection_catalog_conflict",
    });
  }).pipe(Effect.scoped),
);
