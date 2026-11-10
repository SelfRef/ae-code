import {
  ServerNpmReleaseError,
  ServerNpmReleaseInput,
  type ServerNpmRelease,
} from "@t3tools/contracts";
import * as Cache from "effect/Cache";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { FetchHttpClient, HttpClient } from "effect/http";

import { fetchLatestRelease } from "./forkRelease.ts";

const decodeInput = Schema.decodeUnknownEffect(ServerNpmReleaseInput);

/**
 * The newest release of this fork. The RPC keeps its name from upstream, which looks the version up
 * on npm; the fork publishes GitHub releases only, so `latest` is read from there and any other
 * spec has no release.
 */
export class NpmRelease extends Context.Service<
  NpmRelease,
  {
    readonly get: (
      input: ServerNpmReleaseInput,
    ) => Effect.Effect<ServerNpmRelease | null, ServerNpmReleaseError>;
  }
>()("t3/cloud/npmRelease") {}

export const make = Effect.fn("NpmRelease.make")(function* () {
  const http = yield* HttpClient.HttpClient;
  // GitHub allows 60 anonymous requests an hour per address.
  const latest = yield* Cache.make({
    capacity: 1,
    timeToLive: Duration.minutes(1),
    lookup: () =>
      fetchLatestRelease().pipe(
        Effect.provideService(HttpClient.HttpClient, http),
        Effect.map(({ version }): ServerNpmRelease => ({ version })),
        Effect.mapError((error) => new ServerNpmReleaseError({ reason: error.reason })),
      ),
  });
  return NpmRelease.of({
    get: Effect.fn("NpmRelease.get")(function* (input) {
      const { spec } = yield* decodeInput(input).pipe(
        Effect.mapError(
          () => new ServerNpmReleaseError({ reason: "Invalid release version or track." }),
        ),
      );
      return spec === "latest" ? yield* Cache.get(latest, "latest") : null;
    }),
  });
});

export const layer = Layer.effect(NpmRelease, make()).pipe(Layer.provide(FetchHttpClient.layer));
