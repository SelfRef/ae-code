import { useState } from "react";
import { AuthSourceControlWriteScope, type VcsStatusResult } from "@t3tools/contracts";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import {
  type GitActionRequestInput,
  resolveShipAction,
  type ShipAction,
} from "@t3tools/client-runtime/state/vcs";

import { useThreadListActions } from "../../home/useThreadListActions";
import { useWorkspaceBackNavigation } from "../../layout/workspace/useAndroidWorkspaceNavigation";
import { useEnvironmentScope } from "../../../state/session";
import { useQuickMergeAction } from "./useQuickMergeAction";
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
  readonly onRunAction: (input: GitActionRequestInput) => Promise<unknown>;
}): ShipButton | null {
  const enabled = useShipButtonEnabled();
  const quickMergeAction = useQuickMergeAction();
  const { settleThread } = useThreadListActions();
  const goBack = useWorkspaceBackNavigation("threads");
  const [settling, setSettling] = useState(false);
  const canWriteSourceControl = useEnvironmentScope(
    input.thread?.environmentId ?? null,
    AuthSourceControlWriteScope,
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
    loading: input.busy || settling,
    disabled: input.busy || settling || (kind !== "settle" && !canWriteSourceControl),
    onPress: () => {
      if (kind === "settle") {
        setSettling(true);
        void settleThread(thread)
          .then((settled) => {
            if (settled) goBack();
          })
          .finally(() => setSettling(false));
      } else void input.onRunAction({ action: kind === "merge" ? mergeAction : "commit" });
    },
  };
}
