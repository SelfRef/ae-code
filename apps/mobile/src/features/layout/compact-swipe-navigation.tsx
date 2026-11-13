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

// Activates after 24dp. A chat slides away to the right; the list slides away to the left, since
// its rows reveal their actions on a right swipe and the two never compete.
const ACTIVATE_DISTANCE = 24;
const COMMIT_DISTANCE = 40;
const COMMIT_VELOCITY = 600;
const EXIT_MS = 120;

/** True while a swipe finishes a navigation: the screen has already slid away, so the stack must not animate again. */
export const swipeNavigation = { active: false };

function swipeGesture(
  enabled: boolean,
  direction: 1 | -1,
  offset: SharedValue<number>,
  start: SharedValue<number>,
  width: number,
  onCommit: () => void,
) {
  return Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX(direction * ACTIVATE_DISTANCE)
    .failOffsetY([-16, 16])
    .onStart((event) => {
      start.value = event.translationX;
    })
    .onUpdate((event) => {
      offset.value = direction * Math.max(0, direction * (event.translationX - start.value));
    })
    .onEnd((event) => {
      if (
        direction * (event.translationX - start.value) > COMMIT_DISTANCE ||
        direction * event.velocityX > COMMIT_VELOCITY
      ) {
        offset.value = withTiming(direction * width, { duration: EXIT_MS }, (finished) => {
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
 * Phone-sized Android: drag right anywhere in a chat to slide it away and return to the list, and
 * left anywhere in the list to reopen the chat that was last open. The screen follows the finger and slides off
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
    // The list returning from a chat that slid off to the right eases in from the left, as if uncovered.
    const uncovered = swipeNavigation.active && props.inList;
    swipeNavigation.active = false;
    if (uncovered) {
      offset.set(-width * 0.25);
      offset.set(withTiming(0, { duration: 200 }));
    } else offset.set(0);
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- the swap is what these flags change with
  }, [props.inChat, props.inList, offset, width]);

  const gesture = swipeGesture(
    props.inChat || (props.inList && props.canOpenLastChat),
    props.inChat ? 1 : -1,
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
