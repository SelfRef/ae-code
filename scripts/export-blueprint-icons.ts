#!/usr/bin/env node

// The fork has no Icon Composer (macOS only): render the desktop, iOS and web icons from the
// same layer SVGs as the Android ones (`export-android-icons.ts`), with a larger glyph, so every
// platform shows the same blueprint tile.

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import sharp from "sharp";

const CANVAS = 1024;
const MAC_BODY = 824;
const CORNER_RADIUS_FRACTION = 0.2237;
const SVG_DENSITY = 300;
const TEXT = { x: 16.8, y: 29.6, width: 94.4, height: 71.8 };
const WORDMARK_FRACTION = 0.78;
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256] as const;

export class BlueprintIconRenderError extends Schema.TaggedError<BlueprintIconRenderError>()(
  "BlueprintIconRenderError",
  { step: Schema.String, cause: Schema.Defect() },
) {}

const attempt = <A>(step: string, run: () => Promise<A>) =>
  Effect.tryPromise({ try: run, catch: (cause) => new BlueprintIconRenderError({ step, cause }) });

const layerSvg = (svg: string) =>
  svg
    .replace(
      /(<svg[^>]*>)/,
      '$1<defs><linearGradient id="glyph" gradientUnits="userSpaceOnUse" x1="0" y1="23.877" x2="0" y2="95.077"><stop offset="0" stop-color="#F5F9FD"/><stop offset="1" stop-color="#D2E0EF"/></linearGradient></defs>',
    )
    .replace('fill="white"', 'fill="url(#glyph)"');

const wordmarkTransform = (size: number) => {
  const scale = (size * WORDMARK_FRACTION) / TEXT.width;
  const tx = (size - TEXT.width * scale) / 2 - TEXT.x * scale;
  const ty = (size - TEXT.height * scale) / 2 - TEXT.y * scale;
  return `translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${scale.toFixed(4)})`;
};

const innerSvg = (svg: string) => svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

// The layer in the wordmark's frame (as on Android); the background fills the canvas.
const renderLayer = (svg: string, size: number, wordmark: boolean) =>
  attempt("layer", () =>
    sharp(
      Buffer.from(
        wordmark
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none"><g transform="${wordmarkTransform(size)}">${innerSvg(svg)}</g></svg>`
          : svg,
      ),
      { density: SVG_DENSITY },
    )
      .resize(size, size)
      .png()
      .toBuffer(),
  );

// The tile as one vector image (Linux icon themes scale it to any size).
const composeSvg = (layers: { background: string; annotations: string; text: string }) => {
  const frame = wordmarkTransform(CANVAS);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}" fill="none"><defs><clipPath id="tile"><rect width="${CANVAS}" height="${CANVAS}" rx="${CANVAS * CORNER_RADIUS_FRACTION}"/></clipPath></defs><g clip-path="url(#tile)"><g transform="scale(${CANVAS / 128})">${innerSvg(layers.background)}</g><g transform="${frame}">${innerSvg(layers.annotations)}</g><g transform="${frame}">${innerSvg(layerSvg(layers.text))}</g></g></svg>\n`;
};

const roundedMask = (size: number, fill = "#fff") =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * CORNER_RADIUS_FRACTION}" fill="${fill}"/></svg>`,
  );

const renderTile = Effect.fn("blueprintIcons.renderTile")(function* (
  layers: { background: string; annotations: string; text: string },
  size: number,
) {
  const [background, annotations, text] = yield* Effect.all([
    renderLayer(layers.background, size, false),
    renderLayer(layers.annotations, size, true),
    renderLayer(layerSvg(layers.text), size, true),
  ]);
  return yield* attempt("tile", () =>
    sharp(background)
      .composite([
        { input: annotations },
        { input: text },
        { input: roundedMask(size), blend: "dest-in" },
      ])
      .png()
      .toBuffer(),
  );
});

// The classic macOS body: 824 of 1024, with the native-looking drop shadow around it.
const renderMacTile = (tile: Buffer) =>
  attempt("mac", async () => {
    const body = await sharp(tile).resize(MAC_BODY, MAC_BODY).png().toBuffer();
    const shadow = await sharp({
      create: {
        width: CANVAS,
        height: CANVAS,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: await sharp(roundedMask(MAC_BODY, "#000")).png().toBuffer(),
          left: 100,
          top: 112,
        },
      ])
      .blur(12)
      .linear([1, 1, 1, 0.5], [0, 0, 0, 0])
      .png()
      .toBuffer();
    return sharp(shadow)
      .composite([{ input: body, left: 100, top: 100 }])
      .png()
      .toBuffer();
  });

const resized = (tile: Buffer, size: number) =>
  attempt("resize", () => sharp(tile).resize(size, size).png().toBuffer());

// ICO with PNG-encoded images.
const encodeIco = (images: ReadonlyArray<{ size: number; png: Buffer }>) => {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size === 256 ? 0 : size, entry);
    header.writeUInt8(size === 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map(({ png }) => png)]);
};

const exportBlueprintIcons = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.resolve(import.meta.dirname, "..");
  const read = (file: string) =>
    fs.readFileString(path.join(root, "assets", "dev", "app-icon.icon", "Assets", file));
  const raw = {
    background: yield* read("background.svg"),
    annotations: yield* read("annotations.svg"),
    text: yield* read("text.svg"),
  };
  // The tile is rounded here; the source SVG's own iOS corner clip would double it.
  const layers = {
    ...raw,
    background: raw.background.replace(
      /<rect width="128" height="128" rx="10"\/>/,
      '<rect width="128" height="128"/>',
    ),
  };

  const tile = yield* renderTile(layers, CANVAS);
  const ico = encodeIco(
    yield* Effect.all(
      ICO_SIZES.map((size) => resized(tile, size).pipe(Effect.map((png) => ({ size, png })))),
    ),
  );
  const web = {
    "apple-touch-icon.png": yield* resized(tile, 180),
    "favicon-16x16.png": yield* resized(tile, 16),
    "favicon-32x32.png": yield* resized(tile, 32),
    "favicon.ico": ico,
    "icon-192x192.png": yield* resized(tile, 192),
    "icon-512x512.png": yield* resized(tile, 512),
  };
  const outputs: ReadonlyArray<readonly [string, Buffer]> = [
    ["assets/dev/blueprint-ios-1024.png", tile],
    ["assets/dev/blueprint-universal-1024.png", tile],
    ["assets/dev/blueprint-macos-1024.png", yield* renderMacTile(tile)],
    ["assets/dev/blueprint-linux.svg", Buffer.from(composeSvg(layers))],
    ["assets/dev/blueprint-windows.ico", ico],
    ["assets/dev/blueprint-web-apple-touch-180.png", web["apple-touch-icon.png"]],
    ["assets/dev/blueprint-web-favicon-16x16.png", web["favicon-16x16.png"]],
    ["assets/dev/blueprint-web-favicon-32x32.png", web["favicon-32x32.png"]],
    ["assets/dev/blueprint-web-favicon.ico", ico],
    ["assets/dev/blueprint-web-icon-192x192.png", web["icon-192x192.png"]],
    ["assets/dev/blueprint-web-icon-512x512.png", web["icon-512x512.png"]],
    ...Object.entries(web).map(
      ([name, contents]) => [`apps/web/public/${name}`, contents] as const,
    ),
  ];
  for (const [file, contents] of outputs) {
    yield* fs.writeFile(path.join(root, file), contents);
    yield* Console.log(`wrote ${file}`);
  }
});

if (import.meta.main) {
  exportBlueprintIcons.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
}
