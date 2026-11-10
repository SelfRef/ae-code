import type { VcsBranchOverviewEntry } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

export const BRANCH_OVERVIEW_LIMIT = 200;

/** `for-each-ref` format read by {@link parseOverviewRefs}; the subject goes last as it may hold tabs. */
export const BRANCH_OVERVIEW_REF_FORMAT =
  "%(refname)%09%(committerdate:unix)%09%(upstream:short)%09%(upstream:track,nobracket)%09%(contents:subject)";

export interface OverviewRefInfo {
  readonly lastCommitAt: string | null;
  readonly upstream: string | null;
  readonly upstreamGone: boolean;
  readonly ahead: number;
  readonly behind: number;
  readonly subject: string;
}

/** `ahead 1, behind 2`, `ahead 1`, `gone` or empty, as `%(upstream:track,nobracket)` prints it. */
function parseUpstreamTrack(track: string) {
  return {
    gone: track.trim() === "gone",
    ahead: Number(/ahead (\d+)/.exec(track)?.[1] ?? 0),
    behind: Number(/behind (\d+)/.exec(track)?.[1] ?? 0),
  };
}

export function parseOverviewRefs(stdout: string): Map<string, OverviewRefInfo> {
  const refs = new Map<string, OverviewRefInfo>();
  for (const line of stdout.split("\n")) {
    const [refName, unix, upstream, track, ...subject] = line.split("\t");
    if (!refName) continue;
    const seconds = Number.parseInt(unix ?? "", 10);
    refs.set(refName, {
      lastCommitAt: Number.isFinite(seconds)
        ? DateTime.formatIso(DateTime.makeUnsafe(seconds * 1000))
        : null,
      upstream: upstream || null,
      ...(({ gone, ahead, behind }) => ({ upstreamGone: gone, ahead, behind }))(
        parseUpstreamTrack(track ?? ""),
      ),
      subject: subject.join("\t"),
    });
  }
  return refs;
}

/** The default branch first, then the rest by latest commit. */
export function orderBranchOverview<T extends Pick<VcsBranchOverviewEntry, "isDefault" | "name">>(
  entries: ReadonlyArray<T & { readonly lastCommitAt: string | null }>,
) {
  return entries.toSorted(
    (left, right) =>
      Number(right.isDefault) - Number(left.isDefault) ||
      (right.lastCommitAt ?? "").localeCompare(left.lastCommitAt ?? "") ||
      left.name.localeCompare(right.name),
  );
}
