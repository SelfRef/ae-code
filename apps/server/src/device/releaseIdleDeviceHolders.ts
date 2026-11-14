import type {
  DeviceError,
  DeviceHostId,
  DeviceId,
  DeviceServiceState,
  OrchestrationV2ThreadShell,
  ThreadId,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import * as ThreadManagementService from "../orchestration-v2/ThreadManagementService.ts";
import * as DeviceService from "./DeviceService.ts";

type HolderShell = Pick<
  OrchestrationV2ThreadShell,
  "archivedAt" | "activeRunId" | "pendingBackgroundTasks" | "pendingRuntimeRequest"
>;

/** A thread with no run, background task or pending request has nothing left to do on its device. */
export const threadIsIdle = (shell: HolderShell | null) =>
  shell === null ||
  shell.archivedAt !== null ||
  (shell.activeRunId === null &&
    (shell.pendingBackgroundTasks?.length ?? 0) === 0 &&
    shell.pendingRuntimeRequest === null);

/**
 * agent-device lets one session claim a device, and a thread's session lives until the thread
 * closes it. Before another thread opens the device, release the claims of threads that have
 * finished; a thread that is still working keeps its claim.
 */
export const releaseIdleDeviceHolders = Effect.fn("releaseIdleDeviceHolders")(function* (
  devices: Pick<DeviceService.DeviceService["Service"], "state" | "close">,
  shellOf: (threadId: ThreadId) => Effect.Effect<HolderShell | null>,
  input: {
    readonly threadId: ThreadId;
    readonly hostId?: DeviceHostId | undefined;
    readonly deviceId: DeviceId;
  },
) {
  const state: DeviceServiceState = yield* devices.state;
  const holders = state.sessions.filter(
    (session) =>
      session.threadId !== input.threadId &&
      session.deviceId === input.deviceId &&
      (input.hostId === undefined || session.hostId === input.hostId),
  );
  yield* Effect.forEach(
    holders,
    (session) =>
      shellOf(session.threadId).pipe(
        Effect.flatMap((shell) =>
          threadIsIdle(shell)
            ? devices.close({
                threadId: session.threadId,
                hostId: session.hostId,
                deviceId: session.deviceId,
              })
            : Effect.void,
        ),
        // A holder that cannot be released must not stop the open: the daemon then reports the claim.
        Effect.catch((error: DeviceError | unknown) =>
          Effect.logWarning("Could not release an idle thread's device", {
            threadId: session.threadId,
            error,
          }),
        ),
      ),
    { discard: true },
  );
});

/** `releaseIdleDeviceHolders` against the running services; call it before `DeviceService.open`. */
export const releaseIdleDeviceHoldersFor = Effect.fn("releaseIdleDeviceHoldersFor")(function* (
  input: Parameters<typeof releaseIdleDeviceHolders>[2],
) {
  const devices = yield* DeviceService.DeviceService;
  const threads = yield* ThreadManagementService.ThreadManagementService;
  yield* releaseIdleDeviceHolders(
    devices,
    (threadId) => threads.getThreadShell(threadId).pipe(Effect.orElseSucceed(() => null)),
    input,
  );
});
