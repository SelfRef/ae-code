export type MobileStageLabel = "Dev" | "Preview";

/** Release builds carry no stage; the others show it as a badge, and as a suffix of the app name. */
export function resolveMobileStageLabel(appVariant: unknown): MobileStageLabel | null {
  if (appVariant === "development") return "Dev";
  if (appVariant === "preview") return "Preview";
  return null;
}
