import { StackActions, useNavigation } from "@react-navigation/native";
import { createContext, use } from "react";
import { Platform } from "react-native";

import { useWorkspacePaneState } from "../layout/AdaptiveWorkspaceLayout";

export type ThreadInspectorMode = "route" | "git" | "files" | "preview";

export type ThreadInspectorTarget = {
  readonly type: "thread" | "device" | "browser";
  readonly environmentId: string;
  readonly threadId: string;
  readonly deviceKey?: string;
  readonly tabId?: string;
};

export const ThreadInspectorNavigationContext = createContext<
  ((target: ThreadInspectorTarget) => void) | null
>(null);

export function useOpenThreadInspector() {
  const navigation = useNavigation();
  const { fileInspector } = useWorkspacePaneState();
  const openInInspector = use(ThreadInspectorNavigationContext);
  return (
    source: { readonly environmentId: string; readonly threadId: string },
    target: ThreadInspectorTarget,
  ) => {
    // Android's inspector shows the device and browser previews; threads still open full screen there.
    if (!fileInspector.supported || (Platform.OS !== "ios" && target.type === "thread"))
      return false;
    if (openInInspector) openInInspector(target);
    else {
      const parent = navigation.getState()?.routes.findLast((route) => route.name === "Thread");
      if (
        !parent?.params ||
        !("environmentId" in parent.params) ||
        parent.params.environmentId !== source.environmentId ||
        !("threadId" in parent.params) ||
        parent.params.threadId !== source.threadId
      )
        return false;
      navigation.dispatch(
        StackActions.popTo("Thread", { ...source, inspector: target }, { merge: true }),
      );
    }
    return true;
  };
}
