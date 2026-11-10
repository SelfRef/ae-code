import {
  issueProjects,
  projectKey,
  selectIssueProject,
} from "@t3tools/client-runtime/issue-projects";
import type { EnvironmentId, IssueListState, IssueSummary, ProjectId } from "@t3tools/contracts";
import { useEffect, useRef, useState } from "react";
import { BackHandler, Linking, Pressable, View } from "react-native";

import { AppText as Text } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { AppActivityIndicator } from "../../components/ui/AppActivityIndicator";
import { ScreenScrollView as ScrollView } from "../../components/ui/ScreenScrollView";
import { SearchField } from "../../components/ui/SearchField";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { cn } from "../../lib/cn";
import { relativeTime } from "../../lib/time";
import { useProjects } from "../../state/entities";
import { issueEnvironment } from "../../state/issues";
import { useEnvironmentQuery } from "../../state/query";
import { SettingsScreen } from "../settings/components/SettingsScreen";
import { PullRequestMarkdown } from "../pull-requests/PullRequestMarkdown";
import { issueStateLabel } from "./issueStateLabel";

const STATE_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
] as const satisfies readonly { value: IssueListState; label: string }[];

function useHardwareBack(active: boolean, onBack: () => void) {
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- subscribes to the platform's back button while an issue is open
  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [active, onBack]);
}

type Target = { readonly environmentId: EnvironmentId; readonly projectId: ProjectId };

function Failure(props: { readonly message: string; readonly onRetry: () => void }) {
  return (
    <View className="items-start gap-2 py-4">
      <Text className="text-destructive">{props.message}</Text>
      <Button label="Try again" onPress={props.onRetry} />
    </View>
  );
}

