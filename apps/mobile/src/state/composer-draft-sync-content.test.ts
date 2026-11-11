import { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";

import {
  composerDraftToSyncContent,
  syncedContentToDraftChange,
} from "./composer-draft-sync-content";
import type { ComposerDraft } from "./use-composer-drafts";

const environmentId = EnvironmentId.make("env-1");
const projectId = ProjectId.make("project-1");
const empty: ComposerDraft = { text: "", attachments: [] };

it("syncs only drafts with text, and a new task with its project and workspace", () => {
  expect(composerDraftToSyncContent("env-1:thread-1", { ...empty, text: "  " })).toBeNull();
  const draft: ComposerDraft = {
    ...empty,
    text: "ship it",
    project: { environmentId, projectId, createdAt: "2026-11-11T00:00:00.000Z" },
    workspaceSelection: { mode: "worktree", branch: "feat/x", worktreePath: null },
  };
  expect(composerDraftToSyncContent("env-1:thread-1", { ...draft })?.session).toBeNull();
  expect(composerDraftToSyncContent("new-task:abc", draft)?.session).toMatchObject({
    projectId,
    envMode: "worktree",
    branch: "feat/x",
  });
});

it("turns a received draft into the changes it makes, leaving what already matches alone", () => {
  const content = composerDraftToSyncContent("new-task:abc", {
    ...empty,
    text: "from web",
    runtimeMode: "full-access",
    project: { environmentId, projectId, createdAt: "2026-11-11T00:00:00.000Z" },
  })!;
  const change = syncedContentToDraftChange(empty, content, true, environmentId);
  expect(change?.text).toBe("from web");
  expect(change?.settings).toMatchObject({
    runtimeMode: "full-access",
    project: { environmentId, projectId },
  });
  // A plain local session leaves the workspace unchosen, as on this device.
  expect(change?.settings.workspaceSelection).toBeUndefined();

  const same = syncedContentToDraftChange(
    { ...empty, text: "from web", runtimeMode: "full-access", project: change?.settings.project },
    content,
    true,
    environmentId,
  );
  expect(same).toEqual({ text: null, settings: {} });
  // A new-task draft with no session cannot be opened here.
  expect(
    syncedContentToDraftChange(empty, { ...content, session: null }, true, environmentId),
  ).toBeNull();
});
