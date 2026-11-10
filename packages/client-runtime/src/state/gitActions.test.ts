import { SourceControlProviderKind, type VcsStatusResult } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { sourceControlClients } from "../sourceControlClients.ts";
import {
  buildMenuItems,
  formatQuickActionLabel,
  getGitActionDisabledReason,
  resolveDefaultBranchActionDialogCopy,
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

describe("merge into the default branch", () => {
  const ahead = status({ aheadCount: 2, aheadOfDefaultCount: 2 });

  it("lists Merge and Merge & push for a feature branch, none on the default ref", () => {
    const labels = (s: VcsStatusResult) => buildMenuItems(s, false).map((item) => item.label);
    expect(labels(ahead)).toEqual(["Commit", "Push", "Merge", "Merge & push", "Create PR"]);
    expect(labels(status({ ...ahead, hasWorkingTreeChanges: true }))).toContain("Commit & merge");
    expect(labels(status({ ...ahead, isDefaultRef: true }))).toEqual([
      "Commit",
      "Push",
      "Create PR",
    ]);
    expect(buildMenuItems(ahead, false, false).map((item) => item.id)).not.toContain("merge_push");
  });

  it("locks Merge when there is nothing to merge", () => {
    const merge = buildMenuItems(status(), false).find((item) => item.id === "merge")!;
    expect(merge.disabled).toBe(true);
    expect(
      getGitActionDisabledReason({
        item: merge,
        gitStatus: status(),
        isBusy: false,
        hasOriginRemote: true,
      }),
    ).toBe("No commits or changes to merge into the default branch.");
  });

  it("offers a force push for a rewritten history", () => {
    const diverged = status({ aheadCount: 1, behindCount: 1 });
    expect(buildMenuItems(diverged, false).find((item) => item.id === "force_push")).toMatchObject({
      dialogAction: "force_push",
      disabled: false,
    });
  });

  it("makes Merge the main action when the project merges directly", () => {
    expect(resolveQuickAction(ahead, false, false, true, "merge")).toMatchObject({
      label: "Merge",
      action: "merge",
    });
    expect(resolveQuickAction(ahead, false, false, true, "merge_push")).toMatchObject({
      label: "Merge & push",
      action: "merge_push",
    });
    expect(resolveQuickAction(status(), false, false, true, "merge")).toMatchObject({
      label: "Merge",
      disabled: true,
    });
  });

  it("offers a pull request for a pushed branch that is ahead of the default branch", () => {
    expect(resolveQuickAction(ahead, false)).toMatchObject({ action: "create_pr" });
    expect(
      formatQuickActionLabel(resolveQuickAction(ahead, false, false, true, "merge"), ahead),
    ).toBe("Merge 2 commits");
  });
});

describe("git action copy", () => {
  it("says PR for a GitHub ref", () => {
    expect(resolveQuickAction(status({ aheadCount: 1 }), false).label).toBe("Push & create PR");
    expect(resolveQuickAction(status({ pr: openPr }), false).label).toBe("View PR");
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
