import {
  ChartNoAxesColumnIcon,
  CircleDotIcon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  SettingsIcon,
  SquareKanbanIcon,
  TagIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { branchProjects } from "@t3tools/client-runtime/branch-overview";
import { issueProjects } from "@t3tools/client-runtime/issue-projects";

import { PullRequestGlyph } from "~/components/pullRequest/pullRequestIcons";
import { usePullRequestsSupported } from "../../state/environments";
import { useProjects } from "../../state/entities";
import { useSourceControlSignIn } from "../../state/sourceControl";
import { readPullRequestListPreferences } from "../pullRequest/pullRequestListPreferences";

export interface AppNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  go: () => void;
  isActive: (pathname: string) => boolean;
  /** Rail only: sits under the spacer, after the page links. */
  bottom?: boolean;
}

const startsWithPath = (path: string) => (pathname: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

/** The app's pages, in the order the sidebar footer lists them; the nav rail shares the list. */
export function useAppNavItems(): AppNavItem[] {
  const navigate = useNavigate();
  const signIn = useSourceControlSignIn();
  const pullRequestsSupported = usePullRequestsSupported() && !signIn.pullRequestsHidden;
  const projects = useProjects();
  const branchesSupported = branchProjects(projects).length > 0;
  const issuesSupported = issueProjects(projects, signIn.githubSignedOut).length > 0;

  const items: Array<AppNavItem | false> = [
    {
      id: "settings",
      label: "Settings",
      icon: <SettingsIcon />,
      go: () => void navigate({ to: "/settings" }),
      isActive: startsWithPath("/settings"),
      bottom: true,
    },
    {
      id: "board",
      label: "Board",
      icon: <SquareKanbanIcon />,
      go: () => void navigate({ to: "/board" }),
      isActive: startsWithPath("/board"),
    },
    pullRequestsSupported && {
      id: "pull-requests",
      label: "Pull requests",
      icon: <PullRequestGlyph.pullRequest />,
      go: () => void navigate({ to: "/pull-requests", search: readPullRequestListPreferences() }),
      isActive: startsWithPath("/pull-requests"),
    },
    branchesSupported && {
      id: "branches",
      label: "Branches",
      icon: <GitBranchIcon />,
      go: () => void navigate({ to: "/branches" }),
      isActive: startsWithPath("/branches"),
    },
    branchesSupported && {
      id: "commits",
      label: "Commits",
      icon: <GitCommitHorizontalIcon />,
      go: () => void navigate({ to: "/commits" }),
      isActive: startsWithPath("/commits"),
    },
    issuesSupported && {
      id: "issues",
      label: "Issues",
      icon: <CircleDotIcon />,
      go: () => void navigate({ to: "/issues", search: { state: "open" } }),
      isActive: startsWithPath("/issues"),
    },
    issuesSupported && {
      id: "releases",
      label: "Releases",
      icon: <TagIcon />,
      go: () => void navigate({ to: "/releases" }),
      isActive: startsWithPath("/releases"),
    },
    {
      id: "usage",
      label: "Usage",
      icon: <ChartNoAxesColumnIcon />,
      go: () => void navigate({ to: "/usage" }),
      isActive: startsWithPath("/usage"),
      bottom: true,
    },
  ];
  return items.filter((item) => item !== false);
}
