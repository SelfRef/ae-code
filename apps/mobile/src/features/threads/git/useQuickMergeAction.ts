import {
  DEFAULT_SERVER_SETTINGS,
  type CurrentBranchAction,
  type QuickMergeAction,
} from "@t3tools/contracts";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";

import { useEnvironmentServerConfig } from "../../../state/entities";
import { useThreadSelection } from "../../../state/use-thread-selection";

function useThreadProjectSettings() {
  const { selectedThread } = useThreadSelection();
  const serverConfig = useEnvironmentServerConfig(selectedThread?.environmentId ?? null);
  return resolveProjectSettings(
    serverConfig?.settings ?? DEFAULT_SERVER_SETTINGS,
    selectedThread?.projectId ?? null,
  ).settings;
}

/** The selected thread's project setting for its default branch action. */
export function useQuickMergeAction(): QuickMergeAction {
  return useThreadProjectSettings().quickMergeAction;
}

/** The selected thread's project setting for its current branch action. */
export function useCurrentBranchAction(): CurrentBranchAction {
  return useThreadProjectSettings().currentBranchAction;
}
