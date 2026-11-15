import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  NAVIGATION_TAB_LABELS,
  navigationCustomizationAvailable,
  railNavigationTabCapacity,
  resolveHiddenNavigationTabs,
  enabledNavigationTabs,
  unavailableNavigationTabs,
  type NavigationTab,
} from "./navigation-tab-order";
import type { AppSymbolName } from "../../../components/ui/AppSymbol";
import { mobilePreferencesAtom } from "../../../state/preferences";
import { useSourceControlSignIn } from "../../../state/sourceControl";
import { PullRequestGlyph } from "../../pull-requests/pullRequestGlyphs";
import { useToolbarLayout } from "../../../components/ui/useToolbarLayout";
import { useAdaptiveWorkspaceLayout } from "../adaptive-workspace-context";
import { resolveWorkspaceTabOrder } from "./workspace-tabs-state";

export const WORKSPACE_TAB_LABELS = {
  ...NAVIGATION_TAB_LABELS,
  ...(Platform.OS === "ios" ? { threads: "Chats", pullRequests: "PRs" } : {}),
};

export const NAVIGATION_TAB_ICONS = {
  threads: "text.bubble",
  board: "rectangle.split.3x1",
  branches: "arrow.triangle.branch",
  issues: "circle.inset.filled",
  releases: "tag",
  pullRequests: PullRequestGlyph.pullRequest,
  usage: "chart.bar.xaxis",
} as const satisfies Readonly<Record<NavigationTab, AppSymbolName>>;

export function useNavigationTabOrder() {
  const preferences = useAtomValue(mobilePreferencesAtom);
  const saved = AsyncResult.isSuccess(preferences)
    ? preferences.value.navigationTabOrder
    : undefined;
  return resolveWorkspaceTabOrder(saved);
}

/** The tabs the user hid in Settings. */
export function useSavedHiddenNavigationTabs() {
  const preferences = useAtomValue(mobilePreferencesAtom);
  const saved = AsyncResult.isSuccess(preferences)
    ? preferences.value.hiddenNavigationTabs
    : undefined;
  return navigationCustomizationAvailable() ? resolveHiddenNavigationTabs(saved) : [];
}

export function useUnavailableNavigationTabs() {
  return unavailableNavigationTabs(useSourceControlSignIn());
}

/** Hidden by the user, or because their provider isn't signed in. */
export function useHiddenNavigationTabs() {
  return [...useSavedHiddenNavigationTabs(), ...useUnavailableNavigationTabs()];
}

export function useEnabledNavigationTabs() {
  const order = useNavigationTabOrder();
  const hidden = useHiddenNavigationTabs();
  return enabledNavigationTabs(order, hidden);
}

/** Tabs before the rest open from Settings: four on phones, as many as fit down the Android rail. */
export function useNavigationTabCapacity() {
  const { layout } = useAdaptiveWorkspaceLayout();
  const toolbar = useToolbarLayout();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  return Platform.OS === "android" && layout.usesSplitView
    ? railNavigationTabCapacity(window.height - toolbar.paddingTop - toolbar.height - insets.bottom)
    : 4;
}
