import type {
  ComposerDraftContent,
  EnvironmentId,
  ProviderInteractionMode,
  RuntimeMode,
} from "@t3tools/contracts";
import { ProjectId } from "@t3tools/contracts";

import { isNewTaskDraftKey } from "./new-task-draft-key";
import type { ComposerDraft } from "./use-composer-drafts";

const contentCache = new WeakMap<ComposerDraft, ComposerDraftContent | null>();

/** What of a draft other devices can show: its text, model pick, modes and new-task session. */
export function composerDraftToSyncContent(
  key: string,
  draft: ComposerDraft,
): ComposerDraftContent | null {
  const cached = contentCache.get(draft);
  if (cached !== undefined) return cached;
  const selection = draft.workspaceSelection;
  const content: ComposerDraftContent | null =
    draft.text.trim().length === 0
      ? null
      : {
          prompt: draft.text,
          records: [],
          modelSelection: draft.modelSelection ?? null,
          runtimeMode: draft.runtimeMode ?? null,
          interactionMode: draft.interactionMode ?? null,
          session:
            isNewTaskDraftKey(key) && draft.project !== undefined
              ? {
                  projectId: draft.project.projectId,
                  branch: selection?.branch ?? null,
                  worktreePath: selection?.worktreePath ?? null,
                  envMode: selection?.mode ?? "local",
                  ...(selection?.startFromOrigin === undefined
                    ? {}
                    : { startFromOrigin: selection.startFromOrigin }),
                  createdAt: draft.project.createdAt,
                  ...(selection?.pullRequestReference === undefined
                    ? {}
                    : { pullRequestReference: selection.pullRequestReference }),
                  ...(selection?.followsCurrentCheckout === undefined
                    ? {}
                    : { followsCurrentCheckout: selection.followsCurrentCheckout }),
                }
              : null,
        };
  contentCache.set(draft, content);
  return content;
}

/** What a draft from another device changes here: its text, and the settings that differ. */
export function syncedContentToDraftChange(
  existing: ComposerDraft,
  content: ComposerDraftContent,
  isNewTask: boolean,
  environmentId: EnvironmentId,
): { readonly text: string | null; readonly settings: Partial<ComposerDraft> } | null {
  const session = content.session;
  if (isNewTask && session === null) return null;
  const settings: {
    -readonly [K in keyof ComposerDraft]?: ComposerDraft[K];
  } & {
    modelSelection?: ComposerDraft["modelSelection"];
    runtimeMode?: RuntimeMode;
    interactionMode?: ProviderInteractionMode;
  } = {};
  if (
    content.modelSelection !== null &&
    JSON.stringify(existing.modelSelection) !== JSON.stringify(content.modelSelection)
  ) {
    settings.modelSelection = content.modelSelection;
  }
  if (content.runtimeMode !== null && existing.runtimeMode !== content.runtimeMode) {
    settings.runtimeMode = content.runtimeMode;
  }
  if (content.interactionMode !== null && existing.interactionMode !== content.interactionMode) {
    settings.interactionMode = content.interactionMode;
  }
  if (isNewTask && session !== null) {
    if (existing.project === undefined) {
      settings.project = {
        environmentId,
        projectId: ProjectId.make(session.projectId),
        createdAt: session.createdAt,
      };
    }
    // A plain local draft with no branch is how an unchosen workspace looks on the other device.
    const chosen =
      session.envMode !== "local" ||
      session.branch !== null ||
      session.worktreePath !== null ||
      session.startFromOrigin === true ||
      session.pullRequestReference !== undefined ||
      session.followsCurrentCheckout !== undefined;
    if (chosen) {
      const workspaceSelection = {
        mode: session.envMode,
        branch: session.branch,
        worktreePath: session.worktreePath,
        ...(session.startFromOrigin === undefined
          ? {}
          : { startFromOrigin: session.startFromOrigin }),
        ...(session.pullRequestReference === undefined
          ? {}
          : { pullRequestReference: session.pullRequestReference }),
        ...(session.followsCurrentCheckout === undefined
          ? {}
          : { followsCurrentCheckout: session.followsCurrentCheckout }),
      };
      if (JSON.stringify(existing.workspaceSelection) !== JSON.stringify(workspaceSelection)) {
        settings.workspaceSelection = workspaceSelection;
      }
    }
  }
  return { text: existing.text !== content.prompt ? content.prompt : null, settings };
}
