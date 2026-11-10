import {
  isAtomCommandInterrupted,
  runAtomCommand,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { threadRuntimeIsActive } from "@t3tools/client-runtime/state/models";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { AuthOrchestrationOperateScope } from "@t3tools/contracts";
import * as Haptics from "expo-haptics";

import * as Dialog from "../../components/ui/Dialog";
import { appAtomRegistry } from "../../state/atom-registry";
import { environmentProjects } from "../../state/projects";
import { environmentServerConfigsAtom } from "../../state/server";
import { threadEnvironment } from "../../state/threads";
import { readEnvironmentScope } from "../../state/session";

/** An idle thread in the project checkout, on a server that can move it into a worktree. */
export function canMoveThreadToWorktree(thread: EnvironmentThreadShell): boolean {
  if (thread.worktreePath || thread.archivedAt || threadRuntimeIsActive(thread.runtime)) {
    return false;
  }
  const config = appAtomRegistry.get(environmentServerConfigsAtom).get(thread.environmentId);
  if (config?.environment.capabilities.threadMoveToWorktree !== true) return false;
  const project = appAtomRegistry.get(
    environmentProjects.projectAtom({
      environmentId: thread.environmentId,
      projectId: thread.projectId,
    }),
  );
  return project !== null && project?.isScratch !== true;
}

export async function moveThreadToWorktree(thread: EnvironmentThreadShell): Promise<boolean> {
  const title = "Could not move thread to a worktree";
  if (!readEnvironmentScope(thread.environmentId, AuthOrchestrationOperateScope)) {
    Dialog.alert(title, "This connection cannot change threads.");
    return false;
  }
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  const result = await runAtomCommand(
    appAtomRegistry,
    threadEnvironment.moveToWorktree,
    { environmentId: thread.environmentId, input: { threadId: thread.id } },
    { reportFailure: false },
  );
  if (result._tag === "Success") return true;
  if (!isAtomCommandInterrupted(result)) {
    const error = squashAtomCommandFailure(result);
    Dialog.alert(title, error instanceof Error ? error.message : "Try again.");
  }
  return false;
}
