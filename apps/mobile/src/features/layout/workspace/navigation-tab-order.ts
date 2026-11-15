export const NAVIGATION_TAB_ORDER = [
  "threads",
  "branches",
  "issues",
  "releases",
  "pullRequests",
  "board",
  "usage",
] as const;
export type NavigationTab = (typeof NAVIGATION_TAB_ORDER)[number];

/** Rail rows are 48dp plus a 4dp gap; the header, Settings and the compose slot (60dp) take the rest. */
export function railNavigationTabCapacity(height: number) {
  // Never below the five a short rail used to hold; the rest open from Settings.
  return Math.max(5, Math.floor((height - 12 - 60) / 52) - 1);
}

/** Shown until the user picks tabs in Settings: this fork's work is tracked in issues, not pulls. */
export const DEFAULT_HIDDEN_NAVIGATION_TABS: readonly NavigationTab[] = ["pullRequests"];

/** Tabs that are one page rather than a list beside a detail column. */
export function isPageNavigationTab(
  tab: unknown,
): tab is "board" | "branches" | "issues" | "releases" | "usage" {
  return (
    tab === "board" ||
    tab === "branches" ||
    tab === "issues" ||
    tab === "releases" ||
    tab === "usage"
  );
}

/** Tabs whose provider isn't signed in on any connected environment; they show nowhere. */
export function unavailableNavigationTabs(signIn: {
  readonly issuesHidden: boolean;
  readonly pullRequestsHidden: boolean;
}): readonly NavigationTab[] {
  return [
    ...(signIn.issuesHidden ? (["issues", "releases"] as const) : []),
    ...(signIn.pullRequestsHidden ? (["pullRequests"] as const) : []),
  ];
}

export function navigationCustomizationAvailable(
  registeredSections: number = NAVIGATION_TAB_ORDER.length,
) {
  return registeredSections > 1;
}

export const NAVIGATION_TAB_LABELS: Readonly<Record<NavigationTab, string>> = {
  threads: "Threads",
  board: "Board",
  branches: "Branches",
  issues: "Issues",
  releases: "Releases",
  pullRequests: "Pulls",
  usage: "Usage",
};

function isNavigationTab(value: unknown): value is NavigationTab {
  return NAVIGATION_TAB_ORDER.some((tab) => tab === value);
}

/** Complete older preferences without losing their order or retaining removed sections. */
export function resolveNavigationTabOrder(saved?: readonly unknown[]): readonly NavigationTab[] {
  if (!saved?.length) return NAVIGATION_TAB_ORDER;
  return [...new Set([...saved.filter(isNavigationTab), ...NAVIGATION_TAB_ORDER])];
}

export function moveNavigationTab(
  saved: readonly unknown[] | undefined,
  tab: NavigationTab,
  position: number,
): readonly NavigationTab[] {
  const order = [...resolveNavigationTabOrder(saved)];
  const from = order.indexOf(tab);
  const to = Math.max(0, Math.min(order.length - 1, position));
  order.splice(from, 1);
  order.splice(to, 0, tab);
  return order;
}

export function resolveHiddenNavigationTabs(saved?: readonly unknown[]): readonly NavigationTab[] {
  if (saved === undefined) return DEFAULT_HIDDEN_NAVIGATION_TABS;
  return [...new Set(saved.filter(isNavigationTab))];
}

export function toggleNavigationTabVisibility(
  saved: readonly unknown[] | undefined,
  tab: NavigationTab,
) {
  const hidden = resolveHiddenNavigationTabs(saved);
  return hidden.includes(tab) ? hidden.filter((candidate) => candidate !== tab) : [...hidden, tab];
}

export function enabledNavigationTabs(saved?: readonly unknown[], hidden?: readonly unknown[]) {
  const excluded = resolveHiddenNavigationTabs(hidden);
  return resolveNavigationTabOrder(saved).filter((tab) => !excluded.includes(tab));
}

export function visibleNavigationTabs(
  saved?: readonly unknown[],
  hidden?: readonly unknown[],
  capacity = 4,
) {
  return enabledNavigationTabs(saved, hidden).slice(0, capacity);
}

export function overflowNavigationTabs(
  saved?: readonly unknown[],
  hidden?: readonly unknown[],
  capacity = 4,
) {
  return enabledNavigationTabs(saved, hidden).slice(capacity);
}

export function selectedNavigationTab(
  saved: readonly unknown[] | undefined,
  selected: NavigationTab,
  settingsOpen: boolean,
  hidden?: readonly unknown[],
  capacity = 4,
): NavigationTab | "settings" {
  return settingsOpen || !visibleNavigationTabs(saved, hidden, capacity).includes(selected)
    ? "settings"
    : selected;
}

export function resolveSelectedNavigationTab(
  saved: readonly unknown[] | undefined,
  hidden: readonly unknown[] | undefined,
  selected: NavigationTab,
) {
  const enabled = enabledNavigationTabs(saved, hidden);
  return enabled.includes(selected) ? selected : enabled[0];
}
