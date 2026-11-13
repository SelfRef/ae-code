import { usePaneRole } from "../../components/ui/Pane";
import { useAdaptiveWorkspaceLayout, useWorkspacePaneState } from "./adaptive-workspace-context";

/** The sidebar button's state, or null where there's no sidebar beside the content to toggle. */
export function useSidebarToggleState() {
  const { layout, togglePrimarySidebar } = useAdaptiveWorkspaceLayout();
  const { panes, sidebarToggleable } = useWorkspacePaneState();
  if (!sidebarToggleable) return null;
  const maximizes = panes.primarySidebarVisible && layout.variant !== "medium";
  return {
    visible: panes.primarySidebarVisible,
    accessibilityLabel: panes.primarySidebarVisible
      ? maximizes
        ? "Maximize content"
        : "Hide sidebar"
      : "Show sidebar",
    icon: "sidebar.left",
    onPress: togglePrimarySidebar,
  } as const;
}

/** The content pane's sidebar button, or null where the toolbar doesn't carry one. */
export function useSidebarToggle() {
  const role = usePaneRole();
  const toggle = useSidebarToggleState();
  const { sidebarToggleInRail } = useWorkspacePaneState();
  return role === "content" && !sidebarToggleInRail ? toggle : null;
}
