import { SourceControlProviderKind, type VcsStatusResult } from "@t3tools/contracts";
import { sourceControlClients } from "@t3tools/client-runtime/source-control-clients";
import { resolveAutoFeatureBranchName } from "@t3tools/shared/git";
import { assert, describe, it } from "vite-plus/test";
import {
  buildMenuItems,
  type DefaultBranchConfirmableAction,
  formatQuickActionLabel,
  hasUsableGitMenuContent,
  requiresDefaultBranchConfirmation,
  resolveDefaultBranchActionDialogCopy,
  resolveFeatureBranchUnavailableReason,
  resolveLiveThreadBranchUpdate,
  resolveQuickAction,
  getMenuActionDisabledReason,
} from "./GitActionsControl.logic";

function status(overrides: Partial<VcsStatusResult> = {}): VcsStatusResult {
  return {
    isRepo: true,
    hasPrimaryRemote: true,
    isDefaultRef: false,
    refName: "feature/test",
    hasWorkingTreeChanges: false,
    workingTree: {
      files: [],
      insertions: 0,
      deletions: 0,
    },
    hasUpstream: true,
    aheadCount: 0,
    behindCount: 0,
    pr: null,
    ...overrides,
  };
}

function pushDisabledReason(gitStatus: VcsStatusResult): string | null {
  const item = buildMenuItems(gitStatus, false).find((menuItem) => menuItem.id === "push");
  assert.isDefined(item);
  return getMenuActionDisabledReason({ item, gitStatus, isBusy: false, hasPrimaryRemote: true });
}

describe("when: ref is clean, ahead, and has an open PR", () => {
  it("resolveQuickAction prefers push", () => {
    const quick = resolveQuickAction(
      status({
        aheadCount: 3,
        pr: {
          number: 13,
          title: "Open PR",
          url: "https://example.com/pr/13",
          baseRef: "main",
          headRef: "feature/test",
          state: "open",
        },
      }),
      false,
    );
    assert.deepInclude(quick, { kind: "run_action", action: "push", label: "Push" });
  });
});

describe("when: ref has diverged from its upstream", () => {
  const diverged = status({ aheadCount: 2, behindCount: 1 });

  it("offers force push beside a disabled Push", () => {
    const items = buildMenuItems(diverged, false);
    assert.equal(items.find((item) => item.id === "push")?.disabled, true);
    assert.deepInclude(
      items.find((item) => item.id === "force_push"),
      {
        disabled: false,
        dialogAction: "force_push",
      },
    );
    assert.equal(buildMenuItems(diverged, true).find((i) => i.id === "force_push")?.disabled, true);
  });

  it("does not offer force push when only ahead, only behind, or without an upstream", () => {
    for (const overrides of [
      { aheadCount: 2, behindCount: 0 },
      { aheadCount: 0, behindCount: 2 },
      { aheadCount: 2, behindCount: 1, hasUpstream: false },
    ]) {
      assert.isUndefined(
        buildMenuItems(status(overrides), false).find((item) => item.id === "force_push"),
      );
    }
  });
});

describe("when: ref is clean, up to date, and has no open PR", () => {
  it("enables create PR when synced with upstream but ahead of default, even with local changes", () => {
    const syncedFeature = status({
      aheadCount: 0,
      behindCount: 0,
      aheadOfDefaultCount: 1,
      pr: null,
    });

    const quick = resolveQuickAction(syncedFeature, false);
    assert.deepInclude(quick, {
      label: "Create PR",
      disabled: false,
      kind: "run_action",
      action: "create_pr",
    });

    const items = buildMenuItems(syncedFeature, false);
    assert.equal(items.find((item) => item.id === "pr")?.disabled, false);

    const dirtyFeature = { ...syncedFeature, hasWorkingTreeChanges: true };
    assert.equal(
      buildMenuItems(dirtyFeature, false).find((item) => item.id === "pr")?.disabled,
      false,
    );
    assert.equal(pushDisabledReason(dirtyFeature), "No local commits to push.");
  });

  it("offers the actions menu only when something in it is usable", () => {
    const hasContent = (
      gitStatus: VcsStatusResult,
      overrides: Partial<Parameters<typeof hasUsableGitMenuContent>[0]> = {},
    ) =>
      hasUsableGitMenuContent({
        menuItems: buildMenuItems(gitStatus, false, gitStatus.hasPrimaryRemote),
        canWriteSourceControl: true,
        canPublishRepository: false,
        hasNotice: false,
        ...overrides,
      });
    const clean = status();
    const dirty = status({ hasWorkingTreeChanges: true });

    assert.isFalse(hasContent(clean));
    assert.isTrue(hasContent(dirty));
    assert.isTrue(hasContent(status({ aheadCount: 1 })));
    assert.isFalse(hasContent(dirty, { canWriteSourceControl: false }));
    assert.isTrue(hasContent(status({ hasPrimaryRemote: false }), { canPublishRepository: true }));
    assert.isTrue(hasContent(clean, { hasNotice: true }));
  });
});

