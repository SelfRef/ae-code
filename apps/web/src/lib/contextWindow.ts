import { formatCompactMagnitude } from "@t3tools/client-runtime/diff-count";

export function formatContextWindowTokens(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "0";
  }
  if (value < 1_000) {
    return `${Math.round(value)}`;
  }
  if (value < 10_000) {
    return `${formatCompactMagnitude(value / 1_000)}k`;
  }
  if (value < 999_500) {
    return `${Math.round(value / 1_000)}k`;
  }
  return `${formatCompactMagnitude(value / 1_000_000)}m`;
}
