import { issueProjects, projectKey } from "@t3tools/client-runtime/issue-projects";
import type {
  EnvironmentId,
  IssueListSort,
  IssueListState,
  IssueSummary,
  ProjectId,
} from "@t3tools/contracts";
import { useRef, useState } from "react";
import { Linking, Pressable, ScrollView as RowScrollView, View } from "react-native";

import { AppText as Text } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { AppActivityIndicator } from "../../components/ui/AppActivityIndicator";
import { ScreenScrollView as ScrollView } from "../../components/ui/ScreenScrollView";
import { SearchField } from "../../components/ui/SearchField";
import { SplitPage } from "../../components/ui/SplitPage";
import { relativeTime } from "../../lib/time";
import { useProjects } from "../../state/entities";
import { usePageProject } from "../../state/page-project";
import { issueEnvironment } from "../../state/issues";
import { useEnvironmentQuery } from "../../state/query";
import { useSourceControlSignIn } from "../../state/sourceControl";
import { ChoiceChip } from "../layout/workspace/ChoiceChip";
import { ProjectChoiceChip } from "../layout/workspace/ProjectChoiceChip";
import { SettingsScreen } from "../settings/components/SettingsScreen";
import { PullRequestMarkdown } from "../pull-requests/PullRequestMarkdown";
import { issueStateLabel } from "./issueStateLabel";
import { useStartIssueThread } from "./useStartIssueThread";

const STATE_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
] as const satisfies readonly { value: IssueListState; label: string }[];

const SORT_OPTIONS = [
  { value: "updated", label: "Recently updated" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "comments", label: "Most commented" },
] as const satisfies readonly { value: IssueListSort; label: string }[];

const INVOLVEMENT_OPTIONS = [
  { value: "all", label: "Everyone" },
  { value: "author", label: "Created by me" },
  { value: "assignee", label: "Assigned to me" },
] as const;

/** GitHub's own search syntax: `@me` is the signed-in user. */
const INVOLVEMENT_QUALIFIER = { author: "author:@me", assignee: "assignee:@me" } as const;

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
  readonly sort: IssueListSort;
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
        ...(props.sort === "updated" ? {} : { sort: props.sort }),
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
  const thread = useStartIssueThread(props.target);
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
      {thread.canStart ? (
        <Button
          label="Work on this"
          disabled={thread.busy}
          onPress={() => void thread.start(issue)}
        />
      ) : null}
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

/** The Issues tab: the list, with the open issue beside it where the page is wide. */
export function IssuesScreen() {
  const projects = issueProjects(useProjects(), useSourceControlSignIn().githubSignedOut);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const project = usePageProject(projects, selectedKey);
  const [state, setState] = useState<IssueListState>("open");
  const [sort, setSort] = useState<IssueListSort>("updated");
  const [involves, setInvolves] = useState<"all" | "author" | "assignee">("all");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);
  const searchRef = useRef(null);
  const closeDetail = () => setOpen(null);

  const target: Target | null = project
    ? { environmentId: project.environmentId, projectId: project.id }
    : null;
  const searchText = [involves === "all" ? "" : INVOLVEMENT_QUALIFIER[involves], query]
    .filter(Boolean)
    .join(" ");
  const restart = () => {
    setPages(1);
    setOpen(null);
  };

  const list = (
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
      ) : (
        <View className="gap-3">
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
                  restart();
                }
              }}
              onSubmitEditing={() => {
                setQuery(draft.trim());
                restart();
              }}
            />
          </View>
          <RowScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {projects.length > 1 ? (
              <ProjectChoiceChip
                projects={projects}
                project={project}
                onSelect={(key) => {
                  setSelectedKey(key);
                  restart();
                }}
              />
            ) : null}
            <ChoiceChip
              label={SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Sort"}
              accessibilityLabel="Sort issues"
              options={SORT_OPTIONS}
              selected={sort}
              active={sort !== "updated"}
              onSelect={(value) => {
                setSort(value);
                restart();
              }}
            />
            <ChoiceChip
              label={STATE_OPTIONS.find((option) => option.value === state)?.label ?? "State"}
              accessibilityLabel="Filter by state"
              options={STATE_OPTIONS}
              selected={state}
              active={state !== "open"}
              onSelect={(value) => {
                setState(value);
                restart();
              }}
            />
            <ChoiceChip
              label={INVOLVEMENT_OPTIONS.find((option) => option.value === involves)?.label ?? ""}
              accessibilityLabel="Filter by involvement"
              options={INVOLVEMENT_OPTIONS}
              selected={involves}
              active={involves !== "all"}
              onSelect={(value) => {
                setInvolves(value);
                restart();
              }}
            />
          </RowScrollView>
          <View>
            {Array.from({ length: pages }, (_, index) => (
              <IssuePage
                key={`${projectKey(project)}:${state}:${sort}:${searchText}:${refresh}:${index + 1}`}
                target={target}
                state={state}
                sort={sort}
                query={searchText}
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
  );

  return (
    <SettingsScreen
      title={project?.title ?? "Issues"}
      workspaceRoot
      refresh={{
        accessibilityLabel: "Refresh issues",
        onPress: () => {
          setPages(1);
          setRefresh((value) => value + 1);
        },
      }}
    >
      <SplitPage
        list={list}
        open={open !== null && target !== null && project !== null}
        onCloseDetail={closeDetail}
        emptyDetail={
          <EmptyState variant="plain" title="Select an issue" detail="Its discussion shows here." />
        }
        renderDetail={(compact) =>
          target !== null && project !== null && open !== null ? (
            <ScrollView
              contentInsetAdjustmentBehavior="automatic"
              showsVerticalScrollIndicator={false}
              className="flex-1"
              contentContainerClassName="px-5 pt-4 pb-6"
            >
              <View className="gap-3">
                {compact ? <Button label="Back to issues" onPress={closeDetail} /> : null}
                <IssueDetail
                  key={`${projectKey(project)}:${open}:${refresh}`}
                  target={target}
                  number={open}
                />
              </View>
            </ScrollView>
          ) : null
        }
      />
    </SettingsScreen>
  );
}
