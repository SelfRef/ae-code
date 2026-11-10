import { describe, expect, it } from "vite-plus/test";

import { resolveMobileStageLabel } from "./mobileBranding";

describe("resolveMobileStageLabel", () => {
  it.each([
    ["development", "Dev"],
    ["preview", "Preview"],
    ["production", null],
    [undefined, null],
  ])("%s -> %s", (variant, label) => {
    expect(resolveMobileStageLabel(variant)).toBe(label);
  });
});
