import { useState } from "react";
import {
  AuthOrchestrationOperateScope,
  AuthSourceControlWriteScope,
  type GitRunStackedActionResult,
  type VcsStatusResult,
} from "@t3tools/contracts";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import {
  type GitActionRequestInput,
  resolveShipAction,
  type ShipAction,
} from "@t3tools/client-runtime/state/vcs";

import { useThreadListActions } from "../../home/useThreadListActions";
import { useWorkspaceBackNavigation } from "../../layout/workspace/useAndroidWorkspaceNavigation";
import { useEnvironmentScope } from "../../../state/session";
import { useQuickMergeAction, useSettleAfterMerge } from "./useQuickMergeAction";
import { useShipButtonEnabled } from "./useShipButtonEnabled";

export interface ShipButton {
  readonly kind: ShipAction;
  readonly label: string;
  readonly disabled: boolean;
  /** The step is running: the button shows a spinner and ignores presses. */
  readonly loading: boolean;
  readonly onPress: () => void;
}

const LABELS: Record<ShipAction, string> = {
  commit: "Commit",
  merge: "Merge",
  settle: "Settle",
};

/** The floating button's next step for the thread; null when hidden by the setting, a running turn, a settled thread or nothing to do. */
export function useShipAction(input: {
  readonly thread: EnvironmentThreadShell | null;
  readonly gitStatus: VcsStatusResult | null;
  readonly hadChanges: boolean;
  readonly working: boolean;
  readonly busy: boolean;
  readonly onRunAction: (input: GitActionRequestInput) => Promise<GitRunStackedActionResult | null>;
}): ShipButton | null {
  const enabled = useShipButtonEnabled();
  const quickMergeAction = useQuickMergeAction();
  const settleAfterMerge = useSettleAfterMerge();
  const { settleThread } = useThreadListActions();
  const goBack = useWorkspaceBackNavigation("threads");
  // Covers the gap after the action's own busy state clears and before the status refresh lands.
  const [pending, setPending] = useState(false);
  const canWriteSourceControl = useEnvironmentScope(
    input.thread?.environmentId ?? null,
    AuthSourceControlWriteScope,
  );
  const canOperateThread = useEnvironmentScope(
    input.thread?.environmentId ?? null,
    AuthOrchestrationOperateScope,
  );
  const { thread, gitStatus } = input;
  const kind = resolveShipAction(gitStatus, input.hadChanges);
  if (!enabled || thread === null || kind === null || input.working) return null;
  if (thread.settledOverride === "settled") return null;

  const mergeAction =
    quickMergeAction === "merge_push" && gitStatus?.hasPrimaryRemote ? "merge_push" : "merge";
  return {
    kind,
    label: LABELS[kind],
    loading: input.busy || pending,
    disabled: input.busy || pending || (kind !== "settle" && !canWriteSourceControl),
    onPress: () => {
      if (kind === "settle") {
        setPending(true);
        void settleThread(thread)
          .then((settled) => {
            if (settled) goBack();
          })
          .finally(() => setPending(false));
      } else {
        setPending(true);
        void input
          .onRunAction({ action: kind === "merge" ? mergeAction : "commit" })
          .then((result) => {
            // The server settles the thread itself; this leaves it like the Settle step does.
            if (kind === "merge" && settleAfterMerge && canOperateThread && result?.merge) goBack();
          })
          .finally(() => setPending(false));
      }
    },
  };
}
