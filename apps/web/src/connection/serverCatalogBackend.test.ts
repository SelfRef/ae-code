import {
  BearerConnectionCredential,
  BearerConnectionProfile,
  BearerConnectionRegistration,
  BearerConnectionTarget,
} from "@t3tools/client-runtime/connection";
import {
  ConnectionCatalogDocument,
  registerConnectionInCatalog,
} from "@t3tools/client-runtime/platform";
import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { CatalogRemoteError, type CatalogRemote, withSharedCatalog } from "./serverCatalogBackend";
import { makeCatalogStore } from "./storage";

const decode = Schema.decodeUnknownSync(Schema.fromJsonString(ConnectionCatalogDocument));

function register(id: string) {
  return new BearerConnectionRegistration({
    target: new BearerConnectionTarget({
      environmentId: EnvironmentId.make(id),
      label: id,
      connectionId: `connection-${id}`,
    }),
    profile: new BearerConnectionProfile({
      connectionId: `connection-${id}`,
      environmentId: EnvironmentId.make(id),
      label: id,
      httpBaseUrl: `https://${id}.example.test`,
      wsBaseUrl: `wss://${id}.example.test`,
    }),
    credential: new BearerConnectionCredential({ token: `token-${id}` }),
  });
}

function makeServer() {
  const server = { revision: 0, document: null as string | null, puts: 0 };
  const remote: CatalogRemote = {
    get: Effect.sync(() => ({ revision: server.revision, document: server.document })),
    put: ({ baseRevision, document }) =>
      baseRevision === server.revision
        ? Effect.sync(() => {
            server.revision += 1;
            server.document = document;
            server.puts += 1;
            return { revision: server.revision };
          })
        : Effect.fail(new CatalogRemoteError({ kind: "conflict", cause: "stale" })),
  };
  return { server, remote };
}

function makeDevice() {
  const stored = { raw: null as string | null };
  return {
    stored,
    backend: {
      read: Effect.sync(() => stored.raw),
      write: (raw: string) =>
        Effect.sync(() => {
          stored.raw = raw;
        }),
    },
  };
}

const sharedEnvironments = (server: { document: string | null }) =>
  server.document === null ? [] : decode(server.document).targets.map((t) => t.environmentId);

describe("withSharedCatalog", () => {
  it.effect("shares one catalog between devices and re-applies a change after a conflict", () =>
    Effect.gen(function* () {
      const { server, remote } = makeServer();
      const first = makeDevice();
      const second = makeDevice();
      const firstStore = yield* makeCatalogStore(yield* withSharedCatalog(first.backend, remote));
      const secondStore = yield* makeCatalogStore(yield* withSharedCatalog(second.backend, remote));

      yield* firstStore.read;
      yield* secondStore.read;
      yield* firstStore.update((c) => registerConnectionInCatalog(c, register("alpha")));
      // The second device still holds revision 0: its first write conflicts, reloads, and lands.
      yield* secondStore.update((c) => registerConnectionInCatalog(c, register("beta")));

      expect(sharedEnvironments(server)).toEqual(["alpha", "beta"]);
      const third = yield* makeCatalogStore(yield* withSharedCatalog(makeDevice().backend, remote));
      expect((yield* third.read).targets.map((t) => t.environmentId)).toEqual(["alpha", "beta"]);
    }),
  );

  it.effect("carries a removal to a device that synced before", () =>
    Effect.gen(function* () {
      const { server, remote } = makeServer();
      const first = makeDevice();
      const second = makeDevice();
      const firstStore = yield* makeCatalogStore(yield* withSharedCatalog(first.backend, remote));
      yield* firstStore.read;
      yield* firstStore.update((c) => registerConnectionInCatalog(c, register("alpha")));
      const secondStore = yield* makeCatalogStore(yield* withSharedCatalog(second.backend, remote));
      yield* secondStore.read;
      yield* secondStore.update((c) => ({ ...c, targets: [], profiles: [], credentials: [] }));
      expect(sharedEnvironments(server)).toEqual([]);

      const reloaded = yield* makeCatalogStore(yield* withSharedCatalog(first.backend, remote));
      expect((yield* reloaded.read).targets).toEqual([]);
    }),
  );

  it.effect("does not call the server for a change that leaves the shared part alone", () =>
    Effect.gen(function* () {
      const { server, remote } = makeServer();
      const store = yield* makeCatalogStore(yield* withSharedCatalog(makeDevice().backend, remote));
      yield* store.read;
      yield* store.update((c) => registerConnectionInCatalog(c, register("alpha")));
      expect(server.puts).toBe(1);
      yield* store.update((c) => ({ ...c, githubRoutingPermissions: [] }));
      expect(server.puts).toBe(1);
    }),
  );

  it.effect("stays on the device when the server has no such endpoint", () =>
    Effect.gen(function* () {
      const device = makeDevice();
      const remote: CatalogRemote = {
        get: Effect.fail(new CatalogRemoteError({ kind: "unsupported", cause: "404" })),
        put: () => Effect.die("unreachable"),
      };
      const store = yield* makeCatalogStore(yield* withSharedCatalog(device.backend, remote));
      yield* store.update((c) => registerConnectionInCatalog(c, register("alpha")));
      expect(decode(device.stored.raw!).targets).toHaveLength(1);
    }),
  );

  it.effect(
    "refuses a shared change while the server is unreachable instead of losing it later",
    () =>
      Effect.gen(function* () {
        const device = makeDevice();
        const remote: CatalogRemote = {
          get: Effect.fail(new CatalogRemoteError({ kind: "unavailable", cause: "offline" })),
          put: () => Effect.die("unreachable"),
        };
        const store = yield* makeCatalogStore(yield* withSharedCatalog(device.backend, remote));
        yield* Effect.flip(store.update((c) => registerConnectionInCatalog(c, register("alpha"))));
        expect(device.stored.raw).toBeNull();
      }),
  );
});
