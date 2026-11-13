import { AuthSourceControlWriteScope, type ScopedThreadRef } from "@t3tools/contracts";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { ArrowDownIcon, CheckIcon } from "lucide-react";

import { randomUUID } from "../../lib/utils";
import { useGitStackedAction } from "../../state/sourceControlActions";
import { useEnvironmentQuery } from "../../state/query";
import { useEnvironmentScope } from "../../state/session";
import { vcsEnvironment } from "../../state/vcs";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { ThreadDetailsControl } from "./ThreadDetailsControl";
import {
  THREAD_DETAILS_PANEL_ICON_CLASS,
  THREAD_DETAILS_PANEL_LABEL_CLASS,
  THREAD_DETAILS_PANEL_ROW_CONTENT_CLASS,
  THREAD_DETAILS_PANEL_STATUS_TEXT_CLASS,
} from "./threadDetailsPanelStyles";
import { useDefaultBranchName } from "./useDefaultBranchName";

const plural = (n: number) => `${n} commit${n === 1 ? "" : "s"}`;

/** Whether the current branch has the default branch's commits, and a button to rebase onto it when not. */
export function ThreadDetailsBranchSync(props: {
  readonly threadRef: ScopedThreadRef;
  readonly gitCwd: string;
}) {
  const { threadRef, gitCwd } = props;
  const canWrite = useEnvironmentScope(threadRef.environmentId, AuthSourceControlWriteScope);
  const status = useEnvironmentQuery(
    vcsEnvironment.status({ environmentId: threadRef.environmentId, input: { cwd: gitCwd } }),
  ).data;
  const rebaseBranch = useGitStackedAction({ environmentId: threadRef.environmentId, cwd: gitCwd });
  const behind = status?.behindDefaultCount;
  const shown =
    status?.isRepo === true &&
    status.refName !== null &&
    !status.isDefaultRef &&
    behind !== undefined;
  const defaultBranchName = useDefaultBranchName(threadRef.environmentId, gitCwd, shown);
  if (!shown || behind === undefined) return null;
  const base = defaultBranchName ?? "the default branch";

  if (behind === 0) {
    return (
      <div
        role="status"
        className={`flex h-8 items-center ${THREAD_DETAILS_PANEL_ROW_CONTENT_CLASS} ${THREAD_DETAILS_PANEL_STATUS_TEXT_CLASS}`}
      >
        <CheckIcon className={THREAD_DETAILS_PANEL_ICON_CLASS} aria-hidden />
        <span className={THREAD_DETAILS_PANEL_LABEL_CLASS}>Up to date with {base}</span>
      </div>
    );
  }

  const dirty = status.hasWorkingTreeChanges;
  const run = async () => {
    const result = await rebaseBranch.run({ actionId: randomUUID(), action: "rebase_default" });
    if (result._tag === "Failure") {
      if (isAtomCommandInterrupted(result)) return;
      const error = squashAtomCommandFailure(result);
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Update failed",
          description: error instanceof Error ? error.message : "An error occurred.",
          data: { threadRef },
        }),
      );
      return;
    }
    toastManager.add(
      stackedThreadToast({
        type: "success",
        title: result.value.toast.title,
        ...(result.value.toast.description ? { description: result.value.toast.description } : {}),
        data: { threadRef },
      }),
    );
  };

  return (
    <ThreadDetailsControl
      tone="warning"
      size="xs"
      variant="ghost"
      part="row"
      panel
      disabled={!canWrite || dirty}
      title={dirty ? "Commit or stash your changes first" : undefined}
      onClick={() => void run()}
    >
      <ArrowDownIcon className="size-4 shrink-0 text-warning-foreground" aria-hidden />
      <span className={`min-w-0 flex-1 truncate ${THREAD_DETAILS_PANEL_LABEL_CLASS}`}>
        <span className="font-semibold text-foreground">{plural(behind)}</span> behind {base}
      </span>
      <span className="shrink-0 rounded-md bg-warning/15 px-1.5 py-0.5 text-xs font-medium text-warning-foreground">
        Update
      </span>
    </ThreadDetailsControl>
  );
}
