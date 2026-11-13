import type { SharedValue } from "react-native-reanimated";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";

import { Pressable } from "react-native";

import { AppActivityIndicator } from "../../components/ui/AppActivityIndicator";
import { AppText as Text } from "../../components/ui/AppText";
import { SymbolView } from "../../components/ui/AppSymbol";
import { PullRequestGlyph } from "../pull-requests/pullRequestGlyphs";
import type { ShipButton } from "./git/useShipAction";
import { FLOATING_WORKING_CONTROL_OFFSET } from "./floating-working-control";

const ICONS = {
  commit: "git.commit",
  merge: PullRequestGlyph.merged,
  settle: "checkmark.circle",
} as const;

// One colour per step so the next one is recognisable at a glance.
const TONES = {
  commit: "bg-primary",
  merge: "bg-violet-600",
  settle: "bg-emerald-600",
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.action.label}
        accessibilityState={{ disabled: props.action.disabled, busy: props.action.loading }}
        disabled={props.action.disabled}
        onPress={props.action.onPress}
        className={`h-11 flex-row items-center justify-center gap-2 rounded-full px-5 shadow-md shadow-black/20 ${TONES[props.action.kind]} ${props.action.disabled ? "opacity-60" : ""}`}
      >
        {props.action.loading ? (
          <AppActivityIndicator size="small" color="#ffffff" />
        ) : (
          <SymbolView
            name={ICONS[props.action.kind]}
            size={16}
            tintColor="#ffffff"
            type="monochrome"
          />
        )}
        <Text className="text-center font-t3-bold text-xs text-white">{props.action.label}</Text>
      </Pressable>
    </Animated.View>
  );
}
