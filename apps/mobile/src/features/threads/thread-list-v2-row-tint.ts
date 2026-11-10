import { flattenThemeColor, isDarkThemeColor, themeColorWithAlpha } from "../../lib/mobileTheme";

/** The rows that wait on the user: Input, Done and an unsent draft. */
export type ThreadListV2RowTint = "input" | "done" | "draft";

// The web sidebar's question, success and warning colors at its light and dark strengths.
const TINTS: Record<ThreadListV2RowTint, { color: string; light: number; dark: number }> = {
  input: { color: "#a855f7", light: 0.06, dark: 0.12 },
  done: { color: "#10b981", light: 0.04, dark: 0.1 },
  draft: { color: "#f59e0b", light: 0.04, dark: 0.1 },
};

export function tintThreadListV2RowBackground(background: string, tint: ThreadListV2RowTint) {
  const { color, light, dark } = TINTS[tint];
  return flattenThemeColor(
    themeColorWithAlpha(color, isDarkThemeColor(background) ? dark : light),
    background,
  );
}
