import type { MenuAction } from "@react-native-menu/menu";
import { pickableProjectGroups } from "@t3tools/client-runtime/state/project-grouping";

import type { HomeProjectScope } from "./homeThreadList";

const PROJECT_LIMIT = 8;
const PROJECT_PREFIX = "project:";
export const CHOOSE_PROJECT_ACTION = "choose";

export function newThreadMenuScopes(
  scopes: ReadonlyArray<HomeProjectScope>,
  isScratch: (scope: HomeProjectScope) => boolean,
) {
  return pickableProjectGroups(scopes).filter((scope) => !isScratch(scope));
}

/** The most recently active projects, then the full picker for the rest. */
export function newThreadMenuActions(scopes: ReadonlyArray<HomeProjectScope>): MenuAction[] {
  return [
    ...scopes.slice(0, PROJECT_LIMIT).map((scope) => ({
      id: PROJECT_PREFIX + scope.key,
      title: scope.title,
      image: "folder",
    })),
    { id: CHOOSE_PROJECT_ACTION, title: "Choose project…", image: "magnifyingglass" },
  ];
}

export function newThreadMenuScope(scopes: ReadonlyArray<HomeProjectScope>, actionId: string) {
  return actionId.startsWith(PROJECT_PREFIX)
    ? scopes.find((scope) => scope.key === actionId.slice(PROJECT_PREFIX.length))
    : undefined;
}