describe("when: on default ref without open PR", () => {
  it("resolveQuickAction returns commit and push when local changes exist", () => {
    const quick = resolveQuickAction(
      status({ refName: "main", hasWorkingTreeChanges: true }),
      false,
      true,
    );
    assert.deepInclude(quick, {
      kind: "run_action",
      action: "commit_push",
      label: "Commit & push",
      disabled: false,
    });
  });

  it("offers a feature branch only to actions that commit the changes", () => {
    const reason = (action: DefaultBranchConfirmableAction, hasWorkingTreeChanges: boolean) =>
      resolveFeatureBranchUnavailableReason({ action, branchName: "main", hasWorkingTreeChanges });
    assert.isNull(reason("commit_push", true));
    assert.isNull(reason("commit_push_pr", true));
    assert.isNotNull(reason("commit_push", false));
    assert.isNotNull(reason("push", true));
    assert.isNotNull(reason("create_pr", true));
  });
});

describe("when: local changes are behind upstream", () => {
  it("keeps the commit action available without pushing, with or without an open PR", () => {
    const behind = status({ hasWorkingTreeChanges: true, behindCount: 2 });
    const commit = {
      label: "Commit",
      disabled: false,
      kind: "run_action",
      action: "commit",
    } as const;
    assert.deepEqual(resolveQuickAction(behind, false), commit);
    assert.equal(
      pushDisabledReason({ ...behind, aheadCount: 1 }),
      "Branch is behind upstream. Pull/rebase before pushing.",
    );
    assert.deepEqual(
      resolveQuickAction(
        {
          ...behind,
          pr: {
            number: 13,
            title: "Open PR",
            url: "https://example.com/pr/13",
            baseRef: "main",
            headRef: "feature/test",
            state: "open",
          },
        },
        false,
      ),
      commit,
    );
  });
});

describe("when: ref has no upstream configured", () => {
  it("resolveQuickAction runs push and create PR when no upstream and commits are ahead", () => {
    const quick = resolveQuickAction(
      status({
        hasUpstream: false,
        aheadCount: 2,
        pr: null,
      }),
      false,
    );
    assert.deepInclude(quick, {
      kind: "run_action",
      action: "create_pr",
      label: "Push & create PR",
      disabled: false,
    });
  });

  it("resolveQuickAction publishes when no origin remote exists", () => {
    const quick = resolveQuickAction(
      status({
        hasUpstream: false,
        aheadCount: 2,
        pr: null,
      }),
      false,
      false,
      false,
    );
    assert.deepEqual(quick, {
      kind: "open_publish",
      label: "Publish repository",
      disabled: false,
    });
  });
});

describe("when: the ref is on GitLab", () => {
  const gitLab = {
    sourceControlProvider: {
      kind: SourceControlProviderKind.make("gitlab"),
      name: "GitLab",
      baseUrl: "https://gitlab.com",
    },
  };

  it("names merge requests in actions and the default-ref dialog", () => {
    const ahead = status({ ...gitLab, hasUpstream: false, aheadCount: 2 });
    assert.equal(resolveQuickAction(ahead, false).label, "Push & create MR");
    assert.equal(
      resolveQuickAction(status({ ...gitLab, hasWorkingTreeChanges: true }), false).label,
      "Commit, push & MR",
    );
    assert.equal(buildMenuItems(ahead, false).find((item) => item.id === "pr")?.label, "Create MR");

    const copy = resolveDefaultBranchActionDialogCopy({
      action: "create_pr",
      branchName: "main",
      includesCommit: false,
      terminology: sourceControlClients.get("gitlab").changeRequest,
    });
    assert.equal(copy.title, "Push & create MR from default ref?");
    assert.include(copy.description, "create a merge request on");
  });
});

