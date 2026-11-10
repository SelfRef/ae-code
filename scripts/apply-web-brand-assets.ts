#!/usr/bin/env node

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import { Argument, Command } from "effect/cli";
import { resolveWebIconOverrides } from "./lib/brand-assets.ts";

export const applyWebBrandAssets = Effect.fn("applyWebBrandAssets")(function* (
  targetDirectory: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* path.fromFileUrl(new URL("..", import.meta.url));

  yield* Effect.forEach(
    resolveWebIconOverrides(path.resolve(repoRoot, targetDirectory)),
    (override) =>
      fs.copyFile(path.join(repoRoot, override.sourceRelativePath), override.targetRelativePath),
    { concurrency: "unbounded" },
  );
});

export const applyWebBrandAssetsCommand = Command.make(
  "apply-web-brand-assets",
  {
    targetDirectory: Argument.String("target-directory").pipe(
      Argument.withDescription("Output directory that contains the hosted web build assets."),
      Argument.optional,
    ),
  },
  ({ targetDirectory }) =>
    applyWebBrandAssets(Option.getOrElse(targetDirectory, () => "apps/web/dist")),
).pipe(Command.withDescription("Copy web brand assets into a built hosted web app."));

if (import.meta.main) {
  Command.run(applyWebBrandAssetsCommand, { version: "0.0.0" }).pipe(
    Effect.provide(NodeServices.layer),
    NodeRuntime.runMain,
  );
}
