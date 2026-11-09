import { useAtomValue } from "@effect/atom-react";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import {
  DEFAULT_MEMORY_SETTINGS,
  type EnvironmentId,
  type MemorySetSettingsInput,
} from "@t3tools/contracts";
import { DownloadIcon } from "lucide-react";
import { useState } from "react";

import { useProjects } from "../../state/entities";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { MemoryImportDialog } from "./MemoryImportDialog";
import { SettingsRow, SettingsSection } from "./settingsLayout";

/**
 * Claude's side of Settings → Memory. The settings belong to the environment, not to one Claude
 * instance, so every Claude instance here shows the same two controls.
 */
export function ClaudeMemorySettings({ environmentId }: { readonly environmentId: EnvironmentId }) {
  const list = useEnvironmentQuery(serverEnvironment.memoryList({ environmentId, input: {} }));
  const canChange = useAtomValue(serverEnvironment.setMemorySettings.permissionAtom(environmentId));
  const canSave = useAtomValue(serverEnvironment.saveMemory.permissionAtom(environmentId));
  const canScan = useAtomValue(serverEnvironment.scanClaudeMemories.permissionAtom(environmentId));
  const canImport = canSave && canScan;
  const projects = useProjects().filter(
    (project) => project.environmentId === environmentId && project.isScratch !== true,
  );
  const setSettings = useAtomCommand(serverEnvironment.setMemorySettings, {
    label: "memory settings",
  });
  const [importOpen, setImportOpen] = useState(false);
  const settings = list.data?.settings ?? DEFAULT_MEMORY_SETTINGS;

  const changeSettings = async (input: MemorySetSettingsInput) => {
    const result = await setSettings({ environmentId, input });
    if (result._tag === "Failure") {
      if (!isAtomCommandInterrupted(result))
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: "Could not change memory settings",
            description: String(squashAtomCommandFailure(result)),
          }),
        );
      return;
    }
    list.refresh();
  };

  return (
    <SettingsSection title="Memory">
      <SettingsRow
        title="Turn off Claude's built-in memory"
        description="New Claude sessions run without Claude Code's own memory, so the shared memory is the only store. Applies while agent memory is on, to every Claude instance here."
        control={
          <Switch
            aria-label="Turn off Claude's built-in memory"
            checked={settings.disableNativeMemory && settings.enabled}
            disabled={!canChange || !settings.enabled}
            onCheckedChange={(checked) =>
              void changeSettings({ disableNativeMemory: Boolean(checked) })
            }
          />
        }
      />
      <SettingsRow
        title="Import Claude's memories"
        description="Copy what Claude Code saved on its own into the shared memory. Claude's files are not changed."
        control={
          <Button
            size="xs"
            variant="outline"
            disabled={!canImport}
            onClick={() => setImportOpen(true)}
          >
            <DownloadIcon className="size-3" aria-hidden />
            Import…
          </Button>
        }
      />
      <MemoryImportDialog
        environmentId={environmentId}
        projects={projects}
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => list.refresh()}
      />
    </SettingsSection>
  );
}
