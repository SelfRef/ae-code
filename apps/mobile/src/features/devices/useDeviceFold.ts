import type { DeviceFoldPosture, DevicePlatform, EnvironmentId } from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import { useEffect, useEffectEvent, useState } from "react";

import * as Dialog from "../../components/ui/Dialog";
import { deviceEnvironment } from "../../state/device";
import { useAtomCommand } from "../../state/use-atom-command";

/** The fold posture of a foldable Android emulator, and the action that flips it. */
export function useDeviceFold(
  environmentId: EnvironmentId,
  session: { hostId: string; deviceId: string; platform: DevicePlatform } | undefined,
) {
  const readDetail = useAtomCommand(deviceEnvironment.detail, { reportFailure: false });
  const act = useAtomCommand(deviceEnvironment.action, { reportFailure: false });
  const key =
    session?.platform === "android"
      ? `${environmentId}:${session.hostId}:${session.deviceId}`
      : null;
  const [read, setRead] = useState<{ key: string; posture: DeviceFoldPosture } | null>(null);
  const [pending, setPending] = useState(false);
  const hostId = session?.hostId;
  const deviceId = session?.deviceId;
  const readFold = useEffectEvent(async () => {
    if (hostId === undefined || deviceId === undefined || key === null) return null;
    const result = await readDetail({ environmentId, input: { hostId, deviceId } });
    return result._tag === "Success" ? (result.value.settings.fold ?? null) : null;
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- reads the device's fold posture from the host when the previewed device changes
  useEffect(() => {
    if (key === null) return;
    let stale = false;
    void readFold().then((posture) => {
      if (!stale && posture) setRead({ key, posture });
    });
    return () => {
      stale = true;
    };
  }, [key]);

  const posture = read !== null && read.key === key ? read.posture : null;
  const toggle = async () => {
    if (!session || key === null || posture === null || pending) return;
    setPending(true);
    const result = await act({
      environmentId,
      input: {
        hostId: session.hostId,
        deviceId: session.deviceId,
        type: "setFold",
        value: posture === "closed" ? "opened" : "closed",
      },
    }).finally(() => setPending(false));
    if (result._tag === "Failure") {
      Dialog.alert("Could not change fold", String(Cause.squash(result.cause)));
      return;
    }
    const next = result.value.settings.fold;
    if (next) setRead({ key, posture: next });
  };
  return { posture, pending, toggle };
}
