import { Image } from "expo-image";
import {
  getAssetsAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  type Asset,
} from "expo-media-library/legacy";
import { useEffect, useState } from "react";
import { LegendList } from "@legendapp/list/react-native";
import { Pressable, View } from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "../../components/ui/AppText";
import { SymbolView } from "../../components/ui/AppSymbol";
import { OverlayPortal } from "../../components/ui/OverlayPortal";
import { useHardwareBack } from "../../lib/backHandler";
import { NativeScrollView } from "../../native/NativeScrollViewMarker";
import type { PickMedia } from "./ComposerAttachmentButton.types";

const RECENT_PHOTO_COUNT = 40;
const THUMB_HEIGHT = 168;
const THUMB_WIDTH = 126;
const PHOTO_PERMISSIONS = ["photo" as const];

type Access = "unknown" | "granted" | "askable" | "denied";

function accessFrom(response: { granted: boolean; canAskAgain: boolean }): Access {
  return response.granted ? "granted" : response.canAskAgain ? "askable" : "denied";
}

function DrawerAction(props: { icon: "photo" | "folder"; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      className="w-20 items-center gap-2 active:opacity-70"
      onPress={props.onPress}
    >
      <View className="size-16 items-center justify-center rounded-full border border-border bg-card-alt">
        <SymbolView
          name={props.icon}
          size={26}
          weight="regular"
          tintColorClassName="accent-icon"
          type="monochrome"
        />
      </View>
      <Text className="text-sm text-foreground">{props.label}</Text>
    </Pressable>
  );
}

/** Recent photos plus Gallery and File buttons, shown in-window so the keyboard stays open. */
export function ComposerAttachmentDrawer(props: {
  readonly onClose: () => void;
  readonly onPickMedia: PickMedia;
  readonly onPickFiles: () => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardState((state) => (state.isVisible ? state.height : 0));
  const [access, setAccess] = useState<Access>("unknown");
  const [photos, setPhotos] = useState<ReadonlyArray<Asset>>([]);
  const [selected, setSelected] = useState<ReadonlyArray<Asset>>([]);
  useHardwareBack(true, () => {
    props.onClose();
    return true;
  });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- reads the OS permission once when the drawer opens
  useEffect(() => {
    let active = true;
    getPermissionsAsync(false, PHOTO_PERMISSIONS)
      .then((response) => active && setAccess(accessFrom(response)))
      .catch(() => active && setAccess("denied"));
    return () => {
      active = false;
    };
  }, []);

  const granted = access === "granted";
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- loads thumbnails from MediaStore once permission is granted
  useEffect(() => {
    if (!granted) return;
    let active = true;
    getAssetsAsync({
      first: RECENT_PHOTO_COUNT,
      mediaType: "photo",
      sortBy: [["creationTime", false]],
    })
      .then((page) => active && setPhotos(page.assets))
      .catch(() => active && setAccess("denied"));
    return () => {
      active = false;
    };
  }, [granted]);

  const toggle = (asset: Asset) =>
    setSelected((current) =>
      current.some((entry) => entry.id === asset.id)
        ? current.filter((entry) => entry.id !== asset.id)
        : [...current, asset],
    );
  const choose = (action: () => Promise<void>) => {
    props.onClose();
    void action();
  };

  return (
    <OverlayPortal>
      <View className="absolute inset-0 justify-end">
        <Pressable
          accessible={false}
          className="absolute inset-0 bg-black/40"
          onPress={props.onClose}
        />
        <View
          className="w-full max-w-[640px] self-center rounded-t-3xl bg-sheet pt-3"
          style={{ paddingBottom: Math.max(16, keyboardHeight || insets.bottom) }}
        >
          <View pointerEvents="none" className="mb-3 h-1 w-8 self-center rounded-full bg-border" />
          {granted ? (
            <LegendList
              horizontal
              renderScrollComponent={NativeScrollView}
              extraData={selected}
              estimatedItemSize={THUMB_WIDTH}
              recycleItems
              showsHorizontalScrollIndicator={false}
              data={photos}
              keyExtractor={(asset) => asset.id}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
              style={{ height: THUMB_HEIGHT, flexGrow: 0 }}
              renderItem={({ item }) => {
                const order = selected.findIndex((entry) => entry.id === item.id);
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={item.filename}
                    accessibilityState={{ selected: order >= 0 }}
                    onPress={() => toggle(item)}
                  >
                    <Image
                      source={{ uri: item.uri }}
                      recyclingKey={item.id}
                      contentFit="cover"
                      className="rounded-xl bg-card-alt"
                      style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
                    />
                    {order >= 0 ? (
                      <View className="absolute right-2 top-2 size-6 items-center justify-center rounded-full bg-primary">
                        <Text className="text-xs font-t3-bold text-primary-foreground">
                          {order + 1}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              }}
            />
          ) : access === "askable" ? (
            <Pressable
              accessibilityRole="button"
              className="mx-4 items-center justify-center rounded-xl border border-border bg-card-alt active:opacity-70"
              style={{ height: 72 }}
              onPress={() =>
                void requestPermissionsAsync(false, PHOTO_PERMISSIONS)
                  .then((response) => setAccess(accessFrom(response)))
                  .catch(() => setAccess("denied"))
              }
            >
              <Text className="text-foreground">Show recent photos</Text>
            </Pressable>
          ) : null}
          {selected.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              className="mx-4 mt-3 items-center rounded-full bg-primary py-3 active:opacity-80"
              onPress={() => choose(() => props.onPickMedia(selected))}
            >
              <Text className="font-t3-bold text-primary-foreground">
                Attach {selected.length} {selected.length === 1 ? "photo" : "photos"}
              </Text>
            </Pressable>
          ) : null}
          <View className="mt-4 flex-row justify-evenly px-4">
            <DrawerAction
              icon="photo"
              label="Gallery"
              onPress={() => choose(() => props.onPickMedia())}
            />
            <DrawerAction icon="folder" label="File" onPress={() => choose(props.onPickFiles)} />
          </View>
        </View>
      </View>
    </OverlayPortal>
  );
}
