import type { ProviderDriverKind, ProviderInstallState } from "@t3tools/contracts";
import {
  MANAGED_NPM_PACKAGES,
  resolveManagedNpmLocations,
  type ManagedNpmPackage,
} from "@t3tools/provider-core/server/managedNpmInstall";
import { isCommandMissingCause } from "@t3tools/provider-core/server/snapshotProbe";
import * as HostProcess from "@t3tools/shared/HostProcess";
import { resolveSpawnCommand } from "@t3tools/shared/shell";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const INSTALL_TIMEOUT = "10 minutes";
const OUTPUT_TAIL_CHARS = 2_000;
const MESSAGE_TAIL_CHARS = 600;

export class NpmPackageInstallationError extends Schema.TaggedError<NpmPackageInstallationError>()(
  "NpmPackageInstallationError",
  {
    operation: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
) {
  override get message() {
    return this.detail;
  }
}

const installationError = (operation: string, detail: string, cause?: unknown) =>
  new NpmPackageInstallationError({
    operation,
    detail,
    ...(cause === undefined ? {} : { cause }),
  });

// npm echoes registry settings in some failures; keep credentials out of what clients see.
const redact = (output: string) =>
  output
    .replace(/(_auth(?:token)?|_password|\btoken)=\S+/gi, "$1=[redacted]")
    .replace(/\b(?:Bearer|Basic)\s+\S+/gi, "[redacted]")
    .replace(/(\w+:\/\/)[^\s/@]+@/g, "$1[redacted]@");

const failureDetail = (spec: ManagedNpmPackage, exitCode: number, tail: string) => {
  const output = redact(tail).trim().slice(-MESSAGE_TAIL_CHARS);
  return `npm could not install ${spec.packageName} (exit code ${exitCode}).${output ? ` ${output}` : ""}`;
};

interface Entry {
  readonly spec: ManagedNpmPackage;
  readonly state: SubscriptionRef.SubscriptionRef<ProviderInstallState>;
  readonly gate: Semaphore.Semaphore;
  running: { readonly operationId: string; readonly fiber: Fiber.Fiber<void> } | undefined;
}

export class NpmPackageInstallation extends Context.Service<
  NpmPackageInstallation,
  {
    readonly start: (
      driver: ProviderDriverKind,
    ) => Effect.Effect<ProviderInstallState, NpmPackageInstallationError>;
    readonly cancel: (
      driver: ProviderDriverKind,
      operationId: string,
    ) => Effect.Effect<ProviderInstallState, NpmPackageInstallationError>;
    readonly state: (
      driver: ProviderDriverKind,
    ) => Effect.Effect<ProviderInstallState, NpmPackageInstallationError>;
    readonly changes: (
      driver: ProviderDriverKind,
    ) => Stream.Stream<ProviderInstallState, NpmPackageInstallationError>;
  }
>()("t3/provider/NpmPackageInstallation") {}

const make = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const random = yield* SecureRandom.SecureRandom;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const serviceScope = yield* Effect.scope;
  const platform = yield* HostProcess.Platform;

  const readInstalledVersion = Effect.fn("NpmPackageInstallation.readInstalledVersion")(function* (
    spec: ManagedNpmPackage,
  ) {
    const { packageDirectory } = yield* resolveManagedNpmLocations(spec);
    return yield* fs.readFileString(path.join(packageDirectory, "package.json")).pipe(
      Effect.flatMap(
        Schema.decodeUnknownEffect(
          Schema.fromJsonString(Schema.Struct({ version: Schema.NonEmptyString })),
        ),
      ),
      Effect.map((manifest) => manifest.version),
      Effect.orElseSucceed(() => null),
    );
  });

  // Both packages write to the same prefix, and npm has no lock of its own for a global prefix.
  const prefixGate = yield* Semaphore.make(1);

  const entries = new Map<string, Entry>();
  for (const spec of MANAGED_NPM_PACKAGES) {
    const installedVersion = yield* readInstalledVersion(spec);
    entries.set(spec.driver, {
      spec,
      state: yield* SubscriptionRef.make<ProviderInstallState>({
        driver: spec.driver as ProviderDriverKind,
        operationId: null,
        phase: "idle",
        downloadedBytes: 0,
        totalBytes: null,
        version: null,
        installedVersion,
        canRemove: false,
        message: null,
      }),
      gate: yield* Semaphore.make(1),
      running: undefined,
    });
  }

  const entryFor = (
    driver: ProviderDriverKind,
    operation: string,
  ): Effect.Effect<Entry, NpmPackageInstallationError> => {
    const entry = entries.get(driver);
    return entry
      ? Effect.succeed(entry)
      : Effect.fail(installationError(operation, "Managed installation is not available here."));
  };

  const runNpm = Effect.fn("NpmPackageInstallation.runNpm")(function* (
    spec: ManagedNpmPackage,
    prefix: string,
  ) {
    const env = yield* HostProcess.Environment;
    const home = yield* HostProcess.HomeDirectory;
    // npm 11 skips install scripts unless the package is allowed; the native launcher needs them.
    const args = [
      "install",
      "-g",
      "--prefix",
      prefix,
      `--allow-scripts=${spec.packageName}`,
      spec.packageName,
    ];
    const command = yield* resolveSpawnCommand("npm", args, { env });
    const result = yield* Effect.scoped(
      Effect.gen(function* () {
        const child = yield* spawner.spawn(
          ChildProcess.make(command.command, command.args, {
            // Not the server's cwd: a project .npmrc there would change what npm installs.
            cwd: home,
            env,
            extendEnv: true,
            shell: command.shell,
          }),
        );
        const [tail, exitCode] = yield* Effect.all(
          [
            child.all.pipe(
              Stream.decodeText(),
              Stream.runFold(
                () => "",
                (output, chunk) => `${output}${chunk}`.slice(-OUTPUT_TAIL_CHARS),
              ),
            ),
            child.exitCode,
          ],
          { concurrency: "unbounded" },
        );
        return { tail, exitCode: Number(exitCode) };
      }),
    ).pipe(
      Effect.timeoutOption(INSTALL_TIMEOUT),
      Effect.mapError((cause) =>
        isCommandMissingCause(cause)
          ? installationError(
              "install",
              "npm was not found. Install Node.js with npm on this environment and try again.",
              cause,
            )
          : installationError(
              "install",
              `Could not run npm to install ${spec.packageName}.`,
              cause,
            ),
      ),
    );
    if (Option.isNone(result)) {
      return yield* installationError(
        "install",
        `npm took longer than ${INSTALL_TIMEOUT} to install ${spec.packageName}.`,
      );
    }
    if (result.value.exitCode !== 0) {
      return yield* installationError(
        "install",
        failureDetail(spec, result.value.exitCode, result.value.tail),
      );
    }
  });

  // npm links the launcher before a package's postinstall runs, so an interrupted install leaves one
  // that fails to start and that the provider probe would count as installed.
  const discardPartialInstall = Effect.fn("NpmPackageInstallation.discardPartialInstall")(
    function* (spec: ManagedNpmPackage) {
      const { executable, packageDirectory } = yield* resolveManagedNpmLocations(spec);
      yield* fs.remove(executable, { force: true }).pipe(Effect.ignore);
      yield* fs.remove(packageDirectory, { recursive: true, force: true }).pipe(Effect.ignore);
    },
  );

  const install = Effect.fn("NpmPackageInstallation.install")(function* (entry: Entry) {
    const { spec } = entry;
    const { prefix, executable } = yield* resolveManagedNpmLocations(spec);
    // Only a copy this run creates is cleaned up: an existing launcher may be someone else's install.
    const existedBefore =
      (yield* readInstalledVersion(spec)) !== null ||
      (yield* fs.exists(executable).pipe(Effect.orElseSucceed(() => false)));
    yield* prefixGate
      .withPermit(runNpm(spec, prefix))
      .pipe(
        Effect.onError(() =>
          existedBefore ? Effect.void : Effect.uninterruptible(discardPartialInstall(spec)),
        ),
      );
    if (!(yield* fs.exists(executable).pipe(Effect.orElseSucceed(() => false)))) {
      return yield* installationError(
        "install",
        `npm finished, but ${spec.binary} was not created in ${prefix}/bin.`,
      );
    }
    const installedVersion = yield* readInstalledVersion(spec);
    yield* SubscriptionRef.update(entry.state, (current): ProviderInstallState => ({
      ...current,
      phase: "succeeded",
      installedVersion,
      executablePath: executable,
      source: "managed",
      message: `Installed ${spec.packageName}${installedVersion ? ` ${installedVersion}` : ""}.`,
    }));
  });

  const start = Effect.fn("NpmPackageInstallation.start")(function* (driver: ProviderDriverKind) {
    const entry = yield* entryFor(driver, "start");
    if (platform === "win32") {
      return yield* installationError(
        "start",
        "Installing from AE Code is not supported on Windows. Install the CLI yourself and set its binary path.",
      );
    }
    return yield* entry.gate.withPermit(
      Effect.gen(function* () {
        const current = yield* SubscriptionRef.get(entry.state);
        if (current.phase === "installing") return current;
        const operationId = yield* random.uuidV4();
        const next: ProviderInstallState = {
          ...current,
          operationId,
          phase: "installing",
          downloadedBytes: 0,
          message: `Installing ${entry.spec.packageName} with npm.`,
        };
        yield* SubscriptionRef.set(entry.state, next);
        const work = install(entry).pipe(
          Effect.onExit((exit) =>
            Exit.isFailure(exit)
              ? SubscriptionRef.update(entry.state, (value): ProviderInstallState => {
                  if (value.operationId !== operationId || value.phase === "succeeded") {
                    return value;
                  }
                  const error = Cause.findErrorOption(exit.cause);
                  const cancelled = Cause.hasInterruptsOnly(exit.cause);
                  return {
                    ...value,
                    phase: cancelled ? "cancelled" : "failed",
                    message: cancelled
                      ? "Installation cancelled."
                      : Option.isSome(error)
                        ? error.value.detail
                        : `Could not install ${entry.spec.packageName}.`,
                  };
                })
              : Effect.void,
          ),
          Effect.tapCause((cause) =>
            Cause.hasInterruptsOnly(cause)
              ? Effect.void
              : Effect.logError("Managed npm installation failed", cause),
          ),
          Effect.ignoreCause,
          Effect.ensuring(
            Effect.sync(() => {
              if (entry.running?.operationId === operationId) entry.running = undefined;
            }),
          ),
        );
        const fiber = yield* Effect.forkIn(Effect.interruptible(work), serviceScope);
        entry.running = { operationId, fiber };
        return next;
      }).pipe(Effect.uninterruptible),
    );
  });

  const cancel = Effect.fn("NpmPackageInstallation.cancel")(function* (
    driver: ProviderDriverKind,
    operationId: string,
  ) {
    const entry = yield* entryFor(driver, "cancel");
    return yield* entry.gate.withPermit(
      Effect.gen(function* () {
        const current = yield* SubscriptionRef.get(entry.state);
        if (current.operationId !== operationId) {
          return yield* installationError(
            "cancel",
            "This installation is no longer current. Refresh its status before cancelling.",
          );
        }
        if (entry.running?.operationId === operationId && current.phase === "installing") {
          yield* Fiber.interrupt(entry.running.fiber);
        }
        return yield* SubscriptionRef.get(entry.state);
      }),
    );
  });

  const state = Effect.fn("NpmPackageInstallation.state")(function* (driver: ProviderDriverKind) {
    return yield* SubscriptionRef.get((yield* entryFor(driver, "state")).state);
  });

  return NpmPackageInstallation.of({
    start,
    cancel,
    state,
    changes: (driver) =>
      Stream.unwrap(
        entryFor(driver, "observe").pipe(
          Effect.map((entry) => SubscriptionRef.changes(entry.state)),
        ),
      ),
  });
});

export const layer = Layer.effect(NpmPackageInstallation, make);
