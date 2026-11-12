import type {
  GitRunStackedActionInput,
  GitStackedAction,
  QuickMergeAction,
  VcsStatusResult,
} from "@t3tools/contracts";
import { type ChangeRequestTerminology, sourceControlClients } from "../sourceControlClients.ts";

export type GitActionIconName = "commit" | "push" | "pr" | "merge";

export type GitDialogAction =
  | "commit"
  | "push"
  | "force_push"
  | "create_pr"
  | "merge"
  | "merge_push"
  | "push_default";

export interface GitActionMenuItem {
  id: "commit" | "push" | "force_push" | "pr" | "merge" | "merge_push" | "push_default";
  label: string;
  disabled: boolean;
  icon: GitActionIconName;
  kind: "open_dialog" | "open_pr";
  dialogAction?: GitDialogAction;
}

export interface GitQuickAction {
  label: string;
  disabled: boolean;
  kind: "run_action" | "run_pull" | "open_pr" | "show_hint";
  action?: GitStackedAction;
  hint?: string;
}

export interface DefaultBranchActionDialogCopy {
  title: string;
  description: string;
  continueLabel: string;
}

export type DefaultBranchConfirmableAction =
  | "push"
  | "create_pr"
  | "commit_push"
  | "commit_push_pr";

export type GitActionRequestInput = Pick<
  GitRunStackedActionInput,
  "action" | "commitMessage" | "featureBranch" | "filePaths"
>;

export function changeRequestTerminologyFor(
  gitStatus: VcsStatusResult | null,
): ChangeRequestTerminology {
  return sourceControlClients.get(gitStatus?.sourceControlProvider?.kind).changeRequest;
}

export function buildMenuItems(
  gitStatus: VcsStatusResult | null,
  isBusy: boolean,
  hasOriginRemote = true,
): GitActionMenuItem[] {
  if (!gitStatus) return [];
  const terminology = changeRequestTerminologyFor(gitStatus);

  const hasBranch = gitStatus.refName !== null;
  const hasChanges = gitStatus.hasWorkingTreeChanges;
  const hasOpenPr = gitStatus.pr?.state === "open";
  const isBehind = gitStatus.behindCount > 0;
  const hasDefaultBranchDelta = (gitStatus.aheadOfDefaultCount ?? gitStatus.aheadCount) > 0;
  const canPushWithoutUpstream = hasOriginRemote && !gitStatus.hasUpstream;
  const canCommit = !isBusy && hasChanges;
  const canPush =
    !isBusy &&
    hasBranch &&
    !isBehind &&
    gitStatus.aheadCount > 0 &&
    (gitStatus.hasUpstream || canPushWithoutUpstream);
  const canCreatePr =
    !isBusy &&
    hasBranch &&
    !hasOpenPr &&
    hasDefaultBranchDelta &&
    !isBehind &&
    (gitStatus.hasUpstream || canPushWithoutUpstream);
  const canOpenPr = !isBusy && hasOpenPr;

  // A rewritten history can't be pushed or pulled; replacing the remote branch is the way out.
  const forcePushItems: GitActionMenuItem[] =
    gitStatus.hasUpstream && hasBranch && isBehind && gitStatus.aheadCount > 0
      ? [
          {
            id: "force_push",
            label: "Force push...",
            disabled: isBusy,
            icon: "push",
            kind: "open_dialog",
            dialogAction: "force_push",
          },
        ]
      : [];

  return [
    {
      id: "commit",
      label: "Commit",
      disabled: !canCommit,
      icon: "commit",
      kind: "open_dialog",
      dialogAction: "commit",
    },
    {
      id: "push",
      label: "Push",
      disabled: !canPush,
      icon: "push",
      kind: "open_dialog",
      dialogAction: "push",
    },
    ...forcePushItems,
    hasOpenPr
      ? {
          id: "pr",
          label: `View ${terminology.shortLabel}`,
          disabled: !canOpenPr,
          icon: "pr",
          kind: "open_pr",
        }
      : {
          id: "pr",
          label: `Create ${terminology.shortLabel}`,
          disabled: !canCreatePr,
          icon: "pr",
          kind: "open_dialog",
          dialogAction: "create_pr",
        },
  ];
}

