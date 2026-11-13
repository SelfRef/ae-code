import * as Dialog from "../../components/ui/Dialog";
import { useOpenPullRequest } from "../../native/useOpenPullRequest";
import type { AppBarMenu } from "../../components/ui/AppBar.types";
import {
  AuthSourceControlWriteScope,
  EnvironmentId,
  type GitRunStackedActionResult,
  type ProjectScript,
  ThreadId,
  type VcsStatusResult,
} from "@t3tools/contracts";
import {
  type GitActionRequestInput,
  formatQuickActionLabel,
  confirmedActionIncludesCommit,
  requiresDefaultBranchConfirmation,
  resolveDefaultBranchActionDialogCopy,
  resolveDefaultBranchActions,
  resolveQuickAction,
} from "@t3tools/client-runtime/state/vcs";
import { useNavigation } from "@react-navigation/native";
import { sourceControlClients } from "@t3tools/client-runtime/source-control-clients";

import { useEnvironmentScope } from "../../state/session";
import { aheadLabel } from "./git/aheadLabel";
import { useConfirmPushToDefaultBranch } from "./git/useConfirmPushToDefaultBranch";
import { useCurrentBranchAction, useQuickMergeAction } from "./git/useQuickMergeAction";
import { PullRequestGlyph } from "../pull-requests/pullRequestGlyphs";
import {
  basename,
  getTerminalStatusLabel,
  projectScriptMenuIcon,
  type TerminalMenuSession,
} from "../terminal/terminalMenu";
import { projectScriptMenuLabel } from "@t3tools/shared/projectScripts";

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const headLength = Math.ceil((maxLength - 1) / 2);
  const tailLength = Math.floor((maxLength - 1) / 2);
  return `${value.slice(0, headLength)}…${value.slice(value.length - tailLength)}`;
}

function compactMenuBranchLabel(branch: string): string {
  return truncateMiddle(branch, 24);
}

function compactMenuStatus(gitStatus: VcsStatusResult | null): string {
  if (!gitStatus) {
    return "Checking status";
  }
  if (!gitStatus.isRepo) {
    return "Not a repo";
  }

  const parts: string[] = [];
  const ahead = aheadLabel(gitStatus);
  if (gitStatus.hasWorkingTreeChanges) {
    parts.push(`${gitStatus.workingTree.files.length} changed`);
  } else if (!ahead && gitStatus.behindCount === 0) {
    parts.push("Clean");
  }
  if (ahead) parts.push(ahead);
  if (gitStatus.behindCount > 0) {
    parts.push(`${gitStatus.behindCount} behind`);
  }
  if (gitStatus.pr?.state === "open") {
    const { shortLabel } = sourceControlClients.get(
      gitStatus.sourceControlProvider?.kind,
    ).changeRequest;
    parts.push(`${shortLabel} #${gitStatus.pr.number}`);
  }

  return parts.join(" · ");
}

type QuickActionIcon =
  | typeof PullRequestGlyph.merged
  | "arrow.down.circle"
  | "arrow.up.right.circle"
  | "checkmark.circle"
  | "arrow.up.circle";

export type ThreadGitMenuProps = {
  readonly environmentId: EnvironmentId | string;
  readonly threadId: ThreadId | string;
  readonly currentBranch: string | null;
  readonly hasThread?: boolean;
  readonly isWorktree?: boolean;
  readonly gitStatus: VcsStatusResult | null;
  readonly gitOperationLabel: string | null;
  readonly onOpenFilesInspector?: () => void;
  readonly onOpenGitInspector?: () => void;
  readonly onMergeBack?: () => void;
  readonly onPull: () => Promise<void>;
  readonly onRunAction: (input: GitActionRequestInput) => Promise<GitRunStackedActionResult | null>;
};

export type ThreadGitControlsProps = ThreadGitMenuProps & {
  readonly canOpenTerminal: boolean;
  readonly canOperateTerminal: boolean;
  readonly canOpenFiles: boolean;
  readonly projectScripts: ReadonlyArray<ProjectScript>;
  readonly terminalSessions: ReadonlyArray<TerminalMenuSession>;
  readonly onOpenTerminal: (terminalId?: string | null) => void;
  readonly onOpenNewTerminal: () => void;
  readonly onRunProjectScript: (script: ProjectScript) => Promise<void>;
};

