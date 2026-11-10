// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { describe, expect, it } from "vite-plus/test";

import {
  resolveSupervisedBaseDir,
  runUpdateSupervisor,
  selectRuntimeVersion,
  shouldRespawn,
  wantsUpdateSupervisor,
} from "./updateSupervisor.ts";

describe("updateSupervisor decisions", () => {
  it.each([
    { current: "2026.1110.0", unpacked: true, expected: "2026.1110.0" },
    { current: "2026.1109.0", unpacked: true, expected: null },
    { current: "2026.1108.0", unpacked: true, expected: null },
    { current: "2026.1110.0", unpacked: false, expected: null },
    { current: undefined, unpacked: false, expected: null },
  ])("runs $current (unpacked: $unpacked) as $expected over 2026.1109.0", (input) => {
    expect(selectRuntimeVersion({ bakedVersion: "2026.1109.0", ...input })).toBe(input.expected);
  });

  it.each([
    { stopping: false, restartRequested: false, started: "a", current: "b", expected: true },
    { stopping: false, restartRequested: false, started: undefined, current: "b", expected: true },
    { stopping: false, restartRequested: true, started: "a", current: "a", expected: true },
    { stopping: false, restartRequested: false, started: "a", current: "a", expected: false },
    {
      stopping: false,
      restartRequested: false,
      started: undefined,
      current: undefined,
      expected: false,
    },
    { stopping: true, restartRequested: true, started: "a", current: "b", expected: false },
  ])(
    "respawns: $expected for $stopping/$restartRequested/$started/$current",
    ({ expected, ...input }) => {
      expect(shouldRespawn(input)).toBe(expected);
    },
  );

  it.each([
    { args: ["serve"], env: {}, expected: "/home/me/.ae" },
    { args: ["serve"], env: { T3CODE_HOME: "/srv/ae" }, expected: "/srv/ae" },
    {
      args: ["serve", "--base-dir", "/data/ae"],
      env: { T3CODE_HOME: "/srv/ae" },
      expected: "/data/ae",
    },
    { args: ["serve", "--base-dir=~/state"], env: {}, expected: "/home/me/state" },
    { args: ["serve"], env: { T3CODE_HOME: "~" }, expected: "/home/me" },
  ])("finds the state directory of $args with $env", ({ args, env, expected }) => {
    expect(resolveSupervisedBaseDir(args, env, "/home/me")).toBe(expected);
  });

  it.each([
    { env: { T3CODE_SELF_UPDATE: "true" }, expected: true },
    { env: { T3CODE_SELF_UPDATE: "1" }, expected: true },
    { env: { T3CODE_SELF_UPDATE: "no" }, expected: false },
    { env: {}, expected: false },
    // The entrypoint or a parent supervisor already restarts the server.
    { env: { T3CODE_SELF_UPDATE: "true", T3CODE_UPDATE_SUPERVISED: "1" }, expected: false },
  ])("opts in to the supervisor: $expected for $env", ({ env, expected }) => {
    expect(wantsUpdateSupervisor(env)).toBe(expected);
  });
});

// quarantine: the fake releases are POSIX shell scripts, which hosts without /bin/sh cannot run
describe.skipIf(!NodeFS.existsSync("/bin/sh"))("runUpdateSupervisor", () => {
  const setup = (baked: (paths: { updates: string; log: string }) => string) => {
    const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "ae-supervisor-"));
    const updates = NodePath.join(root, "updates");
    const log = NodePath.join(root, "log");
    const write = (file: string, body: string, mode = 0o755) => {
      NodeFS.mkdirSync(NodePath.dirname(file), { recursive: true });
      NodeFS.writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode });
    };
    const executable = NodePath.join(root, "baked", "ae-code");
    write(executable, baked({ updates, log }));
    return {
      root,
      updates,
      log,
      write,
      lines: () => NodeFS.readFileSync(log, "utf8").trim().split("\n"),
      run: (args = ["serve"]) =>
        runUpdateSupervisor({
          executable,
          args,
          bakedVersion: "2026.1109.0",
          baseDir: root,
          env: {},
        }),
    };
  };
  const release = (updates: string) => `${updates}/2026.1110.0/ae-code`;
  const publish = ({ updates }: { updates: string }) =>
    `mkdir -p ${updates}/2026.1110.0 && echo 2026.1110.0 > ${updates}/current`;

  it("restarts from a release the server downloaded, then stops with it", async () => {
    const fixture = setup(
      (paths) => `echo "baked $T3CODE_UPDATE_SUPERVISED $*" >> ${paths.log}; ${publish(paths)}`,
    );
    fixture.write(release(fixture.updates), `echo "update $*" >> ${fixture.log}; exit 4`);
    try {
      expect(await fixture.run(["serve", "--port", "1"])).toBe(4);
      expect(fixture.lines()).toEqual(["baked 1 serve --port 1", "update serve --port 1"]);
    } finally {
      NodeFS.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("does not start the server again after it stops or crashes", async () => {
    const fixture = setup((paths) => `echo baked >> ${paths.log}; exit 3`);
    try {
      expect(await fixture.run()).toBe(3);
      expect(fixture.lines()).toEqual(["baked"]);
    } finally {
      NodeFS.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("falls back to this build when the downloaded release cannot start", async () => {
    const fixture = setup((paths) => `echo baked >> ${paths.log}; ${publish(paths)}`);
    fixture.write(release(fixture.updates), "exit 0", 0o644);
    try {
      expect(await fixture.run()).toBe(0);
      expect(fixture.lines()).toEqual(["baked", "baked"]);
    } finally {
      NodeFS.rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
