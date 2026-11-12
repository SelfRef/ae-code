import { COMMIT_GRAPH_COLORS, type CommitGraphRow } from "@t3tools/client-runtime/commit-graph";

export const COMMIT_ROW_HEIGHT = 32;
const LANE_WIDTH = 12;
const MAX_LANES = 10;
const DOT_RADIUS = 4;

// Data colors for the lanes: the same on both themes, apart from the dot's outline.
const LANE_COLORS = [
  "#4c9be8",
  "#e8a24c",
  "#5fbf6a",
  "#c566d9",
  "#e55f5f",
  "#3fc1c9",
  "#d6c34a",
  "#8d7de0",
] as const satisfies ReadonlyArray<string> & { length: typeof COMMIT_GRAPH_COLORS };

const laneX = (lane: number) => (Math.min(lane, MAX_LANES - 1) + 0.5) * LANE_WIDTH;

export const commitGraphWidth = (laneCount: number) => Math.min(laneCount, MAX_LANES) * LANE_WIDTH;

/**
 * One row's slice of the graph. It fills the row's whole height, so the lines go on through a
 * commit's expanded details; only the top `COMMIT_ROW_HEIGHT` holds the dot and the bends.
 */
export function CommitGraphGutter({ row }: { row: CommitGraphRow }) {
  const middle = COMMIT_ROW_HEIGHT / 2;
  const x = laneX(row.lane);
  const stroke = { strokeWidth: 1.5, fill: "none", strokeLinecap: "round" } as const;
  return (
    <svg aria-hidden className="absolute inset-0 size-full overflow-hidden">
      {row.through.map((edge) => (
        <line
          key={`through-${edge.lane}`}
          x1={laneX(edge.lane)}
          x2={laneX(edge.lane)}
          y1={0}
          y2="100%"
          stroke={LANE_COLORS[edge.color]}
          {...stroke}
        />
      ))}
      {row.above.map((edge) => (
        <path
          key={`above-${edge.lane}`}
          d={`M ${laneX(edge.lane)} 0 Q ${laneX(edge.lane)} ${middle} ${x} ${middle}`}
          stroke={LANE_COLORS[edge.color]}
          {...stroke}
        />
      ))}
      {row.below.map((edge) => (
        <path
          key={`below-${edge.lane}`}
          d={
            edge.lane === row.lane
              ? `M ${x} ${middle} L ${x} ${COMMIT_ROW_HEIGHT}`
              : `M ${x} ${middle} Q ${laneX(edge.lane)} ${middle} ${laneX(edge.lane)} ${COMMIT_ROW_HEIGHT}`
          }
          stroke={LANE_COLORS[edge.color]}
          {...stroke}
        />
      ))}
      {row.below.map((edge) => (
        <line
          key={`continue-${edge.lane}`}
          x1={laneX(edge.lane)}
          x2={laneX(edge.lane)}
          y1={COMMIT_ROW_HEIGHT}
          y2="100%"
          stroke={LANE_COLORS[edge.color]}
          {...stroke}
        />
      ))}
      <circle
        cx={x}
        cy={middle}
        r={DOT_RADIUS}
        fill={LANE_COLORS[row.color]}
        className="stroke-background"
        strokeWidth={2}
      />
    </svg>
  );
}
