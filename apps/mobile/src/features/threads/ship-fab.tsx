import type { SharedValue } from "react-native-reanimated";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";

import { ControlPill } from "../../components/ui/ControlPill";
import { PullRequestGlyph } from "../pull-requests/pullRequestGlyphs";
import type { ShipButton } from "./git/useShipAction";
import { FLOATING_WORKING_CONTROL_OFFSET } from "./floating-working-control";

const ICONS = {
  commit: "git.commit",
  merge: PullRequestGlyph.merged,
  settle: "checkmark.circle",
} as const;

const ROW_SHIFT = 52;

/** Bottom-right shortcut to the next step of the commit, merge, settle flow. */
export function ShipFab(props: {
  readonly action: ShipButton;
  /** Another floating control already uses the row above the composer. */
  readonly raised: boolean;
  readonly lift?: SharedValue<number>;
}) {
  const { raised, lift } = props;
  const shift = useDerivedValue(
    () =>
      withTiming(raised ? ROW_SHIFT : 0, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
    [raised],
  );
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -(shift.value + (lift?.value ?? 0)) }],
  }));
  return (
    <Animated.View
      pointerEvents="box-none"
      className="absolute right-4 z-20"
      style={[{ top: -FLOATING_WORKING_CONTROL_OFFSET }, style]}
    >
      <ControlPill
        variant="primary"
        icon={ICONS[props.action.kind]}
        label={props.action.label}
        disabled={props.action.disabled}
        onPress={props.action.onPress}
        className="shadow-md shadow-black/20"
      />
    </Animated.View>
  );
}
