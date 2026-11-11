import { describe, expect, it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { DeviceHostId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpClient } from "effect/http";

import * as ProcessRunner from "../processRunner.ts";
import type { DeviceOperations, HostDevice } from "./DeviceHost.ts";
import * as LinuxDesktop from "./LinuxDesktop.ts";

const emulator: HostDevice = {
  id: "Pixel",
  name: "Pixel",
  platform: "android",
  version: "Android",
  booted: false,
  physical: false,
};

const hubOperations = (booted: Array<string>): DeviceOperations => ({
  list: Effect.succeed({ devices: [emulator], detail: undefined }),
  boot: (device) => Effect.sync(() => booted.push(device.id)).pipe(Effect.as("emulator-5554")),
  attach: () => Effect.void,
  shutdown: () => Effect.void,
  screenshot: () => Effect.succeed(new Uint8Array()),
});

const layer = Layer.mergeAll(
  NodeServices.layer,
  ProcessRunner.layer.pipe(Layer.provide(NodeServices.layer)),
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make(() => Effect.die("the desktop makes no requests while stopped")),
  ),
);

const desktopOn = (hostPlatform: NodeJS.Platform, environment: NodeJS.ProcessEnv) =>
  LinuxDesktop.make({
    hostId: DeviceHostId.make("local"),
    stateDir: "/nonexistent/t3-state",
    environment,
    hostPlatform,
  });

describe("LinuxDesktop", () => {
  it.effect("names the missing GNOME pieces and lists no desktop without them", () =>
    Effect.gen(function* () {
      const desktop = yield* desktopOn("linux", { PATH: "/nonexistent" });
      const availability = yield* desktop.availability;
      expect(availability.available).toBe(false);
      expect(availability.reason).toContain("gnome-shell, pipewire, wireplumber");
      const booted: Array<string> = [];
      const operations = desktop.withDesktop(hubOperations(booted));
      expect((yield* operations.list).devices).toEqual([emulator]);
      // Other platforms keep the hub's own operations.
      expect(yield* operations.boot(emulator)).toBe("emulator-5554");
      expect(booted).toEqual(["Pixel"]);
      expect(yield* desktop.agentEnvironment).toEqual({});
    }).pipe(Effect.provide(layer)),
  );

  it.effect("leaves other systems' hub routes and agent environment alone", () =>
    Effect.gen(function* () {
      const desktop = yield* desktopOn("darwin", { PATH: "/usr/bin" });
      expect((yield* desktop.availability).available).toBe(false);
      expect(
        yield* desktop.upstream("/vendor/serve-sim/api", new URLSearchParams()),
      ).toBeUndefined();
      // A stopped desktop refuses its own routes rather than sending them to the hub.
      expect(
        yield* desktop.upstream(
          "/vendor/linux-desktop/helper/gnome-desktop/stream.avcc",
          new URLSearchParams(),
        ),
      ).toBeNull();
    }).pipe(Effect.provide(layer)),
  );
});
