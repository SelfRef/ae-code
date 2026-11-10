const DIFF_COUNT_FORMAT = new Intl.NumberFormat();

export function formatDiffCount(count: number): string {
  return DIFF_COUNT_FORMAT.format(count);
}

const COMPACT_FORMAT = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

/** One decimal below 10, whole number above, using the locale's decimal separator. */
export function formatCompactMagnitude(value: number): string {
  return value < 10 ? COMPACT_FORMAT.format(value) : String(Math.round(value));
}
