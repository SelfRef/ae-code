import { useEffect, useState, type ReactNode } from "react";
import { BackHandler, View } from "react-native";

/** Below this the page shows the list or the open item, not both. */
export const SPLIT_PAGE_MIN_WIDTH = 640;
const LIST_WIDTH = 380;

/**
 * A list with an open item beside it where the page is wide, such as unfolded or on a tablet, and
 * one at a time where it is not. Measures the page itself, so it follows a pane or a fold.
 */
export function SplitPage(props: {
  readonly list: ReactNode;
  readonly open: boolean;
  /** `compact` is true when the item replaces the list, which then needs its own way back. */
  readonly renderDetail: (compact: boolean) => ReactNode;
  readonly emptyDetail: ReactNode;
  readonly onCloseDetail: () => void;
}) {
  const [width, setWidth] = useState<number | null>(null);
  const wide = width !== null && width >= SPLIT_PAGE_MIN_WIDTH;
  const { onCloseDetail } = props;
  const closesOnBack = props.open && !wide;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- subscribes to the platform's back button while an item replaces the list
  useEffect(() => {
    if (!closesOnBack) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onCloseDetail();
      return true;
    });
    return () => subscription.remove();
  }, [closesOnBack, onCloseDetail]);

  return (
    <View
      className="flex-1"
      collapsable={false}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width === null ? null : wide ? (
        <View className="flex-1 flex-row">
          <View className="border-r border-border" style={{ width: LIST_WIDTH }}>
            {props.list}
          </View>
          <View className="flex-1">
            {props.open ? props.renderDetail(false) : props.emptyDetail}
          </View>
        </View>
      ) : props.open ? (
        props.renderDetail(true)
      ) : (
        props.list
      )}
    </View>
  );
}
