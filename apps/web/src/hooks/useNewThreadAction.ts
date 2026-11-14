import { useAtomValue } from "@effect/atom-react";
import { pickableProjectGroups } from "@t3tools/client-runtime/state/project-grouping";
import type { MouseEvent as ReactMouseEvent } from "react";

import { openCommandPalette } from "../commandPaletteBus";
import { shouldCreateNewThreadInCurrentProject } from "../components/Sidebar.logic";
import { shortcutLabelForCommand } from "../keybindings";
import { startNewThreadFromContext } from "../lib/chatThreadActions";
import { useProjects } from "../state/entities";
import { primaryServerKeybindingsAtom } from "../state/server";
import { useHandleNewThread } from "./useHandleNewThread";
import { useSidebarProjectGroups } from "./useSidebarProjectGroups";

/** The New thread button's click handler and labels, shared by the nav rail and the narrow-screen sidebar. */
export function useNewThreadAction() {
  const context = useHandleNewThread();
  const projects = useProjects();
  const projectGroups = useSidebarProjectGroups();
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const openGroupCount = pickableProjectGroups(projectGroups).length;
  const picksProject = !shouldCreateNewThreadInCurrentProject(
    false,
    openGroupCount,
    projectGroups.length,
  );

  const onNewThread = (event?: ReactMouseEvent) => {
    if (
      !shouldCreateNewThreadInCurrentProject(
        event?.shiftKey ?? false,
        openGroupCount,
        projectGroups.length,
      )
    ) {
      openCommandPalette({ open: "new-thread-in" });
      return;
    }
    // With no current or open project, such as when every project is archived, pick one.
    void startNewThreadFromContext({
      activeDraftThread: context.activeDraftThread,
      activeThread: context.activeThread ?? undefined,
      defaultProjectRef: context.defaultProjectRef,
      handleNewThread: context.handleNewThread,
    }).then((started) => {
      if (!started) openCommandPalette({ open: "new-thread-in" });
    });
  };

  return {
    onNewThread,
    disabled: projects.length === 0,
    shortcutLabel:
      shortcutLabelForCommand(keybindings, "chat.new") ??
      (picksProject ? undefined : shortcutLabelForCommand(keybindings, "chat.newLocal")),
    inProjectShortcutLabel: shortcutLabelForCommand(keybindings, "chat.newLocal"),
    showInProjectHint: picksProject,
  };
}
