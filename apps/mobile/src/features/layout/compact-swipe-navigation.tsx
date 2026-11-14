import { useEffect, useEffectEvent, useState, useSyncExternalStore, type ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { PaneContext } from "../../components/ui/Pane";
import { HomeRouteScreen } from "../home/HomeRouteScreen";
import { HomeRouteShownContext } from "../home/home-route-visibility";
import { useWorkspaceBackNavigation } from "./workspace/useAndroidWorkspaceNavigation";

// Activates after 24dp. A chat slides away to the right, uncovering the list; the list slides away
// to the left, since its rows reveal their actions on a right swipe and the two never compete.
const ACTIVATE_DISTANCE = 24;
const COMMIT_DISTANCE = 40;
const COMMIT_VELOCITY = 600;
const EXIT_MS = 120;

let swipeActive = false;
const swipeListeners = new Set<() => void>();

function setSwipeActive(active: boolean) {
  if (swipeActive === active) return;
  swipeActive = active;
  swipeListeners.forEach((listener) => listener());
}

/** True while a swipe finishes a navigation: the screen has already slid away, so the stack must not animate again. */
export function useSwipeNavigationActive() {
  return useSyncExternalStore(
    (listener) => {
      swipeListeners.add(listener);
      return () => swipeListeners.delete(listener);
    },
    () => swipeActive,
  );
}

function swipeGesture(
  enabled: boolean,
  direction: 1 | -1,
  offset: SharedValue<number>,
  start: SharedValue<number>,
  width: number,
  onCommit: () => void,
  onSwipe: (swiping: boolean) => void,
) {
  return Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX(direction * ACTIVATE_DISTANCE)
    .failOffsetY([-16, 16])
    .onStart((event) => {
      start.value = event.translationX;
      runOnJS(onSwipe)(true);
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
        offset.value = withSpring(0, undefined, (finished) => {
          if (finished) runOnJS(onSwipe)(false);
        });
      }
    })
    .onFinalize((_event, success) => {
      if (!success) offset.value = withSpring(0, undefined, () => runOnJS(onSwipe)(false));
    });
}

/**
 * Phone-sized Android: drag right anywhere in a chat to slide it away and return to the list, and
 * left anywhere in the list to reopen the chat that was last open. The screen follows the finger and slides off
 * before the navigation happens. While a chat is dragged, a second copy of the list sits under it,
 * since the stack detaches the list as soon as the chat covers it.
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
  const [swiping, setSwiping] = useState(false);

  const commit = useEffectEvent(() => {
    setSwipeActive(true);
    // The stack reads the flag when a screen renders, and a screen that is popped can no longer
    // re-render: let it render with no animation before navigating.
    setTimeout(() => {
      if (props.inChat) goToList();
      else props.onOpenLastChat();
    }, 0);
    // The screen swap resets the offset below; this only rescues a navigation that did not happen and
    // drops the list copy under the chat.
    setTimeout(() => {
      setSwipeActive(false);
      setSwiping(false);
      offset.set(withTiming(0));
    }, 600);
  });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- brings the new screen back to rest once the swipe's navigation has swapped it in
  useEffect(() => {
    setSwipeActive(false);
    offset.set(0);
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- the swap is what these flags change with
  }, [props.inChat, props.inList, offset]);

  const gesture = swipeGesture(
    props.inChat || (props.inList && props.canOpenLastChat),
    props.inChat ? 1 : -1,
    offset,
    start,
    width,
    commit,
    setSwiping,
  );
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  return (
    <View style={{ flex: 1 }}>
      {props.inChat && swiping ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <PaneContext value="content">
            <HomeRouteShownContext value>
              <HomeRouteScreen />
            </HomeRouteShownContext>
          </PaneContext>
        </View>
      ) : null}
      <GestureDetector gesture={gesture}>
        <Animated.View style={[{ flex: 1 }, style]}>{props.children}</Animated.View>
      </GestureDetector>
    </View>
  );
}
