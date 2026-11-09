import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";

import { applyManagedNpmInstallStatus, withManagedNpmBinDirectory } from "./managedNpmInstall.ts";

const provider = (overrides: Partial<ServerProvider>): ServerProvider => ({
  instanceId: ProviderInstanceId.make("claudeAgent"),
  driver: ProviderDriverKind.make("claudeAgent"),
  enabled: true,
  installed: false,
  version: null,
  status: "error",
  auth: { status: "unknown" },
  setup: { canAuthenticate: false, canInstall: false },
  checkedAt: "2026-04-10T00:00:00.000Z",
  models: [],
  slashCommands: [],
  skills: [],
  ...overrides,
});

const withHome = <A, E, R>(effect: Effect.Effect<A, E, R>, home: string) =>
  effect.pipe(
    Effect.provideService(HostProcess.HomeDirectory, home),
    Effect.provideService(HostProcess.Platform, "linux"),
  );

describe("managed npm install", () => {
  it.effect("appends the prefix bin to PATH only for the default command of a managed driver", () =>
    withHome(
      Effect.gen(function* () {
        const env = { PATH: "/usr/bin:/bin" };
        const appended = { PATH: "/usr/bin:/bin:/home/u/.local/bin" };
        assert.deepEqual(yield* withManagedNpmBinDirectory("claudeAgent", "claude", env), appended);
        assert.deepEqual(yield* withManagedNpmBinDirectory("opencode", "", env), {
          PATH: "/usr/bin:/bin:/home/u/.local/bin",
        });
        // A configured path, another driver, an earlier entry, and a missing PATH stay as they are.
        assert.strictEqual(
          yield* withManagedNpmBinDirectory("claudeAgent", "/opt/claude", env),
          env,
        );
        assert.strictEqual(yield* withManagedNpmBinDirectory("codex", "codex", env), env);
        assert.strictEqual(
          yield* withManagedNpmBinDirectory("claudeAgent", "claude", appended),
          appended,
        );
        assert.deepEqual(yield* withManagedNpmBinDirectory("claudeAgent", "claude", {}), {});
        assert.deepEqual(yield* withManagedNpmBinDirectory("claudeAgent", "claude", { PATH: "" }), {
          PATH: "",
        });
        assert.strictEqual(
          yield* withManagedNpmBinDirectory("claudeAgent", "claude", env).pipe(
            Effect.provideService(HostProcess.Platform, "win32"),
          ),
          env,
        );
      }),
      "/home/u/",
    ),
  );

  it.effect("offers the install while the CLI is missing and says where a managed copy is", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const home = yield* fs.makeTempDirectoryScoped({ prefix: "t3-managed-npm-" });
      const other = yield* fs.makeTempDirectoryScoped({ prefix: "t3-managed-npm-path-" });
      yield* withHome(
        Effect.gen(function* () {
          const env = { PATH: `${other}:${home}/.local/bin` };
          const missing = provider({});
          const offered = yield* applyManagedNpmInstallStatus(missing, "claude", env);
          assert.deepEqual(offered.setup, { canAuthenticate: false, canInstall: true });
          for (const unchanged of [
            yield* applyManagedNpmInstallStatus(missing, "/opt/claude", env),
            yield* applyManagedNpmInstallStatus(provider({ enabled: false }), "claude", env),
            yield* applyManagedNpmInstallStatus(
              provider({ driver: ProviderDriverKind.make("codex") }),
              "codex",
              env,
            ),
          ]) {
            assert.isFalse(unchanged.setup?.canInstall);
          }

          const installed = provider({ installed: true, status: "ready" });
          assert.deepEqual(
            yield* applyManagedNpmInstallStatus(installed, "claude", env),
            installed,
          );
          yield* fs.makeDirectory(`${home}/.local/bin`, { recursive: true });
          yield* fs.writeFileString(`${home}/.local/bin/claude`, "#!/bin/sh\n");
          const found = yield* applyManagedNpmInstallStatus(installed, "claude", env);
          assert.strictEqual(
            found.message,
            `Found at ${home}/.local/bin/claude, which is not on PATH.`,
          );
          assert.isFalse(found.setup?.canInstall);
          const warned = yield* applyManagedNpmInstallStatus(
            provider({ installed: true, message: "Sign in." }),
            "claude",
            env,
          );
          assert.strictEqual(
            warned.message,
            `Sign in. Found at ${home}/.local/bin/claude, which is not on PATH.`,
          );
          // A managed launcher that fails to start is an interrupted install: keep the install row.
          assert.isTrue(warned.setup?.canInstall);

          // A copy earlier on PATH is the one that runs, so nothing is added. A new PATH
          // sidesteps the resolver's cache of the earlier miss.
          const earlier = yield* fs.makeTempDirectoryScoped({ prefix: "t3-managed-npm-earlier-" });
          yield* fs.writeFileString(`${earlier}/claude`, "#!/bin/sh\n");
          yield* fs.chmod(`${earlier}/claude`, 0o755);
          assert.deepEqual(
            yield* applyManagedNpmInstallStatus(installed, "claude", {
              PATH: `${earlier}:${home}/.local/bin`,
            }),
            installed,
          );
        }),
        home,
      );
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );
});
