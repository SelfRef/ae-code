// @effect-diagnostics nodeBuiltinImport:off
// The supervisor starts before the CLI runtime loads and must outlive any server release it runs,
// so it uses Node built-ins only.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { compareSemverVersions } from "@t3tools/shared/semver";

/** The opt-in switch: a plain `ae-code serve` then runs under the supervisor below. */
export const SELF_UPDATE_ENV = "T3CODE_SELF_UPDATE";
/** Set for the supervised server, which is what makes it report the `respawn` update capability. */
export const UPDATE_SUPERVISED_ENV = "T3CODE_UPDATE_SUPERVISED";

export function wantsUpdateSupervisor(env: NodeJS.ProcessEnv): boolean {
  return (
    ["1", "true", "yes", "on"].includes((env[SELF_UPDATE_ENV] ?? "").trim().toLowerCase()) &&
    (env[UPDATE_SUPERVISED_ENV] ?? "") === ""
  );
}

/** Where the server keeps its state and its `updates/` directory: `--base-dir`, T3CODE_HOME, `~/.ae`. */
export function resolveSupervisedBaseDir(
  args: ReadonlyArray<string>,
  env: NodeJS.ProcessEnv,
  home: string,
): string {
  let flag: string | undefined;
  args.forEach((arg, index) => {
    if (arg === "--base-dir") flag = args[index + 1];
    else if (arg.startsWith("--base-dir=")) flag = arg.slice("--base-dir=".length);
  });
  const raw = (flag ?? env.T3CODE_HOME ?? "").trim();
  if (raw === "") return NodePath.join(home, ".ae");
  if (raw === "~") return home;
  return NodePath.resolve(raw.startsWith("~/") ? NodePath.join(home, raw.slice(2)) : raw);
}

/** The downloaded release to run, or null for this binary: only a strictly newer, unpacked one wins. */
export function selectRuntimeVersion(input: {
  readonly bakedVersion: string;
  readonly current: string | undefined;
  readonly unpacked: boolean;
}): string | null {
  const { current } = input;
  return current !== undefined &&
    input.unpacked &&
    compareSemverVersions(current, input.bakedVersion) > 0
    ? current
    : null;
}

/** An update moves `current`, SIGHUP asks for a restart; a stop or a crash ends the supervisor. */
export function shouldRespawn(input: {
  readonly stopping: boolean;
  readonly restartRequested: boolean;
  readonly started: string | undefined;
  readonly current: string | undefined;
}): boolean {
  return !input.stopping && (input.restartRequested || input.current !== input.started);
}

const readCurrent = (updatesDir: string): string | undefined => {
  try {
    return NodeFS.readFileSync(NodePath.join(updatesDir, "current"), "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
};

interface Exit {
  readonly code: number;
  readonly spawnFailed: boolean;
}

/**
 * Runs the server as a child and starts it again from the newest release in `<baseDir>/updates`
 * after it stops itself for an update (or on SIGHUP). Returns the exit code of the last child.
 */
export async function runUpdateSupervisor(input: {
  readonly executable: string;
  readonly args: ReadonlyArray<string>;
  readonly bakedVersion: string;
  readonly baseDir: string;
  readonly env?: NodeJS.ProcessEnv;
}): Promise<number> {
  const updatesDir = NodePath.join(input.baseDir, "updates");
  const executableOf = (version: string) => NodePath.join(updatesDir, version, "ae-code");
  const env = { ...(input.env ?? process.env), [UPDATE_SUPERVISED_ENV]: "1" };

  let stopping = false;
  let restartRequested = false;
  let child: NodeChildProcess.ChildProcess | undefined;
  let skipDownloaded = false;
  const onStop = (signal: NodeJS.Signals) => {
    stopping = true;
    child?.kill(signal);
  };
  const onTerm = () => onStop("SIGTERM");
  const onInt = () => onStop("SIGINT");
  const onHup = () => {
    restartRequested = true;
    child?.kill("SIGTERM");
  };
  process.on("SIGTERM", onTerm);
  process.on("SIGINT", onInt);
  process.on("SIGHUP", onHup);

  try {
    for (;;) {
      const started = readCurrent(updatesDir);
      const version = skipDownloaded
        ? null
        : selectRuntimeVersion({
            bakedVersion: input.bakedVersion,
            current: started,
            unpacked: started !== undefined && NodeFS.existsSync(executableOf(started)),
          });
      const executable = version === null ? input.executable : executableOf(version);
      const exit = await new Promise<Exit>((resolve) => {
        const spawned = NodeChildProcess.spawn(executable, [...input.args], {
          env,
          stdio: "inherit",
        });
        child = spawned;
        spawned.once("error", () => resolve({ code: 1, spawnFailed: true }));
        spawned.once("close", (code, signal) =>
          resolve({
            code: code ?? (signal === null ? 1 : 128 + (NodeOS.constants.signals[signal] ?? 0)),
            spawnFailed: false,
          }),
        );
      });
      child = undefined;

      // A downloaded release that cannot start is skipped for this run, not retried forever.
      if (exit.spawnFailed && version !== null) {
        process.stderr.write(
          `[update-supervisor] ${executable} does not start; using this build.\n`,
        );
        skipDownloaded = true;
        continue;
      }
      const respawn = shouldRespawn({
        stopping,
        restartRequested,
        started,
        current: readCurrent(updatesDir),
      });
      restartRequested = false;
      skipDownloaded = false;
      if (!respawn) return exit.code;
    }
  } finally {
    process.off("SIGTERM", onTerm);
    process.off("SIGINT", onInt);
    process.off("SIGHUP", onHup);
  }
}
