import { settlePromise, squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import {
  AuthOrchestrationOperateScope,
  type EnvironmentId,
  type IssueDetail,
  type ProjectId,
} from "@t3tools/contracts";
import { formatComposerContextReference } from "@t3tools/shared/composerContextReferences";
import { issueContextBody } from "@t3tools/shared/issueContext";
import { AsyncResult } from "effect/reactivity";
import { useRef, useState } from "react";

import * as Dialog from "../../components/ui/Dialog";
import { uuidv4 } from "../../lib/uuid";
import { useEnvironmentScope } from "../../state/session";
import {
  createNewTaskDraft,
  getComposerDraftSnapshot,
  insertComposerDraftContext,
  setComposerDraftText,
  waitForComposerDraftsLoaded,
} from "../../state/use-composer-drafts";
import { useOpenWorkspaceDetail } from "../layout/useOpenWorkspaceDetail";
import { issueComposerContext } from "./issueComposerContext";

/** Opens a new thread draft for the project with the issue attached; nothing is sent until the user does. */
export function useStartIssueThread(target: {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
}) {
  const canStart = useEnvironmentScope(target.environmentId, AuthOrchestrationOperateScope);
  const openDetail = useOpenWorkspaceDetail();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const start = async (issue: IssueDetail) => {
    if (!canStart || pending.current) return;
    pending.current = true;
    setBusy(true);
    const result = await settlePromise(async () => {
      await waitForComposerDraftsLoaded();
      const draftKey = createNewTaskDraft(target);
      const context = issueComposerContext({ ...issue, body: issueContextBody(issue) }, uuidv4());
      const { text } = getComposerDraftSnapshot(draftKey);
      if (
        !insertComposerDraftContext(
          draftKey,
          {
            text: `${formatComposerContextReference(context)} `,
            context: { version: 1, records: [context] },
          },
          { text, start: text.length, end: text.length },
        )
      )
        throw new Error("Remove some context from this thread's draft, then try again.");
      setComposerDraftText(
        draftKey,
        `${getComposerDraftSnapshot(draftKey).text.trimEnd()}\n\nWork on this issue.`,
      );
      openDetail({
        name: "Thread",
        params: { draft: { draftId: draftKey, title: `Issue #${issue.number}` } },
      });
    });
    pending.current = false;
    setBusy(false);
    if (AsyncResult.isFailure(result)) {
      const cause = squashAtomCommandFailure(result);
      Dialog.alert("Couldn't open a thread", cause instanceof Error ? cause.message : "Try again.");
    }
  };
  return { canStart, busy, start };
}
