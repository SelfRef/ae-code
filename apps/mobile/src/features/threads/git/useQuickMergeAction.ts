import { DEFAULT_SERVER_SETTINGS, type QuickMergeAction } from "@t3tools/contracts";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";

import { useEnvironmentServerConfig } from "../../../state/entities";
import { useThreadSelection } from "../../../state/use-thread-selection";

/** The selected thread's project setting for its main Git action. */
export function useQuickMergeAction(): QuickMergeAction {
  const { selectedThread } = useThreadSelection();
  const serverConfig = useEnvironmentServerConfig(selectedThread?.environmentId ?? null);
  return resolveProjectSettings(
    serverConfig?.settings ?? DEFAULT_SERVER_SETTINGS,
    selectedThread?.projectId ?? null,
  ).settings.quickMergeAction;
}
