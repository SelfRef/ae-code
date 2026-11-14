import { useRef, useState, type ComponentProps } from "react";
import {
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollComposeButton } from "../../components/ScrollComposeButton.android";
import {
  androidHomeFabPosition,
  type AndroidHomeFabLayout as SharedAndroidHomeFabLayout,
} from "./AndroidHomeFab.shared";
import { isScratchProject } from "@t3tools/client-runtime/state/projects";
import { useServerConfigs } from "../../state/entities";
import { useRemoteConnectionStatus } from "../../state/use-remote-environment-registry";
import { useWorkspaceState } from "../../state/workspace";
import { useNewTaskFlow } from "../threads/new-task-flow-provider";
import { getProjectScopeSelectionTarget } from "../threads/new-task-project-selection";
import { useSelectWorkspaceDetail } from "../layout/workspace/useSelectWorkspaceDetail";
import { uuidv4 } from "../../lib/uuid";
import {
  CHOOSE_PROJECT_ACTION,
  newThreadMenuActionId,
  newThreadMenuActions,
  newThreadMenuScope,
  newThreadMenuScopes,
} from "./new-thread-menu";
import { projectIcon } from "../layout/workspace/ProjectChoiceChip";
import { FabScrollContext } from "./FabScrollContext";
import { updateFabScroll } from "./fab-scroll";
import { useAndroidControlSizing } from "../../components/ui/useAndroidControlSizing";
import { WorkspaceTabsContext, useWorkspaceTabs } from "../layout/workspace/WorkspaceTabsContext";
import { FLOATING_TABS, floatingTabsMetrics } from "../layout/workspace/floating-workspace-tabs";
import { useEnabledNavigationTabs } from "../layout/workspace/navigation-tabs";
import {
  useAppearancePreferences,
  useAndroidFloatingTabs,
} from "../settings/appearance/AppearancePreferencesProvider";

export function AndroidHomeFabLayout(props: ComponentProps<typeof SharedAndroidHomeFabLayout>) {
  const floatingTabsEnabled = useAndroidFloatingTabs();
  const insets = useSafeAreaInsets();
  const { appearance } = useAppearancePreferences();
  const { fontScale } = useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = useState<number | null>(null);
  const { state } = useWorkspaceState();
  const [expanded, setExpanded] = useState(true);
  const { scale, fabSize } = useAndroidControlSizing();
  const enabledTabs = useEnabledNavigationTabs();
  const barWidth =
    layoutWidth === null
      ? undefined
      : layoutWidth - (Math.max(insets.left, FLOATING_TABS.edge) - FLOATING_TABS.edge);
  const size = floatingTabsEnabled
    ? floatingTabsMetrics(enabledTabs.length + 1, scale, fabSize, barWidth).height
    : fabSize;
  const workspace = useWorkspaceTabs();
  const bottomClearance = insets.bottom + FLOATING_TABS.bottom + FLOATING_TABS.edge + size;
  const context = floatingTabsEnabled && workspace ? { ...workspace, bottomClearance } : workspace;
  const selectDetail = useSelectWorkspaceDetail();
  const { projectScopes, selectedEnvironmentId } = useNewTaskFlow();
  const serverConfigs = useServerConfigs();
  const { connectedEnvironments } = useRemoteConnectionStatus();
  const menuScopes = newThreadMenuScopes(projectScopes, (scope) =>
    scope.projects.every((project) =>
      isScratchProject(project, serverConfigs.get(project.environmentId)?.scratchWorkspaceRoot),
    ),
  );
  const startInMenuChoice = (id: string) => {
    const scope = newThreadMenuScope(menuScopes, id);
    if (scope) {
      const connected = new Set(
        connectedEnvironments
          .filter((environment) => environment.connectionState === "connected")
          .map((environment) => environment.environmentId),
      );
      const project = getProjectScopeSelectionTarget(scope, selectedEnvironmentId, connected);
      selectDetail({
        name: "Thread",
        params: {
          draft: {
            requestId: uuidv4(),
            environmentId: String(project.environmentId),
            projectId: String(project.id),
          },
        },
      });
    } else if (id === CHOOSE_PROJECT_ACTION) {
      selectDetail({ name: "Thread", params: { draft: { requestId: uuidv4() } } });
    }
  };
  const scrollState = useRef({ anchor: 0, expanded: true });
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const next = updateFabScroll(
      scrollState.current,
      contentOffset.y,
      contentSize.height - layoutMeasurement.height,
    );
    if (next.expanded !== scrollState.current.expanded) setExpanded(next.expanded);
    scrollState.current = next;
  };

  // Remount only the FAB when its font or pane changes to clear the cached expanded width.
  // Floating navigation shares this row; Material split views put New thread in the rail.
  return (
    <View className="flex-1" onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)}>
      <WorkspaceTabsContext value={context}>
        <FabScrollContext value={onScroll}>{props.children}</FabScrollContext>
      </WorkspaceTabsContext>
      {!props.disabled &&
      (!props.sidebar || floatingTabsEnabled) &&
      state.hasConnections &&
      layoutWidth !== null ? (
        <ScrollComposeButton
          key={`${appearance.baseFontSize}:${fontScale}:${layoutWidth}`}
          size={size}
          expanded={floatingTabsEnabled ? false : expanded}
          onPress={props.onStartNewTask}
          menu={{
            title: "New thread in",
            actions: newThreadMenuActions(menuScopes),
            actionIcons: Object.fromEntries(
              menuScopes.map((scope) => [
                newThreadMenuActionId(scope),
                projectIcon(scope.representative, 24),
              ]),
            ),
            onSelect: startInMenuChoice,
          }}
          className="absolute"
          style={
            floatingTabsEnabled
              ? {
                  right: FLOATING_TABS.edge,
                  bottom: insets.bottom + FLOATING_TABS.bottom,
                }
              : androidHomeFabPosition(insets.bottom, props.sidebar)
          }
        />
      ) : null}
    </View>
  );
}
