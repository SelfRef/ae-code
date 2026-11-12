import { COMMIT_GRAPH_COLORS, type CommitGraphRow } from "@t3tools/client-runtime/commit-graph";
import { View } from "react-native";
import { Circle, Path, Svg } from "react-native-svg";

export const COMMIT_ROW_HEIGHT = 56;
const LANE_WIDTH = 12;
const MAX_LANES = 8;

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
 * One row's slice of the graph. The bends and the dot are drawn in the top `COMMIT_ROW_HEIGHT`;
 * lines that run on through an opened commit's details are plain views, which follow the row's
 * height as it changes (an SVG would keep the height it measured first).
 */
export function CommitGraphGutter(props: {
  readonly row: CommitGraphRow;
  readonly laneCount: number;
}) {
  const { row } = props;
  const middle = COMMIT_ROW_HEIGHT / 2;
  const x = laneX(row.lane);
  const stroke = { strokeWidth: 1.5, fill: "none", strokeLinecap: "round" } as const;
  const line = (key: string, lane: number, color: number, top: number) => (
    <View
      key={key}
      style={{
        position: "absolute",
        top,
        bottom: 0,
        left: laneX(lane) - 0.75,
        width: 1.5,
        backgroundColor: LANE_COLORS[color],
      }}
    />
  );
  return (
    <View style={{ width: commitGraphWidth(props.laneCount) + 4 }}>
      {row.through.map((edge) => line(`through-${edge.lane}`, edge.lane, edge.color, 0))}
      {row.below.map((edge) =>
        line(`continue-${edge.lane}`, edge.lane, edge.color, COMMIT_ROW_HEIGHT),
      )}
      <Svg width="100%" height={COMMIT_ROW_HEIGHT}>
        {row.above.map((edge) => (
          <Path
            key={`above-${edge.lane}`}
            d={`M ${laneX(edge.lane)} 0 Q ${laneX(edge.lane)} ${middle} ${x} ${middle}`}
            stroke={LANE_COLORS[edge.color]}
            {...stroke}
          />
        ))}
        {row.below.map((edge) => (
          <Path
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
        <Circle cx={x} cy={middle} r={4} fill={LANE_COLORS[row.color]} />
      </Svg>
    </View>
  );
}