function useThreadGitControlModel(props: ThreadGitMenuProps) {
  const navigation = useNavigation();
  const openPullRequest = useOpenPullRequest();
  const environmentId = props.environmentId;
  const canWriteSourceControl = useEnvironmentScope(
    environmentId ? EnvironmentId.make(String(environmentId)) : null,
    AuthSourceControlWriteScope,
  );
  const threadId = props.threadId;
  const { gitStatus, gitOperationLabel, onPull, onRunAction } = props;

  const currentBranchLabel = gitStatus?.refName ?? props.currentBranch ?? "Detached HEAD";
  const busy = gitOperationLabel !== null;
  const isRepo = gitStatus?.isRepo ?? true;
  const hasPrimaryRemote = gitStatus?.hasPrimaryRemote ?? false;
  const isDefaultRef = gitStatus?.isDefaultRef ?? false;

  const confirmPushToDefaultBranch = useConfirmPushToDefaultBranch();
  const quickMergeAction = useQuickMergeAction();
  const currentBranchAction = useCurrentBranchAction();
  const defaultBranchActions = resolveDefaultBranchActions(
    gitStatus,
    busy,
    hasPrimaryRemote,
    quickMergeAction,
  );
  const defaultBranchPrimary = defaultBranchActions?.primary ?? null;
  const defaultBranchRebase =
    defaultBranchActions?.items.find((item) => item.id === "rebase_default") ?? null;
  const quickAction = (() => {
    if (!isRepo) {
      return {
        label: "Git unavailable",
        disabled: true,
        kind: "show_hint" as const,
        hint: "This workspace is not a git repository.",
      };
    }
    const action = resolveQuickAction(
      gitStatus,
      busy,
      isDefaultRef,
      hasPrimaryRemote,
      currentBranchAction === "pull_request",
    );
    return !canWriteSourceControl && (action.kind === "run_pull" || action.kind === "run_action")
      ? {
          ...action,
          disabled: true,
          hint: "This connection cannot change source control.",
        }
      : action;
  })();

  const quickActionHint = quickAction.disabled
    ? (quickAction.hint ?? "This action is unavailable.")
    : null;

  const quickActionIcon: QuickActionIcon = (() => {
    if (quickAction.kind === "run_pull") return "arrow.down.circle";
    if (quickAction.kind === "open_pr") return "arrow.up.right.circle";
    if (quickAction.kind === "run_action") {
      if (quickAction.action === "commit") return "checkmark.circle";
      if (quickAction.action === "push" || quickAction.action === "commit_push")
        return "arrow.up.circle";
    }
    return "arrow.up.right.circle";
  })();

  const openExistingPr = async () => {
    const { shortLabel, singular } = sourceControlClients.get(
      gitStatus?.sourceControlProvider?.kind,
    ).changeRequest;
    const prUrl = gitStatus?.pr?.state === "open" ? gitStatus.pr.url : null;
    if (!prUrl) {
      Dialog.alert(`No open ${shortLabel}`, `This branch does not have an open ${singular}.`);
      return;
    }
    if (!(await openPullRequest(prUrl))) {
      Dialog.alert(`Unable to open ${shortLabel}`, `The ${singular} could not be opened.`);
    }
  };

  const runActionWithPrompt = async (input: GitActionRequestInput) => {
    if (!canWriteSourceControl) return;
    const confirmableAction =
      input.action === "push" ||
      input.action === "create_pr" ||
      input.action === "commit_push" ||
      input.action === "commit_push_pr"
        ? input.action
        : null;
    const branchName = gitStatus?.refName;
    if (
      branchName &&
      confirmableAction &&
      !input.featureBranch &&
      confirmPushToDefaultBranch &&
      requiresDefaultBranchConfirmation(input.action, isDefaultRef)
    ) {
      if (props.hasThread === false) {
        // A draft has no thread for the confirm sheet, so ask inline.
        const copy = resolveDefaultBranchActionDialogCopy({
          action: confirmableAction,
          branchName,
          includesCommit: confirmedActionIncludesCommit(
            input.action,
            gitStatus?.hasWorkingTreeChanges === true,
          ),
          terminology: sourceControlClients.get(gitStatus?.sourceControlProvider?.kind)
            .changeRequest,
        });
        Dialog.confirm({
          title: copy.title,
          message: copy.description,
          confirmText: copy.continueLabel,
          onConfirm: () => void onRunAction(input),
        });
        return;
      }
      navigation.navigate("GitConfirm", {
        environmentId: String(environmentId),
        threadId: String(threadId),
        confirmAction: confirmableAction,
        branchName,
        includesCommit: String(
          confirmedActionIncludesCommit(input.action, gitStatus?.hasWorkingTreeChanges === true),
        ),
      });
      return;
    }

    await onRunAction(input);
  };

  const runQuickAction = async () => {
    if (quickAction.disabled) return;
    if (quickAction.kind === "open_pr") {
      await openExistingPr();
      return;
    }
    if (quickAction.kind === "run_pull") {
      await onPull();
      return;
    }
    if (quickAction.kind === "run_action" && quickAction.action) {
      await runActionWithPrompt({ action: quickAction.action });
    }
  };

  const runDefaultBranchAction = async () => {
    if (defaultBranchPrimary && !defaultBranchPrimary.disabled && canWriteSourceControl) {
      await runActionWithPrompt({ action: defaultBranchPrimary.id });
    }
  };

  const runDefaultBranchRebase = async () => {
    if (defaultBranchRebase && !defaultBranchRebase.disabled && canWriteSourceControl) {
      await runActionWithPrompt({ action: "rebase_default" });
    }
  };

  const openReview = () => {
    navigation.navigate("ThreadReview", {
      environmentId: EnvironmentId.make(String(environmentId)),
      threadId: ThreadId.make(String(threadId)),
    });
  };

  const openGitInspector = () => {
    if (props.onOpenGitInspector) {
      props.onOpenGitInspector();
      return;
    }
    navigation.navigate("GitOverview", {
      environmentId: String(environmentId),
      threadId: String(threadId),
    });
  };

  return {
    currentBranchLabel,
    defaultBranchIcon:
      defaultBranchPrimary?.id === "push_default"
        ? ("arrow.up.circle" as const)
        : PullRequestGlyph.merged,
    defaultBranchPrimary,
    defaultBranchRebase,
    runDefaultBranchRebase,
    isRepo,
    openGitInspector,
    runDefaultBranchAction,
    openReview,
    quickAction,
    quickActionHint,
    quickActionIcon,
    runQuickAction,
  };
}

