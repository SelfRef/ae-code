import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { CONNECTION_CATALOG_MAX_BYTES } from "@t3tools/contracts";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import * as ServerConfig from "../config.ts";
import * as ConnectionCatalog from "./ConnectionCatalog.ts";

const layerTest = ConnectionCatalog.layer.pipe(
  Layer.provideMerge(ServerSecretStore.layer),
  Layer.provide(ServerConfig.layerTest(process.cwd(), { prefix: "t3-connection-catalog-test-" })),
);

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))("ConnectionCatalog", (it) => {
  it.effect("accepts a write only from the stored revision", () =>
    Effect.gen(function* () {
      const catalog = yield* ConnectionCatalog.ConnectionCatalog;
      assert.deepStrictEqual(yield* catalog.get, { revision: 0, document: null });

      assert.deepStrictEqual(yield* catalog.put({ baseRevision: 0, document: "first" }), {
        revision: 1,
      });
      assert.deepStrictEqual(yield* catalog.get, { revision: 1, document: "first" });

      const stale = yield* Effect.flip(catalog.put({ baseRevision: 0, document: "stale" }));
      assert.strictEqual(stale._tag, "ConnectionCatalogConflictError");
      assert.deepStrictEqual(yield* catalog.get, { revision: 1, document: "first" });
    }).pipe(Effect.provide(layerTest)),
  );

  it.effect("refuses a document over the size limit", () =>
    Effect.gen(function* () {
      const catalog = yield* ConnectionCatalog.ConnectionCatalog;
      const error = yield* Effect.flip(
        catalog.put({ baseRevision: 0, document: "x".repeat(CONNECTION_CATALOG_MAX_BYTES + 1) }),
      );
      assert.strictEqual(error._tag, "ConnectionCatalogTooLargeError");
    }).pipe(Effect.provide(layerTest)),
  );

  it.effect("serializes concurrent writes from the same revision", () =>
    Effect.gen(function* () {
      const catalog = yield* ConnectionCatalog.ConnectionCatalog;
      const results = yield* Effect.all(
        [
          Effect.exit(catalog.put({ baseRevision: 0, document: "a" })),
          Effect.exit(catalog.put({ baseRevision: 0, document: "b" })),
        ],
        { concurrency: "unbounded" },
      );
      assert.strictEqual(results.filter((exit) => exit._tag === "Success").length, 1);
      assert.strictEqual((yield* catalog.get).revision, 1);
    }).pipe(Effect.provide(layerTest)),
  );
});
