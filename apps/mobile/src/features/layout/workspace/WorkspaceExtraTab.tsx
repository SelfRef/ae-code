import { type NavigationTab } from "./navigation-tab-order";
import { NativeStackScreenOptions } from "../../../native/StackHeader";
import { BoardScreen } from "../../board/BoardScreen";
import { BranchesScreen } from "../../branches/BranchesScreen";
import { IssuesScreen } from "../../issues/IssuesScreen";
import { ReleasesScreen } from "../../releases/ReleasesScreen";
import { UsageRouteScreen } from "../../usage/UsageRouteScreen";

export function WorkspaceExtraTab(props: {
  tab: Exclude<NavigationTab, "threads" | "pullRequests">;
}) {
  return (
    <>
      <NativeStackScreenOptions options={{ headerSearchBarOptions: undefined }} />
      {props.tab === "board" ? (
        <BoardScreen />
      ) : props.tab === "branches" ? (
        <BranchesScreen />
      ) : props.tab === "issues" ? (
        <IssuesScreen />
      ) : props.tab === "releases" ? (
        <ReleasesScreen />
      ) : (
        <UsageRouteScreen workspace />
      )}
    </>
  );
}
