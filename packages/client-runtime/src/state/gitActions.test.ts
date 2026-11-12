import {
  SourceControlProviderKind,
  type QuickMergeAction,
  type VcsStatusResult,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { sourceControlClients } from "../sourceControlClients.ts";
import {
  buildMenuItems,
  getGitActionDisabledReason,
  resolveDefaultBranchActionDialogCopy,
  resolveDefaultBranchActions,
  resolveQuickAction,
} from "./gitActions.ts";

function status(overrides: Partial<VcsStatusResult> = {}): VcsStatusResult {
  return {
    isRepo: true,
    hasPrimaryRemote: true,
    isDefaultRef: false,
    refName: "feature/test",
    hasWorkingTreeChanges: false,
    workingTree: { files: [], insertions: 0, deletions: 0 },
    hasUpstream: true,
    aheadCount: 0,
    behindCount: 0,
    pr: null,
    ...overrides,
  };
}

const gitLab = {
  sourceControlProvider: {
    kind: SourceControlProviderKind.make("gitlab"),
    name: "GitLab",
    baseUrl: "https://gitlab.com",
  },
};

const openPr = {
  number: 7,
  title: "Feature",
  url: "https://example.com/pr/7",
  baseRef: "main",
  headRef: "feature/test",
  state: "open" as const,
};

describe("default branch actions", () => {
  const ahead = status({ aheadCount: 2, aheadOfDefaultCount: 2 });
  const resolve = (s: VcsStatusResult, remote = true, mode: QuickMergeAction = "merge") =>
    resolveDefaultBranchActions(s, false, remote, mode)!;

  it("leaves them out of the Git actions", () => {
    const labels = (s: VcsStatusResult) => buildMenuItems(s, false).map((item) => item.label);
    expect(labels(ahead)).toEqual(["Commit", "Push", "Create PR"]);
    expect(resolveQuickAction(ahead, false)).toMatchObject({ action: "create_pr" });
  });

  it("is absent on the default ref and a detached HEAD", () => {
    expect(resolveDefaultBranchActions(status({ isDefaultRef: true }), false, true, "merge")).toBe(
      null,
    );
    expect(resolveDefaultBranchActions(status({ refName: null }), false, true, "merge")).toBe(null);
  });

  it("merges by default, naming the commits, and lists the push under it", () => {
    const actions = resolve({ ...ahead, defaultAheadCount: 3 });
    expect(actions.primary).toMatchObject({ id: "merge", label: "Merge 2 commits" });
    expect(actions.items.map((item) => item.label)).toEqual([
      "Merge 2 commits",
      "Merge 2 commits & push",
      "Push 3 commits",
    ]);
    expect(resolve(ahead, true, "merge_push").primary.id).toBe("merge_push");
    expect(resolve({ ...ahead, hasWorkingTreeChanges: true }).primary.label).toBe("Commit & merge");
  });

  it("says a merged branch is merged", () => {
    expect(resolve(status({ mergedIntoDefault: true })).items[0]).toMatchObject({
      label: "Merged",
      disabled: true,
    });
    expect(resolve(status()).items[0]?.label).toBe("Merge");
  });

  it("puts the push on the button when there is nothing to merge", () => {
    const actions = resolve(status({ defaultAheadCount: 1 }));
    expect(actions.primary).toMatchObject({
      id: "push_default",
      label: "Push 1 commit",
      disabled: false,
    });
    expect(actions.items.find((item) => item.id === "merge")?.disabled).toBe(true);
  });

  it("locks everything when there is nothing to merge or push, and offers only a merge without a remote", () => {
    const idle = resolve(status({ defaultAheadCount: 0 }));
    expect(idle.primary).toMatchObject({ id: "merge", disabled: true });
    expect(idle.items.find((item) => item.id === "push_default")?.disabled).toBe(true);
    expect(resolve(ahead, false).items.map((item) => item.id)).toEqual(["merge"]);
    // An older server does not count the default branch's commits, so there is no push to offer.
    expect(resolve(status()).items.map((item) => item.id)).toEqual(["merge", "merge_push"]);
    expect(resolveDefaultBranchActions(ahead, true, true, "merge")!.primary.disabled).toBe(true);
  });
});

describe("git action copy", () => {
  it("says PR for a GitHub ref", () => {
    expect(resolveQuickAction(status({ aheadCount: 1 }), false).label).toBe("Push & create PR");
    expect(resolveQuickAction(status({ pr: openPr }), false).label).toBe("View PR");
    const pushOnly = (s: VcsStatusResult) => resolveQuickAction(s, false, false, true, false);
    expect(pushOnly(status({ aheadCount: 1 }))).toMatchObject({ label: "Push", action: "push" });
    expect(pushOnly(status({ hasWorkingTreeChanges: true }))).toMatchObject({
      action: "commit_push",
    });
    expect(pushOnly(status({ hasUpstream: false, aheadCount: 1 }))).toMatchObject({
      action: "push",
    });
    expect(pushOnly(status({ aheadOfDefaultCount: 1 })).disabled).toBe(true);
    const prItem = buildMenuItems(status(), false).find((item) => item.id === "pr");
    expect(prItem?.label).toBe("Create PR");
    expect(
      getGitActionDisabledReason({
        item: prItem!,
        gitStatus: status(),
        isBusy: false,
        hasOriginRemote: true,
      }),
    ).toBe("No local commits to include in a PR.");
  });

  it("says MR for a GitLab ref", () => {
    expect(resolveQuickAction(status({ ...gitLab, aheadCount: 1 }), false).label).toBe(
      "Push & create MR",
    );
    expect(
      resolveQuickAction(status({ ...gitLab, hasWorkingTreeChanges: true }), false).label,
    ).toBe("Commit, push & MR");
    expect(resolveQuickAction(status({ ...gitLab, pr: openPr }), false).label).toBe("View MR");
    const prItem = buildMenuItems(status(gitLab), false).find((item) => item.id === "pr");
    expect(prItem?.label).toBe("Create MR");
    expect(
      getGitActionDisabledReason({
        item: prItem!,
        gitStatus: status(gitLab),
        isBusy: false,
        hasOriginRemote: true,
      }),
    ).toBe("No local commits to include in an MR.");
  });

  it("names the host's change request in the default-branch dialog", () => {
    const input = { action: "commit_push_pr", branchName: "main", includesCommit: true } as const;
    expect(
      resolveDefaultBranchActionDialogCopy({
        ...input,
        terminology: sourceControlClients.get("github").changeRequest,
      }).title,
    ).toBe("Commit, push & create PR from default branch?");
    expect(
      resolveDefaultBranchActionDialogCopy({
        ...input,
        terminology: sourceControlClients.get("gitlab").changeRequest,
      }).continueLabel,
    ).toBe("Commit, push & create MR");
  });
});
