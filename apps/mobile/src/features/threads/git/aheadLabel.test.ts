import { expect, it } from "vite-plus/test";

import { aheadLabel } from "./aheadLabel";

it("counts a feature branch against the default branch, not its upstream", () => {
  expect(aheadLabel({ aheadCount: 5, aheadOfDefaultCount: 0 })).toBeNull();
  expect(aheadLabel({ aheadCount: 0, aheadOfDefaultCount: 2 })).toBe("2 ahead");
  expect(aheadLabel({ aheadCount: 3 })).toBe("3 ahead");
});

it("counts the default branch against its upstream", () => {
  expect(aheadLabel({ isDefaultRef: true, aheadCount: 4, aheadOfDefaultCount: 0 })).toBe("4 ahead");
});
