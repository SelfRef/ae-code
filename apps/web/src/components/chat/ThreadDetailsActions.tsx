import { useAtomValue } from "@effect/atom-react";
import { AuthOrchestrationOperateScope, type ScopedThreadRef } from "@t3tools/contracts";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import { ChevronDownIcon, CircleCheckIcon } from "lucide-react";

import { useThreadActionMenu } from "../../hooks/useThreadActionMenu";
import { useThreadActions } from "../../hooks/useThreadActions";
import { cn } from "../../lib/utils";
import { settleAndAdvance } from "../../settleAndAdvance";
import { useQuietThreadShell } from "../../state/entities";
import { useEnvironmentQuery } from "../../state/query";
import { useEnvironmentScope } from "../../state/session";
import { vcsEnvironment } from "../../state/vcs";
import { requestThreadRename } from "../../threadRename";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { canShareWithGuestAtom } from "./guestShareAvailability";
import { ThreadDetailsControl } from "./ThreadDetailsControl";
import { hasUnmergedChanges } from "./threadDetailsActions.logic";
import {
  THREAD_DETAILS_PANEL_CHEVRON_CLASS,
  THREAD_DETAILS_PANEL_ICON_CLASS,
  THREAD_DETAILS_PANEL_LABEL_CLASS,
  THREAD_DETAILS_PANEL_SPLIT_GROUP_CLASS,
  THREAD_DETAILS_PANEL_SPLIT_SEPARATOR_CLASS,
} from "./threadDetailsPanelStyles";

function toastFailure(title: string, result: AtomCommandResult<unknown, unknown>) {
  if (result._tag !== "Failure" || isAtomCommandInterrupted(result)) return;
  const error = squashAtomCommandFailure(result);
  toastManager.add(
    stackedThreadToast({
      type: "error",
      title,
      description: error instanceof Error ? error.message : "An error occurred.",
    }),
  );
}

/**
 * Settles the thread once its changes are in the default branch, and says so until then; the arrow
 * opens the same menu as right-clicking the thread, with Settle first while the button cannot.
 */
export function ThreadDetailsActions(props: {
  readonly threadRef: ScopedThreadRef;
  readonly gitCwd: string | null;
  readonly projectCwd: string | null;
  readonly onFindInThread: ((threadRef: ScopedThreadRef) => void) | undefined;
}) {
  const { threadRef } = props;
  const thread = useQuietThreadShell(threadRef);
  const canOperate = useEnvironmentScope(threadRef.environmentId, AuthOrchestrationOperateScope);
  const canShareWithGuest = useAtomValue(canShareWithGuestAtom(threadRef.environmentId));
  const { settleThread, unsettleThread } = useThreadActions();
  const settled = thread?.settledOverride === "settled";
  const gitStatus = useEnvironmentQuery(
    props.gitCwd !== null
      ? vcsEnvironment.status({
          environmentId: threadRef.environmentId,
          input: { cwd: props.gitCwd },
        })
      : null,
  ).data;
  const blocked = !settled && hasUnmergedChanges(gitStatus);
  // The current branch comes first and the default one next, so two refs always include it.
  const defaultBranchName = useEnvironmentQuery(
    props.gitCwd !== null && blocked
      ? vcsEnvironment.listRefs({
          environmentId: threadRef.environmentId,
          input: { cwd: props.gitCwd, refKind: "local", limit: 2 },
        })
      : null,
  ).data?.refs.find((ref) => ref.isDefault)?.name;
  const { openMenu } = useThreadActionMenu({
    threadRef,
    projectCwd: props.projectCwd,
    onStartRename: requestThreadRename,
    onFind: props.onFindInThread,
    canShareWithGuest,
    settlePlacement: blocked ? "first" : "hidden",
  });
  const onSettle = async () => {
    if (settled) {
      toastFailure("Failed to un-settle thread", await unsettleThread(threadRef));
    } else if (!settleAndAdvance(threadRef)) {
      toastFailure("Failed to settle thread", await settleThread(threadRef));
    }
  };

  return (
    <div
      role="group"
      aria-label="Thread actions"
      className={THREAD_DETAILS_PANEL_SPLIT_GROUP_CLASS}
    >
      <ThreadDetailsControl
        variant="ghost"
        size="xs"
        part="primary"
        panel
        disabled={!canOperate || thread === null || blocked}
        onClick={() => void onSettle()}
      >
        <CircleCheckIcon className={THREAD_DETAILS_PANEL_ICON_CLASS} aria-hidden />
        <span className={cn("not-sr-only ml-0 truncate", THREAD_DETAILS_PANEL_LABEL_CLASS)}>
          {settled
            ? "Un-settle thread"
            : blocked
              ? `Not all changes merged into ${defaultBranchName ?? "the default branch"}`
              : "Settle thread"}
        </span>
      </ThreadDetailsControl>
      <span aria-hidden="true" className={THREAD_DETAILS_PANEL_SPLIT_SEPARATOR_CLASS} />
      <ThreadDetailsControl
        aria-label="More thread actions"
        aria-haspopup="menu"
        size="sm"
        variant="ghost"
        part="secondary"
        panel
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          openMenu({ x: rect.left, y: rect.bottom + 4 });
        }}
      >
        <ChevronDownIcon aria-hidden="true" className={THREAD_DETAILS_PANEL_CHEVRON_CLASS} />
      </ThreadDetailsControl>
    </div>
  );
}
