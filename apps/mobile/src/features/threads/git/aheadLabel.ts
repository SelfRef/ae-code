/** A feature branch counts its commits against the default branch; the default branch against its upstream. */
export function aheadLabel(status: {
  readonly isDefaultRef?: boolean;
  readonly aheadCount?: number;
  readonly aheadOfDefaultCount?: number;
}): string | null {
  const ahead = status.isDefaultRef
    ? (status.aheadCount ?? 0)
    : (status.aheadOfDefaultCount ?? status.aheadCount ?? 0);
  if (ahead <= 0) return null;
  return `${ahead} ahead`;
}
