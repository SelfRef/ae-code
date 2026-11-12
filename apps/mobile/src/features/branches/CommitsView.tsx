import {
  commitRefLabel,
  layoutCommitGraph,
  nextCommitLogLimit,
} from "@t3tools/client-runtime/commit-graph";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import {
  ALL_VCS_REFS,
  VCS_COMMIT_LOG_MAX_LIMIT,
  VCS_COMMIT_LOG_PAGE_SIZE,
  type VcsCommitLogEntry,
  type VcsCommitLogResult,
} from "@t3tools/contracts";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Pressable, ScrollView as RowScrollView, View } from "react-native";

import { AppActivityIndicator } from "../../components/ui/AppActivityIndicator";
import { AppText as Text } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ScreenScrollView as ScrollView } from "../../components/ui/ScreenScrollView";
import { cn } from "../../lib/cn";
import { useHardwareBack } from "../../lib/backHandler";
import { relativeTime } from "../../lib/time";
import { useEnvironmentQuery } from "../../state/query";
import { vcsEnvironment } from "../../state/vcs";
import { ChoiceChip } from "../layout/workspace/ChoiceChip";
import { SettingsScreen } from "../settings/components/SettingsScreen";
import { COMMIT_ROW_HEIGHT, CommitGraphGutter } from "./CommitGraphGutter";

type View_ = "list" | "graph";
const VIEW_OPTIONS = [
  { value: "list", label: "List" },
  { value: "graph", label: "Graph" },
] as const satisfies readonly { value: View_; label: string }[];

