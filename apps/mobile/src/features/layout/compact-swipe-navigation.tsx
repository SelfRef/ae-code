import { useEffectEvent, useState, type ReactNode } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import { useWorkspaceBackNavigation } from "./workspace/useAndroidWorkspaceNavigation";

// Starts only at a screen edge, so the list's row actions and a chat's scrollable blocks keep
// their own horizontal swipes. Gesture navigation owns the outermost ~24dp itself.
const EDGE_WIDTH = 48;
const COMMIT_DISTANCE = 64;
const COMMIT_VELOCITY = 600;

/**
 * Phone-sized Android: swipe in from the left edge of a chat to return to the list, and in from
 * the right edge of the list to reopen the chat that was last open.
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
  const [gesture] = useState(() => {
    const toList = Gesture.Pan()
      .hitSlop({ left: 0, width: EDGE_WIDTH })
      .activeOffsetX(16)
      .failOffsetY([-16, 16])
      .onEnd((event) => {
        if (event.translationX > COMMIT_DISTANCE || event.velocityX > COMMIT_VELOCITY) {
          runOnJS(commit)("list");
        }
      });
    // Activates before a row's own swipe (10dp) so an edge start opens the chat.
    const toChat = Gesture.Pan()
      .hitSlop({ right: 0, width: EDGE_WIDTH })
      .activeOffsetX(-8)
      .failOffsetY([-16, 16])
      .onEnd((event) => {
        if (event.translationX < -COMMIT_DISTANCE || event.velocityX < -COMMIT_VELOCITY) {
          runOnJS(commit)("chat");
        }
      });
    return Gesture.Race(toList, toChat);
  });

  return <GestureDetector gesture={gesture}>{props.children}</GestureDetector>;
}