export function resolveQuickAction(
  gitStatus: VcsStatusResult | null,
  isBusy: boolean,
  isDefaultBranch = false,
  hasOriginRemote = true,
  createPr = true,
): GitQuickAction {
  if (isBusy) {
    return { label: "Commit", disabled: true, kind: "show_hint", hint: "Git action in progress." };
  }

  if (!gitStatus) {
    return {
      label: "Commit",
      disabled: true,
      kind: "show_hint",
      hint: "Git status is unavailable.",
    };
  }

  const hasBranch = gitStatus.refName !== null;
  const hasChanges = gitStatus.hasWorkingTreeChanges;
  const hasOpenPr = gitStatus.pr?.state === "open";
  const isAhead = gitStatus.aheadCount > 0;
  const hasDefaultBranchDelta = (gitStatus.aheadOfDefaultCount ?? gitStatus.aheadCount) > 0;
  const isBehind = gitStatus.behindCount > 0;
  const isDiverged = isAhead && isBehind;
  const terminology = changeRequestTerminologyFor(gitStatus);

  if (!hasBranch) {
    return {
      label: "Commit",
      disabled: true,
      kind: "show_hint",
      hint: `Create and checkout a branch before pushing or opening ${terminology.shortLabelWithArticle}.`,
    };
  }

  if (hasChanges) {
    if (isBehind || (!gitStatus.hasUpstream && !hasOriginRemote)) {
      return { label: "Commit", disabled: false, kind: "run_action", action: "commit" };
    }
    if (hasOpenPr || isDefaultBranch || !createPr) {
      return { label: "Commit & push", disabled: false, kind: "run_action", action: "commit_push" };
    }
    return {
      label: `Commit, push & ${terminology.shortLabel}`,
      disabled: false,
      kind: "run_action",
      action: "commit_push_pr",
    };
  }

  if (!gitStatus.hasUpstream) {
    if (!hasOriginRemote) {
      if (hasOpenPr && !isAhead) {
        return { label: `View ${terminology.shortLabel}`, disabled: false, kind: "open_pr" };
      }
      return {
        label: "Push",
        disabled: true,
        kind: "show_hint",
        hint: `Add an "origin" remote before pushing or creating ${terminology.shortLabelWithArticle}.`,
      };
    }
    if (!isAhead) {
      if (hasOpenPr) {
        return { label: `View ${terminology.shortLabel}`, disabled: false, kind: "open_pr" };
      }
      return {
        label: "Push",
        disabled: true,
        kind: "show_hint",
        hint: "No local commits to push.",
      };
    }
    if (hasOpenPr || isDefaultBranch || !createPr) {
      return {
        label: "Push",
        disabled: false,
        kind: "run_action",
        action: isDefaultBranch ? "commit_push" : "push",
      };
    }
    return {
      label: `Push & create ${terminology.shortLabel}`,
      disabled: false,
      kind: "run_action",
      action: "create_pr",
    };
  }

  if (isDiverged) {
    return {
      label: "Sync branch",
      disabled: true,
      kind: "show_hint",
      hint: "Branch has diverged from upstream. Rebase/merge first, or force push from the menu.",
    };
  }

  if (isBehind) {
    return {
      label: "Pull",
      disabled: false,
      kind: "run_pull",
    };
  }

  if (isAhead) {
    if (hasOpenPr || isDefaultBranch || !createPr) {
      return {
        label: "Push",
        disabled: false,
        kind: "run_action",
        action: isDefaultBranch ? "commit_push" : "push",
      };
    }
    return {
      label: `Push & create ${terminology.shortLabel}`,
      disabled: false,
      kind: "run_action",
      action: "create_pr",
    };
  }

  if (hasOpenPr && gitStatus.hasUpstream) {
    return { label: `View ${terminology.shortLabel}`, disabled: false, kind: "open_pr" };
  }

  if (createPr && hasDefaultBranchDelta && !isDefaultBranch) {
    return {
      label: `Create ${terminology.shortLabel}`,
      disabled: false,
      kind: "run_action",
      action: "create_pr",
    };
  }

  return {
    label: "Commit",
    disabled: true,
    kind: "show_hint",
    hint: "Branch is up to date. No action needed.",
  };
}

