// The fork ships one icon set (assets/dev); it has no release channels with their own branding.
export const BRAND_ASSET_PATHS = {
  developmentIconComposerProject: "assets/dev/app-icon.icon",
  developmentIosIconPng: "assets/dev/blueprint-ios-1024.png",
  developmentUniversalIconPng: "assets/dev/blueprint-universal-1024.png",
  developmentDesktopIconPng: "assets/dev/blueprint-macos-1024.png",
  developmentLinuxIconSvg: "assets/dev/blueprint-linux.svg",
  developmentWindowsIconIco: "assets/dev/blueprint-windows.ico",
  developmentWebFaviconIco: "assets/dev/blueprint-web-favicon.ico",
  developmentWebFavicon16Png: "assets/dev/blueprint-web-favicon-16x16.png",
  developmentWebFavicon32Png: "assets/dev/blueprint-web-favicon-32x32.png",
  developmentWebAppleTouchIconPng: "assets/dev/blueprint-web-apple-touch-180.png",
  developmentWebIcon192Png: "assets/dev/blueprint-web-icon-192x192.png",
  developmentWebIcon512Png: "assets/dev/blueprint-web-icon-512x512.png",
} as const;

export interface IconOverride {
  readonly sourceRelativePath: string;
  readonly targetRelativePath: string;
}

export function resolveWebIconOverrides(targetDirectory: string): ReadonlyArray<IconOverride> {
  return [
    [BRAND_ASSET_PATHS.developmentWebFaviconIco, "favicon.ico"],
    [BRAND_ASSET_PATHS.developmentWebFavicon16Png, "favicon-16x16.png"],
    [BRAND_ASSET_PATHS.developmentWebFavicon32Png, "favicon-32x32.png"],
    [BRAND_ASSET_PATHS.developmentWebAppleTouchIconPng, "apple-touch-icon.png"],
    [BRAND_ASSET_PATHS.developmentWebIcon192Png, "icon-192x192.png"],
    [BRAND_ASSET_PATHS.developmentWebIcon512Png, "icon-512x512.png"],
  ].map(([sourceRelativePath, filename]) => ({
    sourceRelativePath: sourceRelativePath!,
    targetRelativePath: `${targetDirectory}/${filename}`,
  }));
}

export const DEVELOPMENT_ICON_OVERRIDES = resolveWebIconOverrides("dist/client");

export const DEVELOPMENT_PUBLIC_ICON_OVERRIDES = resolveWebIconOverrides("apps/web/public");
