import { useState } from "react";
import { Pressable } from "react-native";

import { SymbolView } from "../../components/ui/AppSymbol";
import { useAndroidControlSizing } from "../../components/ui/useAndroidControlSizing";
import { ComposerAttachmentDrawer } from "./ComposerAttachmentDrawer.android";
import type { ComposerAttachmentButtonProps } from "./ComposerAttachmentButton.types";

export function ComposerAttachmentButton(props: ComposerAttachmentButtonProps) {
  const { scale } = useAndroidControlSizing();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityLabel="Add attachment"
        accessibilityRole="button"
        accessibilityState={{ disabled: props.disabled }}
        className="size-[44px] shrink-0 items-center justify-center rounded-full active:opacity-70 disabled:opacity-50"
        disabled={props.disabled}
        onPress={props.supportsFiles ? () => setOpen(true) : () => void props.onPickMedia()}
      >
        <SymbolView
          name="plus"
          size={Math.round((props.size === "large" ? 26 : 20) * scale)}
          weight="regular"
          tintColorClassName="accent-icon"
          type="monochrome"
        />
      </Pressable>
      {open ? (
        <ComposerAttachmentDrawer
          onClose={() => setOpen(false)}
          onPickMedia={props.onPickMedia}
          onPickFiles={props.onPickFiles}
        />
      ) : null}
    </>
  );
}
