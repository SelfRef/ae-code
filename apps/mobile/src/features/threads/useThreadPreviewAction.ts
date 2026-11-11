import type { EnvironmentId, ThreadId } from "@t3tools/contracts";

import type { AppBarAction } from "../../components/ui/AppBar.types";
import { threadDevicePreviews } from "../devices/threadDevicePreviews";
import { deviceEnvironment } from "../../state/device";
import { useEnvironmentQuery } from "../../state/query";
import { useThreadServerBrowserTabs } from "../../state/preview";
import type { ThreadInspectorTarget } from "./thread-inspector-navigation";

/**
 * One app bar button that shows the thread's device, or its browser when it has no device, beside
 * the chat. While a preview is shown it closes the inspector instead.
 */
export function useThreadPreviewAction(input: {
  readonly environmentId: EnvironmentId | null;
  readonly threadId: ThreadId | null;
  readonly browserSupported: boolean;
  /** The preview on screen in the inspector, if any. */
  readonly shown: "device" | "browser" | null;
  readonly onOpen: (target: ThreadInspectorTarget) => void;
  readonly onClose: () => void;
}): AppBarAction | null {
  const { environmentId, threadId } = input;
  const devices = useEnvironmentQuery(
    environmentId === null ? null : deviceEnvironment.state({ environmentId, input: {} }),
  );
  const browser = useThreadServerBrowserTabs({
    environmentId,
    threadId,
    enabled: input.browserSupported,
  });
  if (environmentId === null || threadId === null) return null;
  const hasDevice = threadDevicePreviews(devices.data, threadId).length > 0;
  if (input.shown === null && !hasDevice && browser.tabs.length === 0) return null;
  const type = input.shown ?? (hasDevice ? "device" : "browser");
  return {
    accessibilityLabel: input.shown === null ? "Open preview" : "Close preview",
    icon: type === "device" ? "iphone" : "globe",
    selected: input.shown !== null,
    separateBackground: false,
    onPress:
      input.shown === null ? () => input.onOpen({ type, environmentId, threadId }) : input.onClose,
  };
}
