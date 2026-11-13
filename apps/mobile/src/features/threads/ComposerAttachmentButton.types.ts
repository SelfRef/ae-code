import type { Asset as LibraryAsset } from "expo-media-library/legacy";

/** Android's attach drawer passes the recent photos it shows; otherwise the system picker opens. */
export type PickMedia = (libraryAssets?: ReadonlyArray<LibraryAsset>) => Promise<void>;

export interface ComposerAttachmentButtonProps {
  readonly disabled?: boolean;
  readonly size?: "regular" | "large";
  readonly supportsFiles: boolean;
  readonly onPickMedia: PickMedia;
  readonly onPickFiles: () => Promise<void>;
}
