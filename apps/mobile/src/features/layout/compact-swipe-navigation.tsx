import { useEffect, useEffectEvent, type ReactNode } from "react";
import { useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { useWorkspaceBackNavigation } from "./workspace/useAndroidWorkspaceNavigation";

// Activates after 24dp. List rows reveal their actions on a left swipe, so the swipe here is
// rightward and never competes with them.
const ACTIVATE_DISTANCE = 24;
const COMMIT_DISTANCE = 40;
const COMMIT_VELOCITY = 600;
const EXIT_MS = 120;

/** True while a swipe finishes a navigation: the screen has already slid away, so the stack must not animate again. */
export const swipeNavigation = { active: false };

function swipeGesture(
  enabled: boolean,
  offset: SharedValue<number>,
  start: SharedValue<number>,
  width: number,
  onCommit: () => void,
) {
  return Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX(ACTIVATE_DISTANCE)
    .failOffsetY([-16, 16])
    .onStart((event) => {
      start.value = event.translationX;
    })
    .onUpdate((event) => {
      offset.value = Math.max(0, event.translationX - start.value);
    })
    .onEnd((event) => {
      if (event.translationX - start.value > COMMIT_DISTANCE || event.velocityX > COMMIT_VELOCITY) {
        offset.value = withTiming(width, { duration: EXIT_MS }, (finished) => {
          if (finished) runOnJS(onCommit)();
        });
      } else {
        offset.value = withSpring(0);
      }
    })
    .onFinalize((_event, success) => {
      if (!success) offset.value = withSpring(0);
    });
}

/**
 * Phone-sized Android: drag right anywhere in a chat to return to the list, and right anywhere in
 * the list to reopen the chat that was last open. The screen follows the finger and slides off
 * before the navigation happens.
 */
export function CompactSwipeNavigation(props: {
  readonly inChat: boolean;
  readonly inList: boolean;
  readonly canOpenLastChat: boolean;
  readonly onOpenLastChat: () => void;
  readonly children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const goToList = useWorkspaceBackNavigation("threads");
  const offset = useSharedValue(0);
  const start = useSharedValue(0);

  const commit = useEffectEvent(() => {
    swipeNavigation.active = true;
    if (props.inChat) goToList();
    else props.onOpenLastChat();
    // The screen swap resets the offset below; this only rescues a navigation that did not happen.
    setTimeout(() => {
      swipeNavigation.active = false;
      offset.set(withTiming(0));
    }, 600);
  });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- brings the new screen back to rest once the swipe's navigation has swapped it in
  useEffect(() => {
    swipeNavigation.active = false;
    offset.set(0);
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- the swap is what these flags change with
  }, [props.inChat, props.inList, offset]);

  const gesture = swipeGesture(
    props.inChat || (props.inList && props.canOpenLastChat),
    offset,
    start,
    width,
    commit,
  );
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ flex: 1 }, style]}>{props.children}</Animated.View>
    </GestureDetector>
  );
}
