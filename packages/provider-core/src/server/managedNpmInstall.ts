import type { ServerProvider } from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import { resolveCommandPath } from "@t3tools/shared/shell";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";

/** Providers whose CLI the app installs with `npm install -g --prefix ~/.local <package>`. */
export interface ManagedNpmPackage {
  readonly driver: string;
  readonly packageName: string;
  readonly binary: string;
}

export const MANAGED_NPM_PACKAGES: ReadonlyArray<ManagedNpmPackage> = [
  { driver: "claudeAgent", packageName: "@anthropic-ai/claude-code", binary: "claude" },
  { driver: "opencode", packageName: "@opencode/cli", binary: "opencode" },
];

export const findManagedNpmPackage = (driver: string): ManagedNpmPackage | undefined =>
  MANAGED_NPM_PACKAGES.find((entry) => entry.driver === driver);

/** The prefix puts launchers in `bin` and the package in `lib/node_modules`. Windows lays npm out differently and is not managed. */
export const resolveManagedNpmLocations = Effect.fn("managedNpm.resolveLocations")(function* (
  spec: ManagedNpmPackage,
) {
  const home = (yield* HostProcess.HomeDirectory).replace(/\/+$/, "");
  const prefix = `${home}/.local`;
  const binDirectory = `${prefix}/bin`;
  return {
    prefix,
    binDirectory,
    executable: `${binDirectory}/${spec.binary}`,
    packageDirectory: `${prefix}/lib/node_modules/${spec.packageName}`,
  };
});

/** Only the bare default command is managed; a configured path is the user's own. */
const usesManagedCommand = (spec: ManagedNpmPackage, binaryPath: string) =>
  binaryPath.trim() === "" || binaryPath.trim() === spec.binary;

/**
 * Adds the prefix's `bin` after the existing PATH entries, so a CLI already on PATH still wins
 * and a CLI installed later is found without restarting the server.
 */
export const withManagedNpmBinDirectory = Effect.fn("managedNpm.withBinDirectory")(function* (
  driver: string,
  binaryPath: string,
  env: NodeJS.ProcessEnv,
) {
  const spec = findManagedNpmPackage(driver);
  if (!spec || !usesManagedCommand(spec, binaryPath) || (yield* HostProcess.Platform) === "win32") {
    return env;
  }
  // Without PATH the spawn falls back to the system default, which a new PATH would replace.
  if (env.PATH === undefined || env.PATH === "") return env;
  const { binDirectory } = yield* resolveManagedNpmLocations(spec);
  const entries = env.PATH.split(":").filter((entry) => entry !== "");
  return entries.includes(binDirectory)
    ? env
    : { ...env, PATH: [...entries, binDirectory].join(":") };
});

/**
 * Offers the install while the CLI is missing, and says where a managed copy was found.
 * Nothing changes for a CLI found on PATH or configured by path.
 */
export const applyManagedNpmInstallStatus = Effect.fn("managedNpm.applyInstallStatus")(function* (
  provider: ServerProvider,
  binaryPath: string,
  env: NodeJS.ProcessEnv,
) {
  const spec = findManagedNpmPackage(provider.driver);
  if (
    !spec ||
    !provider.enabled ||
    !usesManagedCommand(spec, binaryPath) ||
    (yield* HostProcess.Platform) === "win32"
  ) {
    return provider;
  }
  if (!provider.installed) {
    return {
      ...provider,
      setup: { canAuthenticate: false, ...provider.setup, canInstall: true },
    };
  }
  const fileSystem = yield* FileSystem.FileSystem;
  const { binDirectory, executable } = yield* resolveManagedNpmLocations(spec);
  const onPath = yield* resolveCommandPath(spec.binary, {
    env: {
      ...env,
      PATH: (env.PATH ?? "")
        .split(":")
        .filter((entry) => entry !== binDirectory)
        .join(":"),
    },
  });
  if (
    onPath !== null ||
    !(yield* fileSystem.exists(executable).pipe(Effect.orElseSucceed(() => false)))
  ) {
    return provider;
  }
  const note = `Found at ${executable}, which is not on PATH.`;
  const message = provider.message ? `${provider.message} ${note}` : note;
  // A launcher that exists but fails is an interrupted install (npm links it before the postinstall
  // runs): the probe counts it as installed, so keep the install row, with its progress and retry.
  return provider.status === "error"
    ? {
        ...provider,
        message,
        setup: { canAuthenticate: false, ...provider.setup, canInstall: true },
      }
    : { ...provider, message };
});
