import type { EnvironmentId } from "@t3tools/contracts";
import { canMoveInto, entryName, entryParent } from "@t3tools/client-runtime/file-entry-paths";
import { useState } from "react";
import { LegendList } from "@legendapp/list/react-native";
import { Modal, Pressable, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { AppActivityIndicator } from "../../components/ui/AppActivityIndicator";
import { SymbolView } from "../../components/ui/AppSymbol";
import { AppText as Text } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { SheetHeader } from "../../components/ui/SheetHeader";
import { NativeScrollView } from "../../native/NativeScrollViewMarker";
import { projectEnvironment } from "../../state/projects";
import { useEnvironmentQuery } from "../../state/query";
import { uniqueCopyName } from "./fileTree";

export function FileEntryDestinationPicker(props: {
  readonly environmentId: EnvironmentId;
  readonly cwd: string;
  readonly mode: "move" | "copy";
  readonly source: { readonly path: string; readonly kind: "file" | "directory" };
  readonly onClose: () => void;
  readonly onSubmit: (folder: string, name: string) => void;
}) {
  const { mode, source } = props;
  const [folder, setFolder] = useState(entryParent(source.path));
  const listing = useEnvironmentQuery(
    projectEnvironment.listEntries({
      environmentId: props.environmentId,
      input: { cwd: props.cwd, directoryPath: folder },
    }),
  );
  const children = (listing.data?.entries ?? []).filter(
    (entry) => entryParent(entry.path) === folder,
  );
  const folders = children.filter((entry) => entry.kind === "directory");
  const sourceName = entryName(source.path);
  const siblingNames = children.map((entry) => entryName(entry.path));
  const name = mode === "copy" ? uniqueCopyName(sourceName, siblingNames) : sourceName;
  const isCurrentFolder = folder === entryParent(source.path);
  const blocked = !canMoveInto(source, folder) || (mode === "move" && isCurrentFolder);
  const verb = mode === "move" ? "Move" : "Copy";

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={props.onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider style={{ flex: 1 }}>
          <View className="flex-1 bg-screen">
            <SafeAreaView style={{ flex: 1 }}>
              <SheetHeader
                presentation="inline"
                title={`${verb} “${sourceName}”`}
                subtitle={folder === "" ? "Project root" : folder}
                onClose={props.onClose}
                accessibilityLabel={`Close ${mode} picker`}
              />
              <LegendList
                className="flex-1"
                renderScrollComponent={NativeScrollView}
                extraData={{ source }}
                estimatedItemSize={48}
                recycleItems
                data={folders}
                keyExtractor={(entry) => entry.path}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                  folder === "" ? undefined : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Up one folder"
                      onPress={() => setFolder(entryParent(folder))}
                      className="min-h-[48px] flex-row items-center gap-3 px-5 active:bg-subtle"
                    >
                      <SymbolView
                        name="arrow.turn.left.up"
                        size={18}
                        tintColorClassName="accent-icon-muted"
                        type="monochrome"
                      />
                      <Text className="text-sm font-t3-medium text-foreground-secondary">
                        Up one folder
                      </Text>
                    </Pressable>
                  )
                }
                renderItem={({ item }) => {
                  const enterable = canMoveInto(source, item.path);
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={item.path}
                      accessibilityState={{ disabled: !enterable }}
                      disabled={!enterable}
                      onPress={() => setFolder(item.path)}
                      className={`min-h-[48px] flex-row items-center gap-3 px-5 active:bg-subtle ${enterable ? "" : "opacity-40"}`}
                    >
                      <SymbolView
                        name="folder"
                        size={18}
                        tintColorClassName="accent-icon-subtle"
                        type="monochrome"
                      />
                      <Text
                        className="min-w-0 flex-1 text-sm font-t3-medium text-foreground-secondary"
                        numberOfLines={1}
                      >
                        {entryName(item.path)}
                      </Text>
                      <SymbolView
                        name="chevron.right"
                        size={12}
                        tintColorClassName="accent-icon-muted"
                        type="monochrome"
                      />
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <View className="px-5 py-5">
                    {listing.error ? (
                      <Text accessibilityRole="alert" className="text-xs text-foreground-muted">
                        {listing.error}
                      </Text>
                    ) : listing.isPending ? (
                      <AppActivityIndicator size="small" />
                    ) : (
                      <Text className="text-sm text-foreground-muted">No subfolders.</Text>
                    )}
                  </View>
                }
              />
              <View className="gap-2 px-5 pb-4 pt-2">
                {mode === "copy" && name !== sourceName ? (
                  <Text className="text-xs text-foreground-muted">Copied as “{name}”.</Text>
                ) : null}
                <Button
                  label={`${verb} here`}
                  tone="primary"
                  fullWidth
                  disabled={blocked || listing.data === null}
                  onPress={() => props.onSubmit(folder, name)}
                />
              </View>
            </SafeAreaView>
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}
