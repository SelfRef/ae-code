import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import { ProviderDriverKind } from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as Scope from "effect/Scope";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

import * as NpmPackageInstallation from "./NpmPackageInstallation.ts";

const claude = ProviderDriverKind.make("claudeAgent");
const opencode = ProviderDriverKind.make("opencode");
const encoder = new TextEncoder();

const handle = (input: {
  readonly output?: string;
  readonly exitCode: Effect.Effect<ChildProcessSpawner.ExitCode>;
}) =>
  ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(900_000_401),
    exitCode: input.exitCode,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    unref: Effect.succeed(Effect.void),
    stdin: Sink.drain,
    stdout: Stream.empty,
    stderr: Stream.empty,
    all: input.output === undefined ? Stream.empty : Stream.make(encoder.encode(input.output)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
  });

const exited = (code: number) => Effect.succeed(ChildProcessSpawner.ExitCode(code));

const makeHarness = Effect.fn("test.makeNpmPackageInstallation")(function* (
  options: {
    readonly spawn?: (
      home: string,
    ) => Effect.Effect<
      ChildProcessSpawner.ChildProcessHandle,
      PlatformError.PlatformError,
      Scope.Scope | FileSystem.FileSystem
    >;
    readonly platform?: NodeJS.Platform;
    readonly preinstalled?: boolean;
  } = {},
) {
  const fs = yield* FileSystem.FileSystem;
  const home = yield* fs.makeTempDirectoryScoped({ prefix: "t3-npm-install-" });
  const spawns: Array<{ readonly command: string; readonly args: ReadonlyArray<string> }> = [];
  if (options.preinstalled) yield* writePackage(home, "@anthropic-ai/claude-code", "1.2.3");
  const spawner = ChildProcessSpawner.make((command) => {
    if (!ChildProcess.isStandardCommand(command)) return Effect.die("Unexpected spawn.");
    spawns.push({ command: command.command, args: command.args.map(String) });
    return (options.spawn ?? (() => Effect.die("Unexpected spawn.")))(home).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
    );
  });
  const host = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.provideService(HostProcess.HomeDirectory, home),
      Effect.provideService(HostProcess.Platform, options.platform ?? "linux"),
      Effect.provideService(HostProcess.Environment, { PATH: "" }),
    );
  const context = yield* host(
    Layer.build(
      NpmPackageInstallation.layer.pipe(
        // NodeServices carries a real spawner, so the fake must satisfy it first.
        Layer.provide(Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner)),
        Layer.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)),
      ),
    ),
  );
  const service = Context.get(context, NpmPackageInstallation.NpmPackageInstallation);
  const terminal = (driver: ProviderDriverKind) =>
    host(
      service.changes(driver).pipe(
        Stream.filter((state) => ["succeeded", "failed", "cancelled"].includes(state.phase)),
        Stream.runHead,
        Effect.map(Option.getOrThrow),
        Effect.orDie,
      ),
    );
  return { home, spawns, service, host, terminal };
});

const writePackage = Effect.fn("test.writeNpmPackage")(function* (
  home: string,
  packageName: string,
  version: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const directory = `${home}/.local/lib/node_modules/${packageName}`;
  yield* fs.makeDirectory(directory, { recursive: true });
  yield* fs.writeFileString(`${directory}/package.json`, JSON.stringify({ version }));
});

const writeLauncher = Effect.fn("test.writeNpmLauncher")(function* (home: string, binary: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(`${home}/.local/bin`, { recursive: true });
  yield* fs.writeFileString(`${home}/.local/bin/${binary}`, "#!/bin/sh\n");
});

const installs = (packageName: string, binary: string) => (home: string) =>
  Effect.gen(function* () {
    yield* writePackage(home, packageName, "2.1.0");
    yield* writeLauncher(home, binary);
    return handle({ output: "added 1 package", exitCode: exited(0) });
  }).pipe(Effect.orDie);