function IssueRow(props: { readonly issue: IssueSummary; readonly onPress: () => void }) {
  const { issue } = props;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      className="gap-1 border-b border-border py-3 active:opacity-70"
    >
      <Text textRole="body" className="font-t3-bold" numberOfLines={2}>
        {issue.title}
      </Text>
      <Text textRole="footnote" className="text-foreground-muted">
        {[
          `#${issue.number}`,
          issueStateLabel(issue),
          issue.author?.login,
          relativeTime(issue.updatedAt),
          issue.commentCount > 0 ? `${issue.commentCount} comments` : undefined,
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>
      {issue.labels.length > 0 ? (
        <Text textRole="caption" className="text-foreground-muted" numberOfLines={1}>
          {issue.labels.map((label) => label.name).join(", ")}
        </Text>
      ) : null}
    </Pressable>
  );
}

function IssuePage(props: {
  readonly target: Target;
  readonly state: IssueListState;
  readonly query: string;
  readonly page: number;
  readonly isLast: boolean;
  readonly onOpen: (number: number) => void;
  readonly onMore: () => void;
}) {
  const result = useEnvironmentQuery(
    issueEnvironment.list({
      environmentId: props.target.environmentId,
      input: {
        projectId: props.target.projectId,
        state: props.state,
        ...(props.query ? { query: props.query } : {}),
        page: props.page,
      },
    }),
  );
  if (result.data === null) {
    return result.error !== null ? (
      <Failure message={result.error} onRetry={result.refresh} />
    ) : (
      <View className="items-center py-6">
        <AppActivityIndicator size="small" />
      </View>
    );
  }
  return (
    <>
      {props.page === 1 && result.data.issues.length === 0 ? (
        <EmptyState
          variant="plain"
          title="No issues"
          detail={
            props.query
              ? "Nothing matches this search."
              : `${result.data.repository} has none here.`
          }
        />
      ) : null}
      {result.data.issues.map((issue) => (
        <IssueRow key={issue.number} issue={issue} onPress={() => props.onOpen(issue.number)} />
      ))}
      {props.isLast && result.data.hasMore ? (
        <View className="py-3">
          <Button label="Load more" onPress={props.onMore} />
        </View>
      ) : null}
    </>
  );
}

function IssueDetail(props: { readonly target: Target; readonly number: number }) {
  const result = useEnvironmentQuery(
    issueEnvironment.detail({
      environmentId: props.target.environmentId,
      input: { projectId: props.target.projectId, number: props.number },
    }),
  );
  const issue = result.data;
  if (issue === null) {
    return result.error !== null ? (
      <Failure message={result.error} onRetry={result.refresh} />
    ) : (
      <View className="items-center py-6">
        <AppActivityIndicator size="small" />
      </View>
    );
  }
  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text textRole="title" className="font-t3-bold">
          {issue.title}
        </Text>
        <Text textRole="footnote" className="text-foreground-muted">
          {[
            `#${issue.number}`,
            issueStateLabel(issue),
            issue.author?.login,
            relativeTime(issue.createdAt),
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        {issue.labels.length > 0 ? (
          <Text textRole="caption" className="text-foreground-muted">
            {issue.labels.map((label) => label.name).join(", ")}
          </Text>
        ) : null}
        {issue.assignees.length > 0 ? (
          <Text textRole="caption" className="text-foreground-muted">
            Assigned to {issue.assignees.map((assignee) => assignee.login).join(", ")}
          </Text>
        ) : null}
      </View>
      {issue.body.trim() ? (
        <PullRequestMarkdown markdown={issue.body} />
      ) : (
        <Text className="italic text-foreground-muted">No description provided.</Text>
      )}
      {issue.comments.map((comment) => (
        <View key={comment.id} className="gap-2 rounded-2xl border border-border p-3">
          <Text textRole="footnote" className="text-foreground-muted">
            {[comment.author?.login, relativeTime(comment.createdAt)].filter(Boolean).join(" · ")}
          </Text>
          <PullRequestMarkdown markdown={comment.body} />
        </View>
      ))}
      {issue.commentsTruncated ? (
        <Button label="More comments on GitHub" onPress={() => void Linking.openURL(issue.url)} />
      ) : null}
      <Button label="Open on GitHub" onPress={() => void Linking.openURL(issue.url)} />
    </View>
  );
}

/** The Issues tab: one page that swaps between the list and an open issue. */
export function IssuesScreen() {
  const projects = issueProjects(useProjects());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const project =
    projects.find((candidate) => projectKey(candidate) === selectedKey) ??
    selectIssueProject(projects, {});
  const [state, setState] = useState<IssueListState>("open");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);
  const searchRef = useRef(null);

  const detail = open !== null;
  // The page is the whole tab, so the hardware back button has to close the issue itself.
  const closeDetail = () => setOpen(null);
  useHardwareBack(detail, closeDetail);

  const target: Target | null = project
    ? { environmentId: project.environmentId, projectId: project.id }
    : null;
  const nextProject = () => {
    if (projects.length < 2 || project === null) return;
    const index = projects.findIndex((candidate) => projectKey(candidate) === projectKey(project));
    const next = projects[(index + 1) % projects.length];
    if (next) {
      setSelectedKey(projectKey(next));
      setPages(1);
      setOpen(null);
    }
  };

  return (
    <SettingsScreen
      title={detail ? "Issue" : (project?.title ?? "Issues")}
      workspaceRoot
      refresh={{
        accessibilityLabel: "Refresh issues",
        onPress: () => {
          setPages(1);
          setRefresh((value) => value + 1);
        },
      }}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-6"
      >
        {target === null || project === null ? (
          <EmptyState
            variant="plain"
            title="No GitHub project"
            detail="Issues are listed for projects whose repository is on GitHub."
          />
        ) : detail ? (
          <View className="gap-3">
            <Button label="Back to issues" onPress={closeDetail} />
            <IssueDetail
              key={`${projectKey(project)}:${open}:${refresh}`}
              target={target}
              number={open}
            />
          </View>
        ) : (
          <View className="gap-3">
            {projects.length > 1 ? (
              <Button label={`Project: ${project.title} (change)`} onPress={nextProject} />
            ) : null}
            <View className="flex-row">
              <SearchField
                inputRef={searchRef}
                autoFocus={false}
                accessibilityLabel="Search issues"
                clearAccessibilityLabel="Clear search"
                placeholder="Search issues"
                value={draft}
                onChangeText={(value) => {
                  setDraft(value);
                  if (value === "" && query !== "") {
                    setQuery("");
                    setPages(1);
                  }
                }}
                onSubmitEditing={() => {
                  setQuery(draft.trim());
                  setPages(1);
                }}
              />
            </View>
            <SegmentedControl
              options={STATE_OPTIONS}
              selected={state}
              onSelect={(value) => {
                setState(value);
                setPages(1);
              }}
              size="compact"
              role="tab"
              className={cn("w-full")}
            />
            <View>
              {Array.from({ length: pages }, (_, index) => (
                <IssuePage
                  key={`${projectKey(project)}:${state}:${query}:${refresh}:${index + 1}`}
                  target={target}
                  state={state}
                  query={query}
                  page={index + 1}
                  isLast={index + 1 === pages}
                  onOpen={setOpen}
                  onMore={() => setPages((value) => value + 1)}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SettingsScreen>
  );
}
