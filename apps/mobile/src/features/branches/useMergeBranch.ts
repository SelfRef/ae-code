import { canMergeBranch } from "@t3tools/client-runtime/branch-overview";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { AuthSourceControlWriteScope, type VcsBranchOverviewEntry } from "@t3tools/contracts";

import * as Dialog from "../../components/ui/Dialog";
import { uuidv4 } from "../../lib/uuid";
import { useEnvironmentScope } from "../../state/session";
import { useAtomCommand } from "../../state/use-atom-command";
import { vcsActionManager } from "../../state/vcs";

/** Merges a worktree branch into the default branch after confirming; undefined when it cannot be. */
export function useMergeBranch(
  project: Pick<EnvironmentProject, "environmentId" | "id">,
  branch: VcsBranchOverviewEntry,
  defaultRef: string | null,
  onDone: () => void,
) {
  const canWrite = useEnvironmentScope(project.environmentId, AuthSourceControlWriteScope);
  const run = useAtomCommand(
    vcsActionManager.runStackedAction({
      environmentId: project.environmentId,
      cwd: branch.worktreePath,
    }),
    { reportFailure: false },
  );
  if (!canWrite || !canMergeBranch(branch)) return undefined;
  const target = defaultRef ?? "the default branch";
  return () =>
    Dialog.confirm({
      title: `Merge ${branch.name} into ${target}?`,
      message: `Uncommitted changes in its worktree are committed first. ${target} is fast-forwarded, and the branch is rebased onto it if it moved. Nothing is pushed.`,
      confirmText: "Merge",
      onConfirm: () => {
        void (async () => {
          const result = await run({
            actionId: uuidv4(),
            action: "merge",
            projectId: project.id,
          });
          if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
            const cause = squashAtomCommandFailure(result);
            Dialog.alert("Could not merge", cause instanceof Error ? cause.message : "Try again.");
          }
          onDone();
        })();
      },
    });
}
