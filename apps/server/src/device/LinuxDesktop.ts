import {
  DeviceBootError,
  type DeviceHostId,
  DeviceOperationError,
  type DevicePlatformAvailability,
} from "@t3tools/contracts";
import { isCommandAvailable } from "@t3tools/shared/shell";
import * as NodeOS from "node:os";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

import * as ProcessRunner from "../processRunner.ts";
import type { DeviceOperations, HostDevice, HubUpstream } from "./DeviceHost.ts";
import { LINUX_DESKTOP_FILES } from "./linuxDesktopFiles.ts";

const LINUX_DESKTOP_DEVICE_ID = "gnome-desktop";
/** Proxied stream paths under this prefix go to the session, in serve-sim's formats. */
const LINUX_DESKTOP_HUB_PREFIX = "/vendor/linux-desktop";

const COMMANDS = ["gnome-shell", "pipewire", "wireplumber", "dbus-daemon", "gsettings", "python3"];
const AVAILABILITY_TTL = Duration.seconds(30);
// GNOME Shell's first start in a fresh home compiles its caches; later ones take a few seconds.
const READY_TIMEOUT = Duration.seconds(120);
const DEFAULT_SIZE = "1440x900";
const PYTHON_PROBE = `import gi
gi.require_version("Gst", "1.0")
gi.require_version("Atspi", "2.0")
from gi.repository import Gst, Atspi
Gst.init(None)
raise SystemExit(0 if Gst.ElementFactory.find("pipewiresrc") else 3)`;

const ReadyLine = Schema.fromJsonString(
  Schema.Struct({
    ready: Schema.Boolean,
    port: Schema.optional(Schema.Int),
    error: Schema.optional(Schema.String),
  }),
);
const decodeReadyLine = Schema.decodeUnknownOption(ReadyLine);

interface RunningSession {
  readonly child: ChildProcessSpawner.ChildProcessHandle;
  readonly scope: Scope.Closeable;
  readonly origin: string;
  readonly token: string;
}

export interface LinuxDesktopPaths {
  readonly root: string;
  readonly bin: string;
  readonly python: string;
  readonly data: string;
  /** Short and in the temp directory: it holds the session's sockets, whose paths are capped. */
  readonly runtime: string;
}

export const linuxDesktopPaths = (path: Path.Path, stateDir: string): LinuxDesktopPaths => {
  const root = path.join(stateDir, "device", "linux-desktop");
  // FNV-1a: one runtime directory per T3 home, short enough for socket paths.
  let hash = 0x811c9dc5;
  for (const char of root) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  const id = hash.toString(16).padStart(8, "0");
  return {
    root,
    bin: path.join(root, "bin"),
    python: path.join(root, "python"),
    data: path.join(root, "home"),
    runtime: path.join(NodeOS.tmpdir(), `t3-desktop-${id}`),
  };
};

/**
 * What the agent-device daemon needs to drive the session: its bus and display, its settings
 * dirs, the ydotool and grim shims, and the AT-SPI window-origin fix. XDG_RUNTIME_DIR stays the
 * host's, which the Android emulator tools read.
 */
const linuxDesktopAgentEnvironment = (
  paths: LinuxDesktopPaths,
  environment: NodeJS.ProcessEnv,
): Record<string, string> => ({
  T3_DESKTOP_RUNTIME_DIR: paths.runtime,
  DBUS_SESSION_BUS_ADDRESS: `unix:path=${paths.runtime}/bus`,
  WAYLAND_DISPLAY: `${paths.runtime}/wayland-0`,
  XDG_SESSION_TYPE: "wayland",
  GDK_BACKEND: "wayland",
  XDG_CONFIG_HOME: `${paths.data}/config`,
  XDG_DATA_HOME: `${paths.data}/data`,
  XDG_CACHE_HOME: `${paths.data}/cache`,
  PYTHONPATH: [paths.python, environment.PYTHONPATH].filter(Boolean).join(":"),
  PATH: [paths.bin, environment.PATH].filter(Boolean).join(":"),
});

