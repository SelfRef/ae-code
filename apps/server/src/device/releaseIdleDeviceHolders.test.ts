import { describe, expect, it } from "@effect/vitest";
import {
  DeviceId,
  LOCAL_DEVICE_HOST_ID,
  ThreadId,
  type DeviceCloseInput,
  type DeviceServiceState,
  type DeviceSession,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import { releaseIdleDeviceHolders, threadIsIdle } from "./releaseIdleDeviceHolders.ts";

const device = DeviceId.make("emulator-5554");
const session = (threadId: string, deviceId = device): DeviceSession => ({
  threadId: ThreadId.make(threadId),
  hostId: LOCAL_DEVICE_HOST_ID,
  deviceId,
  platform: "android",
  openedAt: "2026-11-14T12:00:00.000Z",
});
const shell = (overrides: object = {}) =>
  ({
    archivedAt: null,
    activeRunId: null,
    pendingBackgroundTasks: [],
    pendingRuntimeRequest: null,
    ...overrides,
  }) as NonNullable<Parameters<typeof threadIsIdle>[0]>;
const finished = shell();
const working = shell({ activeRunId: "run-1" });

describe("releaseIdleDeviceHolders", () => {
  it.effect("releases finished and gone threads on the device, and keeps working ones", () =>
    Effect.gen(function* () {
      const closed: DeviceCloseInput[] = [];
      const shells = { finished, gone: null, working } as const;
      yield* releaseIdleDeviceHolders(
        {
          state: Effect.succeed({
            sessions: [
              session("finished"),
              session("gone"),
              session("working"),
              session("finished", DeviceId.make("other-device")),
              session("opener"),
            ],
          } as unknown as DeviceServiceState),
          close: (input) => Effect.sync(() => void closed.push(input)),
        },
        (threadId) => Effect.succeed(shells[threadId as keyof typeof shells]),
        { threadId: ThreadId.make("opener"), deviceId: device },
      );
      expect(closed.map((input) => input.threadId)).toEqual(["finished", "gone"]);
      expect(closed.every((input) => input.deviceId === device)).toBe(true);
    }),
  );

  it("counts a thread with a pending request or background task as busy", () => {
    expect(threadIsIdle(shell({ pendingRuntimeRequest: {} }))).toBe(false);
    expect(threadIsIdle(shell({ pendingBackgroundTasks: [{}] }))).toBe(false);
    expect(
      threadIsIdle(shell({ activeRunId: "run-1", archivedAt: "2026-11-14T12:00:00.000Z" })),
    ).toBe(true);
  });
});