describe("NpmPackageInstallation", () => {
  it.effect.each([
    { driver: claude, packageName: "@anthropic-ai/claude-code", binary: "claude" },
    { driver: opencode, packageName: "@opencode/cli", binary: "opencode" },
  ] as const)(
    "installs $packageName into the ~/.local prefix and records what it installed",
    ({ driver, packageName, binary }) =>
      Effect.gen(function* () {
        const { home, spawns, service, host, terminal } = yield* makeHarness({
          spawn: installs(packageName, binary),
        });
        const started = yield* host(service.start(driver));
        assert.strictEqual(started.phase, "installing");
        const finished = yield* terminal(driver);
        assert.deepEqual(finished, {
          ...started,
          phase: "succeeded",
          installedVersion: "2.1.0",
          executablePath: `${home}/.local/bin/${binary}`,
          source: "managed",
          message: `Installed ${packageName} 2.1.0.`,
        });
        assert.deepEqual(spawns, [
          {
            command: "npm",
            args: [
              "install",
              "-g",
              "--prefix",
              `${home}/.local`,
              `--allow-scripts=${packageName}`,
              packageName,
            ],
          },
        ]);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );

  it.effect("starts from the version an earlier install left behind", () =>
    Effect.gen(function* () {
      const { service, host } = yield* makeHarness({ preinstalled: true });
      const state = yield* host(service.state(claude));
      assert.deepEqual([state.phase, state.installedVersion], ["idle", "1.2.3"]);
      assert.isNull((yield* host(service.state(opencode))).installedVersion);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );

  it.effect("fails with a bounded, redacted tail of npm's output", () =>
    Effect.gen(function* () {
      const { service, host, terminal } = yield* makeHarness({
        spawn: () =>
          Effect.succeed(
            handle({
              output: `${"noise ".repeat(2_000)}\nnpm error config _authToken=secret-value\nnpm error fetch https://user:hunter2@registry.example/pkg\nnpm error Authorization: Basic c2VjcmV0\nnpm error EACCES`,
              exitCode: exited(1),
            }),
          ),
      });
      yield* host(service.start(claude));
      const finished = yield* terminal(claude);
      assert.strictEqual(finished.phase, "failed");
      assert.include(finished.message, "exit code 1");
      assert.include(finished.message, "EACCES");
      assert.include(finished.message, "_authToken=[redacted]");
      assert.notInclude(finished.message, "secret-value");
      assert.notInclude(finished.message, "hunter2");
      assert.notInclude(finished.message, "c2VjcmV0");
      assert.isBelow(finished.message?.length ?? 0, 800);
      assert.isNull(finished.installedVersion);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );

  it.effect("says when npm is missing", () =>
    Effect.gen(function* () {
      const { service, host, terminal } = yield* makeHarness({
        spawn: () =>
          Effect.fail(
            PlatformError.systemError({
              _tag: "NotFound",
              module: "ChildProcess",
              method: "spawn",
            }),
          ),
      });
      yield* host(service.start(opencode));
      const finished = yield* terminal(opencode);
      assert.strictEqual(finished.phase, "failed");
      assert.include(finished.message, "npm was not found");
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );

  it.effect("fails when npm exits cleanly but leaves no launcher", () =>
    Effect.gen(function* () {
      const { service, host, terminal } = yield* makeHarness({
        spawn: () => Effect.succeed(handle({ exitCode: exited(0) })),
      });
      yield* host(service.start(claude));
      const finished = yield* terminal(claude);
      assert.strictEqual(finished.phase, "failed");
      assert.include(finished.message, "was not created");
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );

  it.effect("joins a running install and kills npm when it is cancelled", () =>
    Effect.gen(function* () {
      const spawned = yield* Deferred.make<void>();
      const killed = yield* Deferred.make<void>();
      const { spawns, service, host, terminal } = yield* makeHarness({
        spawn: () =>
          Effect.acquireRelease(
            Deferred.succeed(spawned, undefined).pipe(
              Effect.as(handle({ exitCode: Effect.never })),
            ),
            () => Deferred.succeed(killed, undefined),
          ),
      });
      const first = yield* host(service.start(claude));
      yield* Deferred.await(spawned);
      const second = yield* host(service.start(claude));
      assert.strictEqual(second.operationId, first.operationId);
      assert.strictEqual(spawns.length, 1);
      const stale = yield* Effect.flip(host(service.cancel(claude, "stale-operation")));
      assert.include(stale.detail, "no longer current");
      const cancelled = yield* host(service.cancel(claude, first.operationId ?? ""));
      yield* Deferred.await(killed);
      assert.strictEqual(cancelled.phase, "cancelled");
      assert.strictEqual((yield* terminal(claude)).phase, "cancelled");
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );

  it.effect("removes the launcher npm linked when an install it started is cancelled", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const linked = yield* Deferred.make<void>();
      const { home, service, host } = yield* makeHarness({
        spawn: (home) =>
          Effect.gen(function* () {
            yield* writePackage(home, "@anthropic-ai/claude-code", "2.1.0");
            yield* writeLauncher(home, "claude");
            yield* Deferred.succeed(linked, undefined);
            return handle({ exitCode: Effect.never });
          }).pipe(Effect.orDie),
      });
      const started = yield* host(service.start(claude));
      yield* Deferred.await(linked);
      yield* host(service.cancel(claude, started.operationId ?? ""));
      assert.isFalse(yield* fs.exists(`${home}/.local/bin/claude`));
      assert.isFalse(yield* fs.exists(`${home}/.local/lib/node_modules/@anthropic-ai/claude-code`));
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );

  it.effect("keeps a launcher that was there before a failed install", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { home, service, host, terminal } = yield* makeHarness({
        spawn: () => Effect.succeed(handle({ exitCode: exited(1) })),
      });
      yield* writeLauncher(home, "claude");
      yield* host(service.start(claude));
      assert.strictEqual((yield* terminal(claude)).phase, "failed");
      assert.isTrue(yield* fs.exists(`${home}/.local/bin/claude`));
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );

  it.effect("runs installs one at a time because both write to the same npm prefix", () =>
    Effect.gen(function* () {
      const events: Array<string> = [];
      const firstSpawned = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const { service, host, terminal } = yield* makeHarness({
        spawn: () => {
          const index = events.filter((event) => event.startsWith("spawn")).length;
          events.push(`spawn-${index}`);
          if (index > 0) return Effect.succeed(handle({ exitCode: exited(1) }));
          return Deferred.succeed(firstSpawned, undefined).pipe(
            Effect.as(
              handle({
                exitCode: Deferred.await(release).pipe(
                  Effect.tap(() => Effect.sync(() => events.push("first-exited"))),
                  Effect.as(ChildProcessSpawner.ExitCode(1)),
                ),
              }),
            ),
          );
        },
      });
      yield* host(service.start(claude));
      yield* Deferred.await(firstSpawned);
      yield* host(service.start(opencode));
      yield* Deferred.succeed(release, undefined);
      yield* terminal(claude);
      yield* terminal(opencode);
      assert.deepEqual(events, ["spawn-0", "first-exited", "spawn-1"]);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );

  it.effect("refuses Windows and drivers it does not manage", () =>
    Effect.gen(function* () {
      const { service, host } = yield* makeHarness({ platform: "win32" });
      const windows = yield* Effect.flip(host(service.start(claude)));
      assert.include(windows.detail, "not supported on Windows");
      const other = yield* Effect.flip(host(service.start(ProviderDriverKind.make("codex"))));
      assert.include(other.detail, "not available");
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );
});
