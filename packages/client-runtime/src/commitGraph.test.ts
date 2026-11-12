import { expect, it } from "vite-plus/test";

import { layoutCommitGraph } from "./commitGraph.ts";

const commit = (sha: string, ...parents: string[]) => ({ sha, parents });

it("keeps a linear history in one lane", () => {
  const { rows, laneCount } = layoutCommitGraph([commit("c", "b"), commit("b", "a"), commit("a")]);
  expect(laneCount).toBe(1);
  expect(rows.map((row) => row.lane)).toEqual([0, 0, 0]);
  expect(rows[0]?.above).toEqual([]);
  expect(rows[1]?.above).toEqual([{ lane: 0, color: 0 }]);
  expect(rows[2]?.below).toEqual([]);
});

it("opens a lane for a merge's second parent and closes it where the branches meet", () => {
  // m merges f into main; f and b both continue from a.
  const { rows, laneCount } = layoutCommitGraph([
    commit("m", "b", "f"),
    commit("b", "a"),
    commit("f", "a"),
    commit("a"),
  ]);
  expect(laneCount).toBe(2);
  expect(rows[0]?.below).toEqual([
    { lane: 0, color: 0 },
    { lane: 1, color: 1 },
  ]);
  expect(rows[1]).toMatchObject({ lane: 0, through: [{ lane: 1, color: 1 }] });
  // f's line bends into the lane that already waits for a, and a then has one line above it.
  expect(rows[2]).toMatchObject({
    lane: 1,
    through: [{ lane: 0, color: 0 }],
    below: [{ lane: 0, color: 0 }],
  });
  expect(rows[3]).toMatchObject({ lane: 0, above: [{ lane: 0 }] });
});

it("starts a lane for a tip that no commit above it points to", () => {
  const { rows } = layoutCommitGraph([commit("x", "a"), commit("y", "a"), commit("a")]);
  expect(rows.map((row) => row.lane)).toEqual([0, 1, 0]);
});