describe("merging into the default branch", () => {
  const ahead = status({ aheadCount: 2, aheadOfDefaultCount: 2, hasUpstream: false });

  it("offers merge and merge & push on a feature branch with commits, enabled", () => {
    const items = buildMenuItems(ahead, false);
    assert.deepEqual(
      items.filter((item) => item.id === "merge" || item.id === "merge_push"),
      [
        {
          id: "merge",
          label: "Merge into default branch",
          disabled: false,
          icon: "merge",
          kind: "open_dialog",
          dialogAction: "merge",
        },
        {
          id: "merge_push",
          label: "Merge into default branch & push",
          disabled: false,
          icon: "merge",
          kind: "open_dialog",
          dialogAction: "merge_push",
        },
      ],
    );
  });

  it("offers only merge without a remote, and names the commit that pending changes add", () => {
    const items = buildMenuItems(status({ hasWorkingTreeChanges: true }), false, false);
    assert.deepEqual(
      items.filter((item) => item.id.startsWith("merge")).map((item) => item.label),
      ["Commit & merge into default branch"],
    );
  });

  it("disables both with nothing to merge and hides both on the default ref", () => {
    const upToDate = buildMenuItems(status({ aheadOfDefaultCount: 0 }), false);
    assert.deepEqual(
      upToDate.filter((item) => item.id.startsWith("merge")).map((item) => item.disabled),
      [true, true],
    );
    const onDefault = buildMenuItems(status({ isDefaultRef: true, aheadCount: 1 }), false);
    assert.equal(
      onDefault.some((item) => item.id.startsWith("merge")),
      false,
    );
  });

  it("makes the project's chosen merge the quick action, keeping the pull request one otherwise", () => {
    assert.deepInclude(resolveQuickAction(ahead, false, false, true, "merge_push"), {
      action: "merge_push",
      label: "Merge & push",
    });
    assert.deepInclude(
      resolveQuickAction(status({ hasWorkingTreeChanges: true }), false, false, true, "merge"),
      { action: "merge", label: "Commit & merge" },
    );
    assert.deepInclude(resolveQuickAction(ahead, false, false, false, "merge_push"), {
      action: "merge",
    });
    assert.equal(resolveQuickAction(ahead, false, false, true).action, "create_pr");
    assert.notEqual(
      resolveQuickAction(ahead, false, true, true, "merge").action,
      "merge",
      "on the default ref the quick action stays a push",
    );
  });
});

describe("requiresDefaultBranchConfirmation", () => {
  it("requires confirmation for push actions on default ref", () => {
    assert.isFalse(requiresDefaultBranchConfirmation("commit", true));
    assert.isTrue(requiresDefaultBranchConfirmation("push", true));
    assert.isTrue(requiresDefaultBranchConfirmation("create_pr", true));
    assert.isTrue(requiresDefaultBranchConfirmation("commit_push", true));
    assert.isTrue(requiresDefaultBranchConfirmation("commit_push_pr", true));
    assert.isFalse(requiresDefaultBranchConfirmation("commit_push", false));
    assert.isFalse(requiresDefaultBranchConfirmation("push", false));
  });
});

describe("resolveLiveThreadBranchUpdate", () => {
  it("returns a branch update when live git status differs from stored thread metadata", () => {
    const update = resolveLiveThreadBranchUpdate({
      threadBranch: "feature/old-ref",
      gitStatus: status({ refName: "effect-atom" }),
    });

    assert.deepEqual(update, {
      branch: "effect-atom",
    });
  });

  it("returns null when git status is detached HEAD but the thread already has a ref", () => {
    const update = resolveLiveThreadBranchUpdate({
      threadBranch: "effect-atom",
      gitStatus: status({ refName: null }),
    });

    assert.equal(update, null);
  });

  it("does not regress a semantic thread ref back to a temporary worktree ref", () => {
    const update = resolveLiveThreadBranchUpdate({
      threadBranch: "t3code/github-query-rate-limit",
      gitStatus: status({ refName: "t3code/bda76797" }),
    });

    assert.equal(update, null);
  });
});

describe("resolveAutoFeatureBranchName", () => {
  it("increments suffix when the preferred ref name already exists", () => {
    const ref = resolveAutoFeatureBranchName(
      ["main", "feature/fix-toast-copy", "feature/fix-toast-copy-2"],
      "fix toast copy",
    );
    assert.equal(ref, "feature/fix-toast-copy-3");
  });

  it("treats existing ref names as case-insensitive for collision checks", () => {
    const ref = resolveAutoFeatureBranchName(["Feature/Ticket-1"], "feature/ticket-1");
    assert.equal(ref, "feature/ticket-1-2");
  });
});

describe("formatQuickActionLabel", () => {
  it("names the commits a Push action sends", () => {
    const ahead = status({ refName: "feature/x", hasUpstream: true, aheadCount: 3 });
    assert.equal(
      formatQuickActionLabel(resolveQuickAction(ahead, false, false, true), ahead),
      "Push 3 commits & create PR",
    );
    const one = status({ refName: "main", hasUpstream: true, aheadCount: 1 });
    assert.equal(
      formatQuickActionLabel(resolveQuickAction(one, false, true, true), one),
      "Push 1 commit",
    );
  });

  it("leaves labels that push nothing alone", () => {
    const synced = status({ refName: "feature/x", hasUpstream: true, aheadCount: 0 });
    const action = resolveQuickAction(synced, false, false, true);
    assert.equal(formatQuickActionLabel(action, synced), action.label);
    const dirty = status({ hasWorkingTreeChanges: true, hasUpstream: true, aheadCount: 2 });
    assert.equal(
      formatQuickActionLabel(resolveQuickAction(dirty, false, true, true), dirty),
      "Commit & push",
    );
  });
});
