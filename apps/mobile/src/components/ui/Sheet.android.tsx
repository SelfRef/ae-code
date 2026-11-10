import { useState } from "react";
import { Modal, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { FormSheet } from "react-native-screens";
import { useResolveClassNames } from "uniwind";
import { AppBar } from "./AppBar";
import { RoutedFormSheetContext } from "./RoutedFormSheetContext";
import { ScreenContent } from "./ScreenContent";
import type { SheetProps } from "./Sheet.types";
import { useWideAndroidSheet, WideSheetCard } from "./WideSheetCard";
export type { SheetProps } from "./Sheet.types";

export function Sheet(props: SheetProps) {
  const containerStyle = useResolveClassNames("bg-header");
  const [isOpen, setIsOpen] = useState(true);
  const wide = useWideAndroidSheet();
  // Android flex children aren't bounded in a FormSheet, so the content sits in an absolute fill.
  const content = (
    <RoutedFormSheetContext value={false}>
      {/* Material drags target the first scroll view, so place content before the header. */}
      <View collapsable={false} className="absolute inset-0 flex-col-reverse bg-header">
        <ScreenContent>{props.children}</ScreenContent>
        <AppBar
          sheet
          title={props.title}
          onBack={props.dismissDisabled ? undefined : wide ? props.onClose : () => setIsOpen(false)}
          hideBottomBorder
        />
        <View
          pointerEvents="none"
          className="absolute top-1 h-1 w-8 self-center rounded-full bg-header-foreground/40"
        />
      </View>
    </RoutedFormSheetContext>
  );
  if (wide) {
    const dismiss = props.dismissDisabled ? () => {} : props.onClose;
    return (
      <Modal
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={dismiss}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <WideSheetCard heightFraction={0.9} onDismiss={dismiss}>
            {content}
          </WideSheetCard>
        </GestureHandlerRootView>
      </Modal>
    );
  }
  return (
    <FormSheet
      isOpen={isOpen}
      detents={[0.5, 0.9]}
      prefersGrabberVisible={false}
      preventNativeDismiss={props.dismissDisabled}
      nativeContainerStyle={containerStyle}
      onDismiss={props.onClose}
      onNativeDismiss={props.onClose}
    >
      {content}
    </FormSheet>
  );
}
