import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_HIDDEN_NAVIGATION_TABS,
  NAVIGATION_TAB_ORDER,
  navigationCustomizationAvailable,
  moveNavigationTab,
  overflowNavigationTabs,
  enabledNavigationTabs,
  toggleNavigationTabVisibility,
  resolveHiddenNavigationTabs,
  resolveSelectedNavigationTab,
  resolveNavigationTabOrder,
  selectedNavigationTab,
  visibleNavigationTabs,
} from "./navigation-tab-order";

describe("navigation tab order", () => {
  it("enables customization once there is more than one section to choose from", () => {
    expect(navigationCustomizationAvailable()).toBe(true);
    expect(navigationCustomizationAvailable(1)).toBe(false);
    expect(navigationCustomizationAvailable(2)).toBe(true);
  });

  it("fills missing sections and drops removed placeholders, duplicates, and Settings", () => {
    expect(
      resolveNavigationTabOrder(["usage", "home", "issues", "settings", "usage", null]),
    ).toEqual(["usage", "issues", "threads", "branches", "releases", "pullRequests"]);
    expect(resolveNavigationTabOrder()).toEqual(NAVIGATION_TAB_ORDER);
  });

  it("moves a section without changing the relative order of the others", () => {
    for (const tab of NAVIGATION_TAB_ORDER) {
      for (let position = 0; position < NAVIGATION_TAB_ORDER.length; position++) {
        const order = moveNavigationTab(NAVIGATION_TAB_ORDER, tab, position);
        expect(order[position]).toBe(tab);
        expect(order.filter((other) => other !== tab)).toEqual(
          NAVIGATION_TAB_ORDER.filter((other) => other !== tab),
        );
      }
    }
  });

  it("shows four sections, overflows the rest and keeps Settings selected during editing", () => {
    expect(visibleNavigationTabs()).toEqual(["threads", "branches", "issues", "releases"]);
    expect(overflowNavigationTabs()).toEqual(["usage"]);
    expect(overflowNavigationTabs(undefined, [])).toEqual(["pullRequests", "usage"]);
    expect(selectedNavigationTab(undefined, "threads", true)).toBe("settings");
    expect(selectedNavigationTab(undefined, "usage", false)).toBe("settings");
    expect(selectedNavigationTab(undefined, "usage", false, undefined, 5)).toBe("usage");
    expect(selectedNavigationTab(undefined, "usage", false, [], 2)).toBe("settings");
  });

  it("removes hidden sections from navigation and restores their saved positions", () => {
    const order = moveNavigationTab(undefined, "usage", 0);
    const hidden = toggleNavigationTabVisibility([], "usage");
    expect(enabledNavigationTabs(order, hidden)).toEqual([
      "threads",
      "branches",
      "issues",
      "releases",
      "pullRequests",
    ]);
    expect(toggleNavigationTabVisibility(hidden, "usage")).toEqual([]);
    expect(visibleNavigationTabs(order, [], 6)).toEqual(order);
    expect(enabledNavigationTabs(undefined, ["home", "settings"])).toEqual(NAVIGATION_TAB_ORDER);
  });

  it("hides Pulls until the user chooses tabs, then follows the saved choice", () => {
    expect(enabledNavigationTabs()).toEqual(["threads", "branches", "issues", "releases", "usage"]);
    expect(resolveHiddenNavigationTabs()).toEqual(DEFAULT_HIDDEN_NAVIGATION_TABS);
    expect(toggleNavigationTabVisibility(undefined, "pullRequests")).toEqual([]);
    expect(toggleNavigationTabVisibility(undefined, "usage")).toEqual(["pullRequests", "usage"]);
    expect(enabledNavigationTabs(undefined, [])).toEqual(NAVIGATION_TAB_ORDER);
  });

  it("falls back when the selected section is hidden, including when all are hidden", () => {
    expect(resolveSelectedNavigationTab(undefined, ["threads"], "threads")).toBe("branches");
    expect(resolveSelectedNavigationTab(undefined, ["threads"], "usage")).toBe("usage");
    expect(
      resolveSelectedNavigationTab(undefined, NAVIGATION_TAB_ORDER, "threads"),
    ).toBeUndefined();
  });
});
