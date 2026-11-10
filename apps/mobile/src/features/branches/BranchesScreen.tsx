import {
  branchMergeState,
  branchProjects,
  threadForBranch,
} from "@t3tools/client-runtime/branch-overview";
import { projectKey, selectIssueProject } from "@t3tools/client-runtime/issue-projects";
import type { VcsBranchOverviewEntry } from "@t3tools/contracts";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { AppText as Text } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { AppActivityIndicator } from "../../components/ui/AppActivityIndicator";
import { ScreenScrollView as ScrollView } from "../../components/ui/ScreenScrollView";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { cn } from "../../lib/cn";
import { relativeTime } from "../../lib/time";
import { useProjects, useThreadShells } from "../../state/entities";
import { useEnvironmentQuery } from "../../state/query";
import { vcsEnvironment } from "../../state/vcs";
import { useOpenWorkspaceDetail } from "../layout/useOpenWorkspaceDetail";
import { SettingsScreen } from "../settings/components/SettingsScreen";

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "unmerged", label: "Not merged" },
] as const;

function BranchRow(props: {
  readonly branch: VcsBranchOverviewEntry;
  readonly defaultRef: string | null;
  readonly threadTitle: string | null;
  readonly onOpenThread: () => void;
}) {
  const { branch } = props;
  const state = branchMergeState(branch);
  const kind = branch.isRemoteOnly ? "Remote only" : branch.worktreePath ? "Worktree" : "Branch";
  const sync = [
    branch.ahead > 0 ? `↑${branch.ahead} to push` : null,
    branch.behind > 0 ? `↓${branch.behind} to pull` : null,
    branch.upstreamGone ? "Upstream deleted" : null,
    !branch.isRemoteOnly && !branch.isDefault && branch.upstream === null ? "Not pushed" : null,
  ].filter(Boolean);
  return (
    <View
      className={cn(
        "gap-1 border-b border-l-2 border-border py-3 pl-3",
        state === "unmerged" ? "border-l-warning-foreground bg-warning" : "border-l-transparent",
      )}
    >
      <Text textRole="body" className="font-t3-bold" numberOfLines={2}>
        {branch.name}
      </Text>
      <Text textRole="footnote" className="text-foreground-muted">
        {[
          branch.isDefault ? "Default" : null,
          kind,
          branch.current ? "Checked out" : null,
          state === "unmerged"
            ? `${branch.aheadOfDefault} ahead of ${props.defaultRef ?? "default"}`
            : state === "merged"
              ? "Merged"
              : null,
          state !== "default" && branch.behindDefault > 0 ? `${branch.behindDefault} behind` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>
      {sync.length > 0 ? (
        <Text textRole="footnote" className="text-foreground-muted">
          {sync.join(" · ")}
        </Text>
      ) : null}
      {branch.lastCommitAt ? (
        <Text textRole="footnote" className="text-foreground-muted" numberOfLines={1}>
          {relativeTime(branch.lastCommitAt)}
          {branch.lastCommitSubject ? ` · ${branch.lastCommitSubject}` : ""}
        </Text>
      ) : null}
      {props.threadTitle !== null ? (
        <Pressable
          accessibilityRole="button"
          onPress={props.onOpenThread}
          className="self-start pt-1 active:opacity-70"
        >
          <Text textRole="footnote" className="font-t3-bold text-primary" numberOfLines={1}>
            Open thread: {props.threadTitle}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The Branches tab: every branch and worktree of a project, with what is not merged highlighted. */
export function BranchesScreen() {
  const projects = branchProjects(useProjects());
  const threads = useThreadShells();
  const openDetail = useOpenWorkspaceDetail();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTER_OPTIONS)[number]["value"]>("all");
  const project =
    projects.find((candidate) => projectKey(candidate) === selectedKey) ??
    selectIssueProject(projects, {});
  const overview = useEnvironmentQuery(
    project === null
      ? null
      : vcsEnvironment.branchOverview({
          environmentId: project.environmentId,
          input: { cwd: project.workspaceRoot, fetch: true },
        }),
  );
  const data = overview.data;
  const unmerged = data?.branches.filter((branch) => branchMergeState(branch) === "unmerged") ?? [];
  const branches = filter === "unmerged" ? unmerged : (data?.branches ?? []);

  const nextProject = () => {
    if (projects.length < 2 || project === null) return;
    const index = projects.findIndex((candidate) => projectKey(candidate) === projectKey(project));
    const next = projects[(index + 1) % projects.length];
    if (next) setSelectedKey(projectKey(next));
  };

  return (
    <SettingsScreen
      title={project?.title ?? "Branches"}
      workspaceRoot
      refresh={{ accessibilityLabel: "Refresh branches", onPress: overview.refresh }}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-6"
      >
        {project === null ? (
          <EmptyState
            variant="plain"
            title="No project"
            detail="Add a project to see its branches."
          />
        ) : (
          <View className="gap-3">
            {projects.length > 1 ? (
              <Button label={`Project: ${project.title} (change)`} onPress={nextProject} />
            ) : null}
            <SegmentedControl
              options={FILTER_OPTIONS}
              selected={filter}
              onSelect={setFilter}
              size="compact"
              role="tab"
              className="w-full"
            />
            {data === null ? (
              overview.error !== null ? (
                <View className="items-start gap-2 py-4">
                  <Text className="text-destructive">{overview.error}</Text>
                  <Button label="Try again" onPress={overview.refresh} />
                </View>
              ) : (
                <View className="items-center py-6">
                  <AppActivityIndicator size="small" />
                </View>
              )
            ) : !data.isRepo ? (
              <EmptyState
                variant="plain"
                title="Not a Git repository"
                detail={`${project.title} has no branches to list.`}
              />
            ) : (
              <View>
                <Text textRole="footnote" className="pb-2 text-foreground-muted">
                  {unmerged.length > 0
                    ? `${unmerged.length} not merged into ${data.defaultRef}`
                    : "All merged"}
                </Text>
                {branches.length === 0 ? (
                  <EmptyState
                    variant="plain"
                    title="Everything is merged"
                    detail={`No branch has commits that ${data.defaultRef} lacks.`}
                  />
                ) : null}
                {branches.map((branch) => {
                  const thread = threadForBranch(threads, project, branch);
                  return (
                    <BranchRow
                      key={`${branch.isRemoteOnly ? "remote" : "local"}:${branch.name}`}
                      branch={branch}
                      defaultRef={data.defaultRef}
                      threadTitle={thread?.title ?? null}
                      onOpenThread={() => {
                        if (thread)
                          openDetail({
                            name: "Thread",
                            params: {
                              environmentId: String(thread.environmentId),
                              threadId: String(thread.id),
                            },
                          });
                      }}
                    />
                  );
                })}
                {data.truncated ? (
                  <Text textRole="footnote" className="pt-3 text-foreground-muted">
                    Showing the {data.branches.length} most recent branches.
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SettingsScreen>
  );
}
