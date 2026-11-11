import type { VcsStatusResult } from "@t3tools/contracts";

/** Uncommitted changes, or commits the local default branch does not have yet. Unknown status counts as merged. */
export function hasUnmergedChanges(
  status:
    | Pick<
        VcsStatusResult,
        "isRepo" | "isDefaultRef" | "hasWorkingTreeChanges" | "aheadCount" | "aheadOfDefaultCount"
      >
    | null
    | undefined,
): boolean {
  if (!status?.isRepo) return false;
  if (status.hasWorkingTreeChanges) return true;
  // Older servers do not count against the default branch; their upstream count is the closest.
  return !status.isDefaultRef && (status.aheadOfDefaultCount ?? status.aheadCount) > 0;
}
