import type { ReactNode } from "react";
import { Platform, Pressable, useWindowDimensions, View } from "react-native";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";

// Android's form sheet tops out at 640dp and sits flush left in a wider window, so there sheets
// open as this centered card instead.
const MAX_WIDTH = 640;

export function useWideAndroidSheet() {
  const { width } = useWindowDimensions();
  return Platform.OS === "android" && width > MAX_WIDTH;
}

/** A form sheet's detents as the card's height: the tallest one, or most of the window to fit. */
export function wideSheetHeightFraction(detents: unknown) {
  return Array.isArray(detents) && detents.every((detent) => typeof detent === "number")
    ? Math.min(0.9, Math.max(...detents))
    : 0.7;
}

export function WideSheetCard(props: {
  readonly heightFraction: number;
  readonly onDismiss: () => void;
  readonly children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  return (
    <View style={{ flex: 1, justifyContent: "flex-end" }}>
      <Pressable
        accessibilityLabel="Close"
        className="absolute inset-0 bg-black/32"
        onPress={props.onDismiss}
      />
      {/* A native sheet starts below the status bar. */}
      <SafeAreaInsetsContext value={{ ...insets, top: 0 }}>
        <View
          collapsable={false}
          className="self-center overflow-hidden rounded-t-[28px] bg-header"
          style={{ width: MAX_WIDTH, height: window.height * props.heightFraction }}
        >
          {props.children}
        </View>
      </SafeAreaInsetsContext>
    </View>
  );
}
