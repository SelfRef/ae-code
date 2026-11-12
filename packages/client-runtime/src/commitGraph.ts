import type { VcsCommitLogEntry } from "@t3tools/contracts";

export const COMMIT_GRAPH_COLORS = 8;

export interface CommitGraphEdge {
  /** The lane the line runs in, or reaches from or to the commit's own lane. */
  readonly lane: number;
  readonly color: number;
}

export interface CommitGraphRow {
  /** The commit's lane and the color of its dot. */
  readonly lane: number;
  readonly color: number;
  /** Lines that run past the commit from the row's top edge to its bottom edge. */
  readonly through: ReadonlyArray<CommitGraphEdge>;
  /** Lines from the top edge to the commit: its children, or a branch that ends here. */
  readonly above: ReadonlyArray<CommitGraphEdge>;
  /** Lines from the commit to the bottom edge: one per parent. */
  readonly below: ReadonlyArray<CommitGraphEdge>;
}

export interface CommitGraph {
  readonly rows: ReadonlyArray<CommitGraphRow>;
  readonly laneCount: number;
}

/**
 * Lays out commits (newest first, every child before its parents) in lanes, as VS Code's graph does.
 * A lane waits for the commit it expects next; a commit takes the lane that waits for it, or the first
 * free one, and hands it to its first parent, while other parents get a lane of their own.
 */
export function layoutCommitGraph(
  commits: ReadonlyArray<Pick<VcsCommitLogEntry, "sha" | "parents">>,
): CommitGraph {
  const lanes: Array<{ sha: string; color: number } | null> = [];
  let created = 0;
  const newColor = () => created++ % COMMIT_GRAPH_COLORS;
  let laneCount = 1;
  const rows = commits.map((commit): CommitGraphRow => {
    const waiting = lanes.flatMap((entry, lane) => (entry?.sha === commit.sha ? [lane] : []));
    const free = lanes.indexOf(null);
    const lane = waiting[0] ?? (free >= 0 ? free : lanes.length);
    const color = (waiting[0] === undefined ? undefined : lanes[waiting[0]]?.color) ?? newColor();
    const above = waiting.map((from) => ({ lane: from, color: lanes[from]?.color ?? color }));
    const through = lanes.flatMap((entry, from) =>
      entry !== null && !waiting.includes(from) ? [{ lane: from, color: entry.color }] : [],
    );
    for (const from of waiting) lanes[from] = null;
    const below: CommitGraphEdge[] = [];
    commit.parents.forEach((parent, index) => {
      const existing = lanes.findIndex((entry) => entry?.sha === parent);
      if (existing >= 0) {
        below.push({ lane: existing, color: lanes[existing]?.color ?? color });
        return;
      }
      const target =
        index === 0 ? lane : lanes.indexOf(null) >= 0 ? lanes.indexOf(null) : lanes.length;
      const parentColor = index === 0 ? color : newColor();
      lanes[target] = { sha: parent, color: parentColor };
      below.push({ lane: target, color: parentColor });
    });
    while (lanes.length > 0 && lanes.at(-1) === null) lanes.pop();
    laneCount = Math.max(
      laneCount,
      lane + 1,
      ...above.map((edge) => edge.lane + 1),
      ...through.map((edge) => edge.lane + 1),
      ...below.map((edge) => edge.lane + 1),
    );
    return { lane, color, through, above, below };
  });
  return { rows, laneCount };
}

/** The limit of the next, larger request: lists grow by doubling, so a long history takes few round trips. */
export function nextCommitLogLimit(limit: number, max: number): number {
  return Math.min(limit * 2, max);
}

/** A decoration as the badge shows it: a tag without its `tag: ` prefix. */
export function commitRefLabel(ref: string) {
  return ref.startsWith("tag: ")
    ? { name: ref.slice("tag: ".length), isTag: true }
    : { name: ref, isTag: false };
}
