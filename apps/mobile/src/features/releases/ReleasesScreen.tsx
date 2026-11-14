import { issueProjects, projectKey } from "@t3tools/client-runtime/issue-projects";
import type { EnvironmentId, ProjectId, ReleaseSummary } from "@t3tools/contracts";
import { useState } from "react";
import { Linking, Pressable, View } from "react-native";

import { AppText as Text } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { AppActivityIndicator } from "../../components/ui/AppActivityIndicator";
import { ScreenScrollView as ScrollView } from "../../components/ui/ScreenScrollView";
import { SplitPage } from "../../components/ui/SplitPage";
import { relativeTime } from "../../lib/time";
import { useProjects } from "../../state/entities";
import { usePageProject } from "../../state/page-project";
import { issueEnvironment } from "../../state/issues";
import { useEnvironmentQuery } from "../../state/query";
import { useSourceControlSignIn } from "../../state/sourceControl";
import { ProjectChoiceChip } from "../layout/workspace/ProjectChoiceChip";
import { SettingsScreen } from "../settings/components/SettingsScreen";
import { PullRequestMarkdown } from "../pull-requests/PullRequestMarkdown";

type Target = { readonly environmentId: EnvironmentId; readonly projectId: ProjectId };

function Failure(props: { readonly message: string; readonly onRetry: () => void }) {
  return (
    <View className="items-start gap-2 py-4">
      <Text className="text-destructive">{props.message}</Text>
      <Button label="Try again" onPress={props.onRetry} />
    </View>
  );
}

function kindOf(release: Pick<ReleaseSummary, "draft" | "prerelease">): string | undefined {
  return release.draft ? "Draft" : release.prerelease ? "Pre-release" : undefined;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function ReleaseRow(props: {
  readonly release: ReleaseSummary;
  readonly latest: boolean;
  readonly onPress: () => void;
}) {
  const { release } = props;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      className="gap-1 border-b border-border py-3 active:opacity-70"
    >
      <Text textRole="body" className="font-t3-bold" numberOfLines={2}>
        {release.name || release.tagName}
      </Text>
      <Text textRole="footnote" className="text-foreground-muted">
        {[
          release.tagName,
          props.latest ? "Latest" : kindOf(release),
          release.author?.login,
          relativeTime(release.publishedAt ?? release.createdAt),
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>
    </Pressable>
  );
}

function ReleasePage(props: {
  readonly target: Target;
  readonly page: number;
  readonly isLast: boolean;
  readonly onOpen: (id: number) => void;
  readonly onMore: () => void;
}) {
  const result = useEnvironmentQuery(
    issueEnvironment.releaseList({
      environmentId: props.target.environmentId,
      input: { projectId: props.target.projectId, page: props.page },
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
  // GitHub marks "Latest" on the newest release that is neither a draft nor a pre-release.
  const latestId =
    props.page === 1
      ? result.data.releases.find((release) => !release.draft && !release.prerelease)?.id
      : undefined;
  return (
    <>
      {props.page === 1 && result.data.releases.length === 0 ? (
        <EmptyState
          variant="plain"
          title="No releases"
          detail={`${result.data.repository} has none yet.`}
        />
      ) : null}
      {result.data.releases.map((release) => (
        <ReleaseRow
          key={release.id}
          release={release}
          latest={release.id === latestId}
          onPress={() => props.onOpen(release.id)}
        />
      ))}
      {props.isLast && result.data.hasMore ? (
        <View className="py-3">
          <Button label="Load more" onPress={props.onMore} />
        </View>
      ) : null}
    </>
  );
}

function ReleaseDetail(props: { readonly target: Target; readonly id: number }) {
  const result = useEnvironmentQuery(
    issueEnvironment.releaseDetail({
      environmentId: props.target.environmentId,
      input: { projectId: props.target.projectId, id: props.id },
    }),
  );
  const release = result.data;
  if (release === null) {
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
        <Text textRole="headline" className="font-t3-bold">
          {release.name || release.tagName}
        </Text>
        <Text textRole="footnote" className="text-foreground-muted">
          {[
            release.tagName,
            kindOf(release),
            release.author?.login,
            relativeTime(release.publishedAt ?? release.createdAt),
            release.targetCommitish || undefined,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      {release.body.trim() ? (
        <PullRequestMarkdown markdown={release.body} />
      ) : (
        <Text className="italic text-foreground-muted">No release notes.</Text>
      )}
      {release.assets.length > 0 ? (
        <View className="rounded-2xl border border-border">
          {release.assets.map((asset) => (
            <Pressable
              key={asset.name}
              accessibilityRole="link"
              onPress={() => void Linking.openURL(asset.url)}
              className="gap-0.5 border-b border-border p-3 active:opacity-70"
            >
              <Text numberOfLines={1}>{asset.name}</Text>
              <Text textRole="caption" className="text-foreground-muted">
                {formatSize(asset.size)} · {asset.downloadCount} downloads
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Button label="Open on GitHub" onPress={() => void Linking.openURL(release.url)} />
    </View>
  );
}

/** The Releases tab: the list, with the open release beside it where the page is wide. */
export function ReleasesScreen() {
  const projects = issueProjects(useProjects(), useSourceControlSignIn().githubSignedOut);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const project = usePageProject(projects, selectedKey);
  const [pages, setPages] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);
  const closeDetail = () => setOpen(null);

  const target: Target | null = project
    ? { environmentId: project.environmentId, projectId: project.id }
    : null;

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
          detail="Releases are listed for projects whose repository is on GitHub."
        />
      ) : (
        <View className="gap-3">
          {projects.length > 1 ? (
            <View className="flex-row">
              <ProjectChoiceChip
                projects={projects}
                project={project}
                onSelect={(key) => {
                  setSelectedKey(key);
                  setPages(1);
                  setOpen(null);
                }}
              />
            </View>
          ) : null}
          <View>
            {Array.from({ length: pages }, (_, index) => (
              <ReleasePage
                key={`${projectKey(project)}:${refresh}:${index + 1}`}
                target={target}
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
      title={project?.title ?? "Releases"}
      workspaceRoot
      refresh={{
        accessibilityLabel: "Refresh releases",
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
          <EmptyState variant="plain" title="Select a release" detail="Its notes show here." />
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
                {compact ? <Button label="Back to releases" onPress={closeDetail} /> : null}
                <ReleaseDetail
                  key={`${projectKey(project)}:${open}:${refresh}`}
                  target={target}
                  id={open}
                />
              </View>
            </ScrollView>
          ) : null
        }
      />
    </SettingsScreen>
  );
}