/** For agents' own shells: runs a command (an app they built) on the session's screen. */
const runWrapper = (paths: LinuxDesktopPaths) => `#!/bin/sh
# Runs a command on the T3 Code GNOME desktop session's screen.
if [ ! -S '${paths.runtime}/wayland-0' ]; then
  echo "t3-desktop-run: the desktop session is not running; open it with device_open first." >&2
  exit 1
fi
export XDG_RUNTIME_DIR='${paths.runtime}' WAYLAND_DISPLAY=wayland-0 XDG_SESSION_TYPE=wayland GDK_BACKEND=wayland
export DBUS_SESSION_BUS_ADDRESS='unix:path=${paths.runtime}/bus'
export XDG_CONFIG_HOME='${paths.data}/config' XDG_DATA_HOME='${paths.data}/data' XDG_CACHE_HOME='${paths.data}/cache'
unset DISPLAY
exec "$@"
`;

export const linuxDesktopRunCommand = (paths: LinuxDesktopPaths, path: Path.Path) =>
  path.join(paths.bin, "t3-desktop-run");

export const make = Effect.fn("LinuxDesktop.make")(function* (options: {
  readonly hostId: DeviceHostId;
  readonly stateDir: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly hostPlatform: NodeJS.Platform;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const runner = yield* ProcessRunner.ProcessRunner;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const httpClient = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope);
  const { hostId, environment } = options;
  const paths = linuxDesktopPaths(path, options.stateDir);
  const runningRef = yield* Ref.make<RunningSession | null>(null);
  const lock = yield* Semaphore.make(1);

  const run = (command: string, args: ReadonlyArray<string>) =>
    runner
      .run({ command, args, env: environment, timeout: Duration.seconds(15) })
      .pipe(Effect.orElseSucceed(() => ({ code: 127, stdout: "", stderr: "" })));

  const probe = Effect.gen(function* () {
    if (options.hostPlatform !== "linux")
      return { reason: "GNOME desktops need a Linux device host.", version: "" };
    const missing: Array<string> = [];
    for (const command of COMMANDS) {
      const found = yield* isCommandAvailable(command, { env: environment }).pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(Path.Path, path),
      );
      if (!found) missing.push(command);
    }
    if (missing.length > 0)
      return {
        reason: `A GNOME desktop needs ${missing.join(", ")} on this machine's PATH. Install GNOME Shell, PipeWire and WirePlumber.`,
        version: "",
      };
    const python = yield* run("python3", ["-c", PYTHON_PROBE]);
    if (python.code !== 0)
      return {
        reason:
          "A GNOME desktop needs the Python GObject bindings for GStreamer and AT-SPI and GStreamer's PipeWire plugin (python3-gi, python3-gst-1.0, gir1.2-atspi-2.0 and gstreamer1.0-pipewire on Debian and Ubuntu).",
        version: "",
      };
    const shell = yield* run("gnome-shell", ["--version"]);
    return { reason: null, version: /(\d+(?:\.\d+)*)/.exec(shell.stdout)?.[1] ?? "" };
  });
  const cachedProbe = yield* Effect.cachedWithTTL(probe, AVAILABILITY_TTL);

  const availability: Effect.Effect<DevicePlatformAvailability> = cachedProbe.pipe(
    Effect.map(({ reason }) =>
      reason === null
        ? { platform: "linux", available: true }
        : { platform: "linux", available: false, reason },
    ),
  );

  /** Writes the session's helper, shims and extension; unchanged files are left alone. */
  const writeFiles = Effect.gen(function* () {
    const files = [
      ...LINUX_DESKTOP_FILES,
      { path: "bin/t3-desktop-run", contents: runWrapper(paths), executable: true },
    ];
    for (const file of files) {
      const target = path.join(paths.root, file.path);
      const current = yield* fs.readFileString(target).pipe(Effect.orElseSucceed(() => null));
      if (current === file.contents) continue;
      yield* fs.makeDirectory(path.dirname(target), { recursive: true });
      yield* fs.writeFileString(target, file.contents);
      if (file.executable) yield* fs.chmod(target, 0o755);
    }
  });

  const agentEnvironment = cachedProbe.pipe(
    Effect.flatMap(({ reason }) =>
      reason === null
        ? writeFiles.pipe(
            Effect.as(linuxDesktopAgentEnvironment(paths, environment)),
            Effect.orElseSucceed(() => ({})),
          )
        : Effect.succeed({}),
    ),
  );

  const bootError = (reason: "timeout" | "launch_failed", diagnostics: string, cause: unknown) =>
    new DeviceBootError({
      hostId,
      deviceId: LINUX_DESKTOP_DEVICE_ID,
      reason,
      diagnostics: diagnostics.slice(0, 2_000),
      cause,
    });

  const start = Effect.gen(function* () {
    const current = yield* Ref.get(runningRef);
    if (current && (yield* current.child.isRunning.pipe(Effect.orElseSucceed(() => false))))
      return current;
    yield* writeFiles.pipe(
      Effect.mapError((cause) =>
        bootError("launch_failed", "Could not write the session files.", cause),
      ),
    );
    const scope = yield* Scope.make("sequential");
    return yield* Effect.gen(function* () {
      const child = yield* spawner
        .spawn(
          ChildProcess.make(
            "python3",
            [
              path.join(paths.root, "session.py"),
              "--runtime-dir",
              paths.runtime,
              "--data-dir",
              paths.data,
              "--extension-dir",
              path.join(paths.root, "extension"),
              "--size",
              environment.T3CODE_LINUX_DESKTOP_SIZE?.trim() || DEFAULT_SIZE,
            ],
            {
              env: { ...environment },
              stdout: "pipe",
              stderr: "pipe",
              detached: false,
              shell: false,
              // The helper stops GNOME Shell and its daemons on SIGTERM; never wait on it forever.
              forceKillAfter: Duration.seconds(10),
            },
          ),
        )
        .pipe(
          Effect.provideService(Scope.Scope, scope),
          Effect.mapError((cause) =>
            bootError("launch_failed", "Could not start the desktop session helper.", cause),
          ),
        );
      yield* Effect.forkIn(
        child.stderr.pipe(
          Stream.decodeText(),
          Stream.splitLines,
          Stream.filter((line) => line.trim().length > 0),
          Stream.runForEach((line) =>
            Effect.logDebug("Linux desktop session output", { output: line }),
          ),
          Effect.ignoreCause,
        ),
        scope,
      );
      const line = yield* child.stdout.pipe(
        Stream.decodeText(),
        Stream.splitLines,
        Stream.runHead,
        Effect.timeoutOption(READY_TIMEOUT),
        Effect.mapError((cause) => bootError("launch_failed", "The session helper failed.", cause)),
      );
      const ready = Option.flatMap(Option.flatten(line), decodeReadyLine);
      if (Option.isNone(line))
        return yield* bootError(
          "timeout",
          `GNOME Shell did not start within ${Duration.format(READY_TIMEOUT)}.`,
          null,
        );
      if (Option.isNone(ready) || !ready.value.ready || ready.value.port === undefined)
        return yield* bootError(
          "launch_failed",
          Option.isSome(ready) && ready.value.error
            ? ready.value.error
            : "The desktop session helper exited before it was ready.",
          ready,
        );
      const token = yield* fs
        .readFileString(path.join(paths.runtime, "token"))
        .pipe(
          Effect.mapError((cause) =>
            bootError("launch_failed", "The session helper wrote no token.", cause),
          ),
        );
      const session: RunningSession = {
        child,
        scope,
        origin: `http://127.0.0.1:${ready.value.port}`,
        token: token.trim(),
      };
      yield* Ref.set(runningRef, session);
      // A session that ends on its own (GNOME Shell crashed, or logged out) is no longer booted.
      yield* Effect.forkDetach(
        child.exitCode.pipe(
          Effect.ignoreCause,
          Effect.andThen(
            Ref.update(runningRef, (running) => (running === session ? null : running)),
          ),
          Effect.andThen(Scope.close(scope, Exit.void)),
        ),
      );
      yield* Effect.logInfo("Linux desktop session started", { pid: Number(child.pid) });
      return session;
    }).pipe(Effect.onError(() => Scope.close(scope, Exit.void).pipe(Effect.ignore)));
  });

  const stop = lock.withPermits(1)(
    Ref.getAndSet(runningRef, null).pipe(
      Effect.flatMap((session) => (session ? Scope.close(session.scope, Exit.void) : Effect.void)),
    ),
  );

  const device: Effect.Effect<HostDevice | null> = Effect.gen(function* () {
    const probed = yield* cachedProbe;
    if (probed.reason !== null) return null;
    const running = yield* Ref.get(runningRef);
    return {
      id: LINUX_DESKTOP_DEVICE_ID,
      platform: "linux",
      name: "GNOME desktop",
      version: probed.version ? `GNOME ${probed.version}` : "GNOME",
      booted: running !== null,
      physical: false,
    };
  });

  const screenshot = Effect.gen(function* () {
    const running = yield* Ref.get(runningRef);
    if (!running)
      return yield* new DeviceOperationError({
        operation: "screenshot",
        reason: "request_failed",
        cause: new Error("The desktop session is not running"),
      });
    return yield* httpClient
      .execute(
        HttpClientRequest.post(`${running.origin}/api/screenshot`).pipe(
          HttpClientRequest.setHeader("x-t3-desktop-token", running.token),
        ),
      )
      .pipe(
        Effect.flatMap(HttpClientResponse.filterStatusOk),
        Effect.flatMap((response) => response.arrayBuffer),
        Effect.map((buffer) => new Uint8Array(buffer)),
        Effect.scoped,
        Effect.timeout(Duration.seconds(20)),
        Effect.mapError(
          (cause) =>
            new DeviceOperationError({ operation: "screenshot", reason: "request_failed", cause }),
        ),
      );
  });

  /** Adds the desktop to a host's operations; other platforms keep their own. */
  const withDesktop = (operations: DeviceOperations): DeviceOperations => ({
    ...operations,
    list: Effect.all([operations.list, device]).pipe(
      Effect.map(([listed, desktop]) =>
        desktop ? { ...listed, devices: [...listed.devices, desktop] } : listed,
      ),
    ),
    boot: (target, context) =>
      target.platform === "linux"
        ? lock.withPermits(1)(start).pipe(Effect.as(LINUX_DESKTOP_DEVICE_ID))
        : operations.boot(target, context),
    attach: (target) => (target.platform === "linux" ? Effect.void : operations.attach(target)),
    shutdown: (target) => (target.platform === "linux" ? stop : operations.shutdown(target)),
    screenshot: (target) =>
      target.platform === "linux" ? screenshot : operations.screenshot(target),
  });

  /** Routes the desktop's stream and input paths; `undefined` leaves a path to the hub. */
  const upstream = (
    hubPath: string,
    search: URLSearchParams,
  ): Effect.Effect<HubUpstream | null | undefined> => {
    if (!hubPath.startsWith(`${LINUX_DESKTOP_HUB_PREFIX}/`)) return Effect.undefined;
    return Ref.get(runningRef).pipe(
      Effect.map((running) =>
        running
          ? {
              url: `${running.origin}${hubPath.slice(LINUX_DESKTOP_HUB_PREFIX.length)}${search.size > 0 ? `?${search.toString()}` : ""}`,
              headers: { "x-t3-desktop-token": running.token },
              protocols: [],
            }
          : null,
      ),
    );
  };

  return {
    availability,
    agentEnvironment,
    withDesktop,
    upstream,
    stop,
    runCommand: linuxDesktopRunCommand(paths, path),
  };
});

export type LinuxDesktop = Effect.Success<ReturnType<typeof make>>;