export function getGitActionDisabledReason(input: {
  item: GitActionMenuItem;
  gitStatus: VcsStatusResult | null;
  isBusy: boolean;
  hasOriginRemote: boolean;
}): string | null {
  const { item, gitStatus, isBusy, hasOriginRemote } = input;
  if (!item.disabled) return null;
  if (isBusy) return "Git action in progress.";
  if (!gitStatus) return "Git status is unavailable.";

  const hasBranch = gitStatus.refName !== null;
  const hasChanges = gitStatus.hasWorkingTreeChanges;
  const hasOpenPr = gitStatus.pr?.state === "open";
  const isAhead = gitStatus.aheadCount > 0;
  const isBehind = gitStatus.behindCount > 0;
  const terminology = changeRequestTerminologyFor(gitStatus);

  if (item.id === "commit") {
    if (!hasChanges) {
      return "Worktree is clean. Make changes before committing.";
    }
    return "Commit is currently unavailable.";
  }

  if (item.id === "merge" || item.id === "merge_push") {
    if (!hasBranch) return "Detached HEAD: checkout a branch before merging.";
    return "No commits or changes to merge into the default branch.";
  }

  if (item.id === "push_default") return "No commits on the default branch to push.";

  if (item.id === "push") {
    if (!hasBranch) {
      return "Detached HEAD: checkout a branch before pushing.";
    }
    if (hasChanges) {
      return "Commit or stash local changes before pushing.";
    }
    if (isBehind) {
      return "Branch is behind upstream. Pull/rebase before pushing.";
    }
    if (!gitStatus.hasUpstream && !hasOriginRemote) {
      return 'Add an "origin" remote before pushing.';
    }
    if (!isAhead) {
      return "No local commits to push.";
    }
    return "Push is currently unavailable.";
  }

  if (hasOpenPr) {
    return `View ${terminology.shortLabel} is currently unavailable.`;
  }
  if (!hasBranch) {
    return `Detached HEAD: checkout a branch before creating ${terminology.shortLabelWithArticle}.`;
  }
  if (!gitStatus.hasUpstream && !hasOriginRemote) {
    return `Add an "origin" remote before creating ${terminology.shortLabelWithArticle}.`;
  }
  if ((gitStatus.aheadOfDefaultCount ?? gitStatus.aheadCount) <= 0) {
    return `No local commits to include in ${terminology.shortLabelWithArticle}.`;
  }
  if (isBehind) {
    return `Branch is behind upstream. Pull/rebase before creating ${terminology.shortLabelWithArticle}.`;
  }
  return `Create ${terminology.shortLabel} is currently unavailable.`;
}

export function requiresDefaultBranchConfirmation(
  action: GitStackedAction,
  isDefaultBranch: boolean,
): boolean {
  if (!isDefaultBranch) return false;
  return (
    action === "push" ||
    action === "create_pr" ||
    action === "commit_push" ||
    action === "commit_push_pr"
  );
}

export function resolveDefaultBranchActionDialogCopy(input: {
  action: DefaultBranchConfirmableAction;
  branchName: string;
  includesCommit: boolean;
  terminology: ChangeRequestTerminology;
}): DefaultBranchActionDialogCopy {
  const branchLabel = input.branchName;
  const { shortLabel, shortLabelWithArticle } = input.terminology;
  const suffix = ` on "${branchLabel}". You can continue on this branch or create a feature branch and run the same action there.`;

  if (input.action === "push" || input.action === "commit_push") {
    if (input.includesCommit) {
      return {
        title: "Commit & push to default branch?",
        description: `This action will commit and push changes${suffix}`,
        continueLabel: `Commit & push to ${branchLabel}`,
      };
    }
    return {
      title: "Push to default branch?",
      description: `This action will push local commits${suffix}`,
      continueLabel: `Push to ${branchLabel}`,
    };
  }

  if (input.includesCommit) {
    return {
      title: `Commit, push & create ${shortLabel} from default branch?`,
      description: `This action will commit, push, and create ${shortLabelWithArticle}${suffix}`,
      continueLabel: `Commit, push & create ${shortLabel}`,
    };
  }
  return {
    title: `Push & create ${shortLabel} from default branch?`,
    description: `This action will push local commits and create ${shortLabelWithArticle}${suffix}`,
    continueLabel: `Push & create ${shortLabel}`,
  };
}