export function threadTerminalMenu(props: ThreadGitControlsProps): AppBarMenu | null {
  if (!props.canOpenTerminal) return null;
  return {
    title: "Terminal",
    icon: "terminal",
    badge: props.terminalSessions.filter((session) => session.hasRunningSubprocess).length,
    separateBackground: false,
    items: [
      ...(props.projectScripts.length > 0
        ? props.projectScripts.map((script) => ({
            id: `script-${script.id}`,
            title: projectScriptMenuLabel(script),
            icon: projectScriptMenuIcon(script.icon),
            subtitle: script.command,
            disabled: !props.canOperateTerminal,
            onPress: () => void props.onRunProjectScript(script),
          }))
        : [
            {
              id: "script-none",
              title: "No project scripts",
              icon: "play",
              subtitle: "This project has no saved scripts yet",
              disabled: true,
              onPress: () => {},
            },
          ]),
      ...props.terminalSessions.map((session) => ({
        id: `terminal-${session.terminalId}`,
        title: session.displayLabel,
        icon: "terminal",
        subtitle: [
          getTerminalStatusLabel({
            status: session.status,
            hasRunningSubprocess: session.hasRunningSubprocess,
          }),
          basename(session.cwd),
        ]
          .filter(Boolean)
          .join(" · "),
        onPress: () => props.onOpenTerminal(session.terminalId),
      })),
      {
        id: "terminal-new",
        title: "Open new terminal",
        icon: "plus",
        subtitle: "Start another shell for this thread",
        disabled: !props.canOperateTerminal,
        onPress: props.onOpenNewTerminal,
      },
    ],
  };
}

/** The thread's git menu, shared by the thread bar and Review. */
export function useThreadGitMenuDefinition(props: ThreadGitMenuProps): AppBarMenu | null {
  const model = useThreadGitControlModel(props);
  const icon = props.isWorktree
    ? "git.worktree"
    : "point.topleft.down.curvedto.point.bottomright.up";
  return {
    title: "Git controls",
    icon,
    separateBackground: false,
    items: [
      {
        id: "git-status",
        title: compactMenuBranchLabel(model.currentBranchLabel),
        icon,
        disabled: true,
        subtitle: compactMenuStatus(props.gitStatus),
        onPress: () => {},
      },
      {
        id: "git-quick-action",
        title: formatQuickActionLabel(model.quickAction, props.gitStatus),
        icon: model.quickActionIcon,
        disabled: model.quickAction.disabled,
        subtitle: model.quickActionHint ?? undefined,
        onPress: () => {
          void model.runQuickAction();
        },
      },
      ...(model.defaultBranchPrimary
        ? [
            {
              id: "git-default-branch",
              title: model.defaultBranchPrimary.label,
              icon: model.defaultBranchIcon,
              disabled: model.defaultBranchPrimary.disabled,
              subtitle: model.defaultBranchRebase
                ? "Default branch, branch is behind"
                : "Default branch",
              onPress: () => {
                void model.runDefaultBranchAction();
              },
            },
          ]
        : []),
      ...(model.defaultBranchRebase
        ? [
            {
              id: "git-default-branch-rebase",
              title: "Rebase onto the default branch",
              icon: model.defaultBranchIcon,
              disabled: model.defaultBranchRebase.disabled,
              subtitle: model.defaultBranchRebase.label.replace(
                "Rebase onto the default branch ",
                "",
              ),
              onPress: () => {
                void model.runDefaultBranchRebase();
              },
            },
          ]
        : []),
      {
        id: "git-review",
        title: "Review changes",
        icon: "text.bubble",
        disabled: !model.isRepo || props.hasThread === false,
        subtitle:
          props.hasThread === false
            ? "Available after the first message"
            : "Turn diffs and worktree changes",
        onPress: model.openReview,
      },
      ...(props.onMergeBack
        ? [
            {
              id: "git-merge-back",
              title: "Merge back to source",
              icon: PullRequestGlyph.merged,
              subtitle: "Bring this thread's latest turn into its source",
              onPress: props.onMergeBack,
            },
          ]
        : []),
      {
        id: "git-more",
        title: "More",
        icon: "ellipsis",
        disabled: props.hasThread === false,
        subtitle:
          props.hasThread === false
            ? "Available after the first message"
            : "Commit, files, branches",
        onPress: model.openGitInspector,
      },
    ],
  };
}
