import { expect, it } from "@effect/vitest";
import { ServerNpmReleaseError } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import * as Result from "effect/Result";
import * as TestClock from "effect/testing/TestClock";

import * as NpmRelease from "./npmRelease.ts";

const digest = "a".repeat(64);
const latestRelease = (tag: string, assetDigest: string | null = `sha256:${digest}`) =>
  JSON.stringify({
    tag_name: tag,
    assets: [
      {
        name: "ae-code-linux-x64.tar.gz",
        browser_download_url: "https://example.test/ae-code-linux-x64.tar.gz",
        digest: assetDigest,
      },
    ],
  });

const makeService = (respond: () => Response) => {
  const urls: string[] = [];
  const http = HttpClient.make((request) => {
    urls.push(request.url);
    return Effect.succeed(HttpClientResponse.fromWeb(request, respond()));
  });
  return NpmRelease.make().pipe(
    Effect.provideService(HttpClient.HttpClient, http),
    Effect.map((service) => ({ service, urls })),
  );
};

it.effect.each([
  { tag: "v2026.11.09", version: "2026.1109.0" },
  { tag: "v2026.11.09.2", version: "2026.1109.2" },
  { tag: "v2026.12.31", version: "2026.1231.0" },
])("reads the latest release of the fork from GitHub: $tag", ({ tag, version }) =>
  Effect.gen(function* () {
    const { service, urls } = yield* makeService(() => new Response(latestRelease(tag)));
    expect(yield* service.get({ spec: "latest" })).toEqual({ version });
    expect(yield* service.get({ spec: "latest" })).toEqual({ version });
    expect(urls).toEqual(["https://api.github.com/repos/SelfRef/ae-code/releases/latest"]);
    yield* TestClock.adjust("1 minute");
    yield* service.get({ spec: "latest" });
    expect(urls).toHaveLength(2);
  }),
);

it.effect("has no release for another spec and never asks GitHub", () =>
  Effect.gen(function* () {
    const { service, urls } = yield* makeService(() => new Response(latestRelease("v2026.11.09")));
    expect(yield* service.get({ spec: "nightly" })).toBeNull();
    expect(yield* service.get({ spec: "1.2.3" })).toBeNull();
    expect(urls).toEqual([]);
  }),
);

it.effect.each([
  { name: "an unreadable answer", respond: () => new Response("nope") },
  { name: "a rate limit", respond: () => new Response("{}", { status: 403 }) },
  {
    name: "a tag that is no date",
    respond: () => new Response(latestRelease("v0.1.8-nightly.1.2")),
  },
  {
    name: "an asset without a checksum",
    respond: () => new Response(latestRelease("v2026.11.09", null)),
  },
])("reports an unavailable lookup for $name", ({ respond }) =>
  Effect.gen(function* () {
    const { service } = yield* makeService(respond);
    const found = yield* service.get({ spec: "latest" }).pipe(Effect.result);
    expect(Result.isFailure(found) && found.failure).toBeInstanceOf(ServerNpmReleaseError);
  }),
);

it.effect.each(["--registry=https://example.com", "../other", "*", ""])(
  "rejects the invalid release spec %j",
  (spec) =>
    Effect.gen(function* () {
      const { service } = yield* makeService(() => new Response("{}"));
      expect(Result.isFailure(yield* service.get({ spec }).pipe(Effect.result))).toBe(true);
    }),
);