function CommitDetail(props: {
  readonly project: Pick<EnvironmentProject, "environmentId" | "workspaceRoot">;
  readonly sha: string;
}) {
  const detail = useEnvironmentQuery(
    vcsEnvironment.commitDetail({
      environmentId: props.project.environmentId,
      input: { cwd: props.project.workspaceRoot, sha: props.sha },
    }),
  );
  const data = detail.data;
  return (
    <View className="gap-2 border-t border-border bg-secondary px-3 py-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Copy commit hash"
        onPress={() => void Clipboard.setStringAsync(props.sha).catch(() => undefined)}
      >
        <Text textRole="footnote" className="font-mono text-foreground-muted">
          {props.sha}
        </Text>
      </Pressable>
      {data === null ? (
        detail.error !== null ? (
          <Text textRole="footnote" className="text-destructive">
            {detail.error}
          </Text>
        ) : (
          <AppActivityIndicator size="small" />
        )
      ) : (
        <>
          {data.body !== "" ? <Text textRole="footnote">{data.body}</Text> : null}
          {data.files.length === 0 ? (
            <Text textRole="footnote" className="text-foreground-muted">
              No file changes.
            </Text>
          ) : (
            data.files.map((file) => (
              <View
                key={`${file.previousPath ?? ""}>${file.path}`}
                className="flex-row items-start justify-between gap-2"
              >
                <Text textRole="footnote" className="min-w-0 flex-1 font-mono">
                  {file.previousPath === null ? file.path : `${file.previousPath} → ${file.path}`}
                </Text>
                <Text textRole="footnote" className="font-mono text-foreground-muted">
                  {file.additions === null ? "binary" : `+${file.additions} −${file.deletions}`}
                </Text>
              </View>
            ))
          )}
          {data.truncated ? (
            <Text textRole="footnote" className="text-foreground-muted">
              Only the first {data.files.length} files are listed.
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

function CommitRow(props: {
  readonly project: Pick<EnvironmentProject, "environmentId" | "workspaceRoot">;
  readonly commit: VcsCommitLogEntry;
  readonly graph: ReturnType<typeof layoutCommitGraph> | null;
  readonly index: number;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}) {
  const { commit, graph } = props;
  const graphRow = graph?.rows[props.index] ?? null;
  const refs = commit.refs.map((ref) => commitRefLabel(ref).name);
  return (
    <View className={cn("flex-row", graphRow === null && "border-b border-border")}>
      {graph !== null && graphRow !== null ? (
        <CommitGraphGutter row={graphRow} laneCount={graph.laneCount} />
      ) : null}
      <View className="min-w-0 flex-1">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: props.expanded }}
          onPress={props.onToggle}
          style={graphRow === null ? undefined : { height: COMMIT_ROW_HEIGHT }}
          className={cn("justify-center gap-0.5 pr-1", graphRow === null ? "py-3 pl-3" : "pl-1")}
        >
          <Text
            textRole="body"
            className={graphRow === null ? "font-t3-bold" : undefined}
            numberOfLines={graphRow === null ? 2 : 1}
          >
            {commit.subject || "(no message)"}
          </Text>
          <Text textRole="footnote" className="text-foreground-muted" numberOfLines={1}>
            {[
              commit.sha.slice(0, 7),
              graphRow === null ? commit.authorName : null,
              commit.authoredAt ? relativeTime(commit.authoredAt) : null,
              ...refs,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </Pressable>
        {props.expanded ? <CommitDetail project={props.project} sha={commit.sha} /> : null}
      </View>
    </View>
  );
}

/** The commits of one branch, as a list or a graph, in place of the Branches list until Back. */
export function CommitsView(props: {
  readonly project: Pick<EnvironmentProject, "environmentId" | "workspaceRoot" | "title">;
  /** Branch names as the Branches list shows them. */
  readonly branches: ReadonlyArray<string>;
  readonly initialRef: string;
  readonly onBack: () => void;
}) {
  const [ref, setRef] = useState(props.initialRef);
  const [view, setView] = useState<View_>("list");
  const [limit, setLimit] = useState(VCS_COMMIT_LOG_PAGE_SIZE);
  const [openSha, setOpenSha] = useState<string | null>(null);
  useHardwareBack(true, () => {
    props.onBack();
    return true;
  });
  const log = useEnvironmentQuery(
    vcsEnvironment.commitLog({
      environmentId: props.project.environmentId,
      input: { cwd: props.project.workspaceRoot, ref, limit },
    }),
  );
  // Asking for more commits is a new request: keep the loaded ones on screen until it answers.
  const [shown, setShown] = useState<VcsCommitLogResult | null>(null);
  if (log.data !== null && log.data !== shown) setShown(log.data);
  const data = log.data ?? shown;
  const graph = view === "graph" && data !== null ? layoutCommitGraph(data.commits) : null;
  const refOptions = [
    { value: ALL_VCS_REFS, label: "All branches" },
    ...props.branches.map((name) => ({ value: name, label: name })),
  ];
  const changeRef = (next: string) => {
    setRef(next);
    setLimit(VCS_COMMIT_LOG_PAGE_SIZE);
    setOpenSha(null);
  };

  return (
    <SettingsScreen
      title="Commits"
      workspaceRoot
      refresh={{ accessibilityLabel: "Refresh commits", onPress: log.refresh }}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-6"
      >
        <View className="gap-3">
          <View className="flex-row">
            <Button
              label="Branches"
              icon="chevron.left"
              tone="text"
              size="compact"
              onPress={props.onBack}
            />
          </View>
          <RowScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            <ChoiceChip
              label={ref === ALL_VCS_REFS ? "All branches" : ref}
              accessibilityLabel="Choose branch"
              options={refOptions}
              selected={ref}
              onSelect={changeRef}
            />
            <ChoiceChip
              label={VIEW_OPTIONS.find((option) => option.value === view)?.label ?? ""}
              accessibilityLabel="Choose list or graph"
              options={VIEW_OPTIONS}
              selected={view}
              onSelect={setView}
            />
          </RowScrollView>
          {data === null ? (
            log.error !== null ? (
              <View className="items-start gap-2 py-4">
                <Text className="text-destructive">{log.error}</Text>
                <Button label="Try again" onPress={log.refresh} />
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
              detail={`${props.project.title} has no commits to list.`}
            />
          ) : data.commits.length === 0 ? (
            <EmptyState
              variant="plain"
              title="No commits"
              detail="This branch has no commits yet."
            />
          ) : (
            <View>
              {data.commits.map((commit, index) => (
                <CommitRow
                  key={commit.sha}
                  project={props.project}
                  commit={commit}
                  graph={graph}
                  index={index}
                  expanded={openSha === commit.sha}
                  onToggle={() => setOpenSha(openSha === commit.sha ? null : commit.sha)}
                />
              ))}
              {data.hasMore ? (
                limit < VCS_COMMIT_LOG_MAX_LIMIT ? (
                  <View className="flex-row pt-3">
                    <Button
                      label="Load more"
                      loading={log.isPending}
                      onPress={() => setLimit(nextCommitLogLimit(limit, VCS_COMMIT_LOG_MAX_LIMIT))}
                    />
                  </View>
                ) : (
                  <Text textRole="footnote" className="pt-3 text-foreground-muted">
                    Showing the latest {data.commits.length} commits.
                  </Text>
                )
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </SettingsScreen>
  );
}
