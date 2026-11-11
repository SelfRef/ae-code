import { useEffectEvent, type ReactNode } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import { useWorkspaceBackNavigation } from "./workspace/useAndroidWorkspaceNavigation";

// Activates after 24dp. List rows reveal their actions on a left swipe, so both directions here
// are rightward and never compete with them.
const ACTIVATE_DISTANCE = 24;
const COMMIT_DISTANCE = 64;
const COMMIT_VELOCITY = 600;

function swipe(enabled: boolean, direction: 1 | -1, onCommit: () => void) {
  return Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX(direction * ACTIVATE_DISTANCE)
    .failOffsetY([-16, 16])
    .onEnd((event) => {
      if (
        event.translationX * direction > COMMIT_DISTANCE ||
        event.velocityX * direction > COMMIT_VELOCITY
      ) {
        runOnJS(onCommit)();
      }
    });
}

function swipeGesture(inChat: boolean, inList: boolean, commit: (target: "list" | "chat") => void) {
  return Gesture.Race(
    swipe(inChat, 1, () => commit("list")),
    swipe(inList, 1, () => commit("chat")),
  );
}

/**
 * Phone-sized Android: swipe right anywhere in a chat to return to the list, and right anywhere in
 * the list to reopen the chat that was last open.
 */
export function CompactSwipeNavigation(props: {
  readonly inChat: boolean;
  readonly inList: boolean;
  readonly onOpenLastChat: () => void;
  readonly children: ReactNode;
}) {
  const goToList = useWorkspaceBackNavigation("threads");
  const commit = useEffectEvent((target: "list" | "chat") => {
    if (target === "list" && props.inChat) goToList();
    else if (target === "chat" && props.inList) props.onOpenLastChat();
  });
  const gesture = swipeGesture(props.inChat, props.inList, commit);

  return <GestureDetector gesture={gesture}>{props.children}</GestureDetector>;
}
