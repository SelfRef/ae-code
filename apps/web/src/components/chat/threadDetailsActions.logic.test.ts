import { describe, expect, it } from "vite-plus/test";

import { hasUnmergedChanges } from "./threadDetailsActions.logic";

const clean = {
  isRepo: true,
  isDefaultRef: false,
  hasWorkingTreeChanges: false,
  aheadCount: 0,
  aheadOfDefaultCount: 0,
};

describe("hasUnmergedChanges", () => {
  it.each([
    ["no status yet", null, false],
    ["not a repository", { ...clean, isRepo: false, aheadOfDefaultCount: 2 }, false],
    ["clean and merged", clean, false],
    ["commits the default branch lacks", { ...clean, aheadOfDefaultCount: 1 }, true],
    ["uncommitted changes", { ...clean, hasWorkingTreeChanges: true }, true],
    ["on the default branch", { ...clean, isDefaultRef: true, aheadCount: 3 }, false],
    [
      "uncommitted on the default branch",
      { ...clean, isDefaultRef: true, hasWorkingTreeChanges: true },
      true,
    ],
    [
      "older server counts against the upstream",
      { ...clean, aheadCount: 2, aheadOfDefaultCount: undefined },
      true,
    ],
  ])("%s", (_name, status, expected) => {
    expect(hasUnmergedChanges(status)).toBe(expected);
  });
});