/** Names how many files a Commit action stages, or how many commits a Push action sends; other labels pass through. */
export function formatQuickActionLabel(
  quickAction: Pick<GitQuickAction, "label" | "disabled">,
  gitStatus: Pick<VcsStatusResult, "aheadCount" | "workingTree"> | null,
): string {
  if (quickAction.disabled || !gitStatus) return quickAction.label;
  const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  const files = gitStatus.workingTree.files.length;
  const commits = gitStatus.aheadCount;
  if (quickAction.label.startsWith("Commit") && files > 0) {
    return quickAction.label.replace("Commit", `Commit ${plural(files, "file")}`);
  }
  if (quickAction.label.startsWith("Push") && commits > 0) {
    return quickAction.label.replace("Push", `Push ${plural(commits, "commit")}`);
  }
  return quickAction.label;
}

export type DefaultBranchActionItem = GitActionMenuItem & {
  id: "merge" | "merge_push" | "push_default";
};

export interface DefaultBranchActions {
  /** What the button does on a click: the merge, or the push when there is nothing to merge. */
  readonly primary: DefaultBranchActionItem;
  readonly items: DefaultBranchActionItem[];
}

/** Actions on the default branch from another branch; null on the default branch itself. */
export function resolveDefaultBranchActions(
  gitStatus: VcsStatusResult | null,
  isBusy: boolean,
  hasOriginRemote: boolean,
  quickMergeAction: QuickMergeAction,
): DefaultBranchActions | null {
  if (!gitStatus?.isRepo || gitStatus.refName === null || gitStatus.isDefaultRef) return null;

  const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  const hasChanges = gitStatus.hasWorkingTreeChanges;
  const files = gitStatus.workingTree.files.length;
  const mergeCommits = gitStatus.aheadOfDefaultCount ?? gitStatus.aheadCount;
  // Older servers neither count these commits nor know the push action.
  const canPushDefault = hasOriginRemote && gitStatus.defaultAheadCount !== undefined;
  const pushCommits = gitStatus.defaultAheadCount ?? 0;
  const mergeDisabled = isBusy || (!hasChanges && mergeCommits <= 0);
  const pushDisabled = isBusy || pushCommits <= 0;
  const mergeLabel = (andPush: boolean) =>
    !andPush && !hasChanges && mergeCommits <= 0 && gitStatus.mergedIntoDefault === true
      ? "Merged"
      : hasChanges
        ? `${files > 0 ? `Commit ${plural(files, "file")}` : "Commit"}${andPush ? ", merge & push" : " & merge"}`
        : `Merge${mergeCommits > 0 ? ` ${plural(mergeCommits, "commit")}` : ""}${andPush ? " & push" : ""}`;
  const item = (
    id: DefaultBranchActionItem["id"],
    label: string,
    disabled: boolean,
  ): DefaultBranchActionItem => ({
    id,
    label,
    disabled,
    icon: id === "push_default" ? "push" : "merge",
    kind: "open_dialog",
    dialogAction: id,
  });

  const merge = item("merge", mergeLabel(false), mergeDisabled);
  const mergePush = item("merge_push", mergeLabel(true), mergeDisabled);
  const push = item(
    "push_default",
    pushCommits > 0 ? `Push ${plural(pushCommits, "commit")}` : "Push",
    pushDisabled,
  );
  return {
    primary:
      mergeDisabled && !pushDisabled
        ? push
        : quickMergeAction === "merge_push" && hasOriginRemote
          ? mergePush
          : merge,
    items: hasOriginRemote
      ? canPushDefault
        ? [merge, mergePush, push]
        : [merge, mergePush]
      : [merge],
  };
}
