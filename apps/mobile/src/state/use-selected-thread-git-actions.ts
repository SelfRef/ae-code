import { useAtomMount } from "@effect/atom-react";

import { EnvironmentProject, EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import type { AtomCommandResult } from "@t3tools/client-runtime/state/runtime";
import {
  createVcsStatusRevalidationAtomFamily,
  mergeByAgentPrompt,
  type GitActionRequestInput,
  type VcsActionOperation,
  type VcsRef,
} from "@t3tools/client-runtime/state/vcs";
import {
  AuthOrchestrationOperateScope,
  AuthSourceControlWriteScope,
  EnvironmentAuthorizationError,
  MessageId,
  type GitRunStackedActionResult,
} from "@t3tools/contracts";
import {
  dedupeRemoteBranchesWithLocalMatches,
  sanitizeFeatureBranchName,
} from "@t3tools/shared/git";
import * as Cause from "effect/Cause";
import { AsyncResult } from "effect/reactivity";

import * as Dialog from "../components/ui/Dialog";
import { useBranches } from "./queries";
import { threadEnvironment } from "./threads";
import { vcsActionManager, vcsEnvironment } from "./vcs";
import { uuidv4 } from "../lib/uuid";
import { appAtomRegistry } from "./atom-registry";
import { readEnvironmentScope, useEnvironmentScope } from "./session";
import {
  environmentConnectedAtom,
  setPendingConnectionError,
} from "./use-remote-environment-registry";
import { useAtomCommand } from "./use-atom-command";
import { showGitActionResult } from "./use-vcs-action-state";
import { useThreadSelection } from "./use-thread-selection";
import { useSelectedThreadWorktree } from "./use-selected-thread-worktree";

function refreshFailureMessage(cause: Cause.Cause<unknown>): string {
  const error = Cause.squash(cause);
  return error instanceof Error ? error.message : "Failed to refresh git status.";
}

// Selecting a thread or reconnecting its environment refreshes the checkout's
// status once, shared by every sheet that shows it.
const selectedThreadStatusRevalidation = createVcsStatusRevalidationAtomFamily({
  refreshStatus: vcsEnvironment.refreshStatus,
  connected: environmentConnectedAtom,
  onRefreshed: (result) =>
    setPendingConnectionError(
      AsyncResult.isFailure(result) ? refreshFailureMessage(result.cause) : null,
    ),
});

export function useSelectedThreadGitActions() {
  const updateThreadMetadata = useAtomCommand(threadEnvironment.updateMetadata, {
    reportFailure: false,
  });
  const readRefs = useAtomCommand(vcsEnvironment.readRefs, { reportFailure: false });
  const refreshStatus = useAtomCommand(vcsEnvironment.refreshStatus, { reportFailure: false });
  const switchRef = useAtomCommand(vcsEnvironment.switchRef, { reportFailure: false });
  const createRef = useAtomCommand(vcsEnvironment.createRef, { reportFailure: false });
  const createWorktree = useAtomCommand(vcsEnvironment.createWorktree, { reportFailure: false });
  const pull = useAtomCommand(vcsEnvironment.pull, { reportFailure: false });
  const readForcePushPreview = useAtomCommand(vcsEnvironment.forcePushPreview, {
    reportFailure: false,
  });
  const forcePush = useAtomCommand(vcsEnvironment.forcePush, { reportFailure: false });
  const startTurn = useAtomCommand(threadEnvironment.startTurn, { reportFailure: false });
  const stopSession = useAtomCommand(threadEnvironment.stopSession, { reportFailure: false });
  const { selectedThread, selectedThreadProject } = useThreadSelection();
  const canWriteSourceControl = useEnvironmentScope(
    selectedThread?.environmentId ?? null,
    AuthSourceControlWriteScope,
  );
  const canOperateThread = useEnvironmentScope(
    selectedThread?.environmentId ?? null,
    AuthOrchestrationOperateScope,
  );
  const canChangeThreadBranch = canWriteSourceControl && canOperateThread;
  const { selectedThreadCwd, selectedThreadWorktreePath } = useSelectedThreadWorktree();
  const runStackedAction = useAtomCommand(
    vcsActionManager.runStackedAction({
      environmentId: selectedThread?.environmentId ?? null,
      cwd: selectedThreadCwd,
    }),
    { reportFailure: false },
  );

  const selectedThreadGitRootCwd = selectedThreadProject?.workspaceRoot ?? null;
  const branchTarget = {
    environmentId: selectedThread?.environmentId ?? null,
    cwd: selectedThreadGitRootCwd,
    query: null,
  };
  const branchState = useBranches(branchTarget);
  const updateThreadGitContext = async (
    thread: NonNullable<typeof selectedThread>,
    nextState: {
      readonly branch?: string | null;
      readonly worktreePath?: string | null;
    },
  ) => {
    if (!readEnvironmentScope(thread.environmentId, AuthOrchestrationOperateScope)) {
      return AsyncResult.failure<never, EnvironmentAuthorizationError>(
        Cause.fail(
          new EnvironmentAuthorizationError({
            requiredScope: AuthOrchestrationOperateScope,
            message: "This connection cannot update the thread's branch.",
          }),
        ),
      );
    }
    return updateThreadMetadata({
      environmentId: thread.environmentId,
      input: {
        threadId: thread.id,
        ...(nextState.branch !== undefined ? { branch: nextState.branch } : {}),
        ...(nextState.worktreePath !== undefined ? { worktreePath: nextState.worktreePath } : {}),
      },
    });
  };

  const refreshSelectedThreadGitStatus = async (options?: {
    readonly quiet?: boolean;
    readonly cwd?: string | null;
  }) => {
    if (!selectedThread || !selectedThreadProject) {
      return null;
    }

    const cwd = options?.cwd ?? selectedThreadCwd;
    if (!cwd) {
      return null;
    }

    const target = { environmentId: selectedThread.environmentId, cwd };
    const execute = () =>
      refreshStatus({
        environmentId: selectedThread.environmentId,
        input: { cwd },
      });
    const result = options?.quiet
      ? await execute()
      : await vcsActionManager.track(
          appAtomRegistry,
          target,
          {
            operation: "refresh_status",
            label: "Refreshing source control status",
          },
          execute,
        );
    if (AsyncResult.isFailure(result)) {
      setPendingConnectionError(refreshFailureMessage(result.cause));
      return null;
    }
    setPendingConnectionError(null);
    return result.value;
  };

  useAtomMount(
    selectedThreadStatusRevalidation(
      selectedThread && selectedThreadProject && selectedThreadCwd
        ? { environmentId: selectedThread.environmentId, cwd: selectedThreadCwd }
        : null,
    ),
  );

  const runSelectedThreadGitMutation = async <T, E>(
    operation: VcsActionOperation,
    label: string,
    execute: (input: {
      readonly thread: EnvironmentThreadShell;
      readonly project: EnvironmentProject;
      readonly cwd: string;
    }) => Promise<AtomCommandResult<T, E>>,
    options?: {
      readonly managedExternally?: boolean;
      readonly changesThreadBranch?: boolean;
      /** Replaces the error toast. */
      readonly onError?: (message: string) => void;
    },
  ): Promise<T | null> => {
    if (
      !selectedThread ||
      !selectedThreadProject ||
      !selectedThreadCwd ||
      !readEnvironmentScope(selectedThread.environmentId, AuthSourceControlWriteScope) ||
      (options?.changesThreadBranch === true &&
        !readEnvironmentScope(selectedThread.environmentId, AuthOrchestrationOperateScope))
    ) {
      return null;
    }

    const target = {
      environmentId: selectedThread.environmentId,
      cwd: selectedThreadCwd,
    };
    setPendingConnectionError(null);
    const run = () =>
      execute({
        thread: selectedThread,
        project: selectedThreadProject,
        cwd: selectedThreadCwd,
      });
    const result =
      options?.managedExternally === true
        ? await run()
        : await vcsActionManager.track(appAtomRegistry, target, { operation, label }, run);
    if (AsyncResult.isFailure(result)) {
      const error = Cause.squash(result.cause);
      const message = error instanceof Error ? error.message : "Git action failed.";
      setPendingConnectionError(message);
      if (options?.onError) options.onError(message);
      else showGitActionResult({ type: "error", title: "Git action failed", description: message });
      return null;
    }
    return result.value;
  };

  const refreshSelectedThreadBranches = async (): Promise<ReadonlyArray<VcsRef> | null> => {
    if (branchTarget.environmentId === null || branchTarget.cwd === null) return null;
    const result = await readRefs({
      environmentId: branchTarget.environmentId,
      input: { cwd: branchTarget.cwd, limit: 100, refresh: true },
    });
    if (AsyncResult.isFailure(result)) {
      const error = Cause.squash(result.cause);
      const message = error instanceof Error ? error.message : "Failed to refresh branches.";
      setPendingConnectionError(message);
      showGitActionResult({ type: "error", title: "Git action failed", description: message });
      return null;
    }
    setPendingConnectionError(null);
    return dedupeRemoteBranchesWithLocalMatches(result.value.refs).filter(
      (branch) => !branch.isRemote,
    );
  };

  const syncSelectedThreadBranchState = async (input: {
    readonly thread: EnvironmentThreadShell;
    readonly cwd: string;
    readonly nextThreadState?: {
      readonly branch?: string | null;
      readonly worktreePath?: string | null;
    };
  }): Promise<AtomCommandResult<void, unknown>> => {
    // Git already changed; refresh even if metadata updates fail so the sheet shows the current branch.
    const updateResult = input.nextThreadState
      ? await updateThreadGitContext(input.thread, input.nextThreadState)
      : AsyncResult.success(undefined);
    branchState.refresh();
    await refreshSelectedThreadGitStatus({ quiet: true, cwd: input.cwd });
    return AsyncResult.isFailure(updateResult)
      ? AsyncResult.failure(updateResult.cause)
      : AsyncResult.success(undefined);
  };

  const onCheckoutSelectedThreadBranch = async (branch: string) => {
    return runSelectedThreadGitMutation(
      "switch_ref",
      "Switching branch",
      async ({ thread, cwd }) => {
        const result = await switchRef({
          environmentId: thread.environmentId,
          input: { cwd, refName: branch },
        });
        if (AsyncResult.isFailure(result)) {
          return result;
        }
        const syncResult = await syncSelectedThreadBranchState({
          thread,
          cwd,
          nextThreadState: {
            branch: result.value.refName ?? thread.branch,
            worktreePath: selectedThreadWorktreePath,
          },
        });
        return AsyncResult.isFailure(syncResult) ? AsyncResult.failure(syncResult.cause) : result;
      },
      { changesThreadBranch: true },
    );
  };

  // A branch checked out in another worktree is not switched to: the thread moves into that checkout.
  const onUseSelectedThreadWorktree = async (target: {
    readonly branch: string;
    readonly worktreePath: string;
  }) => {
    const thread = selectedThread;
    if (!thread || !canChangeThreadBranch) return null;
    const root = selectedThreadProject?.workspaceRoot.replace(/\/+$/, "") ?? null;
    const path = target.worktreePath.replace(/\/+$/, "");
    // The project's own checkout is the thread's default, not a worktree path.
    const nextWorktreePath =
      root !== null && (root === path || root.startsWith(`${path}/`)) ? null : target.worktreePath;
    setPendingConnectionError(null);
    if (thread.runtime !== null && nextWorktreePath !== selectedThreadWorktreePath) {
      await stopSession({ environmentId: thread.environmentId, input: { threadId: thread.id } });
    }
    const syncResult = await syncSelectedThreadBranchState({
      thread,
      cwd: target.worktreePath,
      nextThreadState: { branch: target.branch, worktreePath: nextWorktreePath },
    });
    if (AsyncResult.isFailure(syncResult)) {
      const error = Cause.squash(syncResult.cause);
      showGitActionResult({
        type: "error",
        title: "Git action failed",
        description: error instanceof Error ? error.message : "Failed to switch worktree.",
      });
      return null;
    }
    return target;
  };

  const onCreateSelectedThreadBranch = async (branch: string) => {
    return runSelectedThreadGitMutation(
      "create_ref",
      "Creating branch",
      async ({ thread, cwd }) => {
        const result = await createRef({
          environmentId: thread.environmentId,
          input: { cwd, refName: branch, switchRef: true },
        });
        if (AsyncResult.isFailure(result)) {
          return result;
        }
        const syncResult = await syncSelectedThreadBranchState({
          thread,
          cwd,
          nextThreadState: {
            branch: result.value.refName ?? thread.branch,
            worktreePath: selectedThreadWorktreePath,
          },
        });
        return AsyncResult.isFailure(syncResult) ? AsyncResult.failure(syncResult.cause) : result;
      },
      { changesThreadBranch: true },
    );
  };

  const onCreateSelectedThreadWorktree = async (nextWorktree: {
    readonly baseBranch: string;
    readonly newBranch: string;
  }) => {
    return runSelectedThreadGitMutation(
      "create_worktree",
      "Creating worktree",
      async ({ thread, project }) => {
        const result = await createWorktree({
          environmentId: thread.environmentId,
          input: {
            cwd: project.workspaceRoot,
            refName: nextWorktree.baseBranch,
            newRefName: sanitizeFeatureBranchName(nextWorktree.newBranch),
            path: null,
          },
        });
        if (AsyncResult.isFailure(result)) {
          return result;
        }
        const syncResult = await syncSelectedThreadBranchState({
          thread,
          cwd: result.value.worktree.path,
          nextThreadState: {
            branch: result.value.worktree.refName,
            worktreePath: result.value.worktree.path,
          },
        });
        return AsyncResult.isFailure(syncResult) ? AsyncResult.failure(syncResult.cause) : result;
      },
      { changesThreadBranch: true },
    );
  };

  const onPullSelectedThreadBranch = async () => {
    await runSelectedThreadGitMutation(
      "pull",
      "Pulling latest changes",
      async ({ thread, cwd }) => {
        const result = await pull({
          environmentId: thread.environmentId,
          input: { cwd },
        });
        if (AsyncResult.isFailure(result)) {
          return result;
        }
        await refreshSelectedThreadGitStatus({ quiet: true, cwd });
        showGitActionResult({
          type: "success",
          title:
            result.value.status === "skipped_up_to_date"
              ? "Already up to date"
              : `Pulled latest on ${result.value.refName}`,
        });
        return result;
      },
    );
  };

  const onRunSelectedThreadGitAction = async (
    input: GitActionRequestInput,
  ): Promise<GitRunStackedActionResult | null> => {
    const actionId = uuidv4();
    const isMergeAction = input.action === "merge" || input.action === "merge_push";
    const offerMergeByAgent = (message: string) => {
      const thread = selectedThread;
      if (!thread || !canOperateThread) {
        showGitActionResult({ type: "error", title: "Merge failed", description: message });
        return;
      }
      Dialog.confirm({
        title: "Merge failed",
        message,
        confirmText: "Merge by agent",
        onConfirm: () => {
          void startTurn({
            environmentId: thread.environmentId,
            input: {
              threadId: thread.id,
              message: {
                messageId: MessageId.make(uuidv4()),
                role: "user",
                text: mergeByAgentPrompt({ push: input.action === "merge_push", error: message }),
                attachments: [],
              },
              runtimeMode: thread.runtimeMode,
              interactionMode: "default",
              createdAt: new Date().toISOString(),
            },
          });
        },
      });
    };
    return await runSelectedThreadGitMutation(
      "run_change_request",
      "Running source control action",
      async ({ thread, cwd }) => {
        const result = await runStackedAction({
          actionId,
          action: input.action,
          ...(input.commitMessage ? { commitMessage: input.commitMessage } : {}),
          ...(input.featureBranch ? { featureBranch: input.featureBranch } : {}),
          ...(input.filePaths?.length ? { filePaths: [...input.filePaths] } : {}),
          threadId: thread.id,
        });
        if (AsyncResult.isFailure(result)) {
          return result;
        }

        if (result.value.branch.status === "created" && result.value.branch.name) {
          const syncResult = await syncSelectedThreadBranchState({
            thread,
            cwd,
            nextThreadState: {
              branch: result.value.branch.name,
              worktreePath: selectedThreadWorktreePath,
            },
          });
          if (AsyncResult.isFailure(syncResult)) {
            return AsyncResult.failure(syncResult.cause);
          }
        } else {
          await refreshSelectedThreadGitStatus({ quiet: true, cwd });
        }
        showGitActionResult({
          type: "success",
          title: result.value.toast.title,
          description: result.value.toast.description,
          prUrl: result.value.toast.cta.kind === "open_pr" ? result.value.toast.cta.url : undefined,
        });
        return result;
      },
      {
        managedExternally: true,
        changesThreadBranch: input.featureBranch === true,
        ...(isMergeAction ? { onError: offerMergeByAgent } : {}),
      },
    );
  };

  const onForcePushSelectedThreadBranch = async () => {
    if (!selectedThread || !selectedThreadCwd) return;
    // Ask before tracking, so the progress overlay is not up behind the dialog.
    const preview = await readForcePushPreview({
      environmentId: selectedThread.environmentId,
      input: { cwd: selectedThreadCwd },
    });
    if (AsyncResult.isFailure(preview)) {
      const error = Cause.squash(preview.cause);
      showGitActionResult({
        type: "error",
        title: "Force push unavailable",
        description: error instanceof Error ? error.message : "An error occurred.",
      });
      return;
    }
    const { value } = preview;
    const list = (title: string, commits: typeof value.localCommits, total: number) =>
      [
        `${title} (${total}):`,
        ...commits.slice(0, 5).map((commit) => `${commit.sha.slice(0, 7)} ${commit.subject}`),
        ...(total > 5 ? [`and ${total - 5} more`] : []),
      ].join("\n");
    const confirmed = await new Promise<boolean>((resolve) => {
      Dialog.confirm({
        title: `Force push ${value.refName}?`,
        message: [
          `Your branch and ${value.upstreamRef} have diverged. Pushing replaces ${value.upstreamRef} with your local commits and deletes the remote-only ones from it.`,
          list(
            `Deleted from ${value.upstreamRef}`,
            value.upstreamCommits,
            value.upstreamCommitCount,
          ),
          list(`Pushed to ${value.upstreamRef}`, value.localCommits, value.localCommitCount),
        ].join("\n\n"),
        confirmText: "Force push",
        destructive: true,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
    if (!confirmed) return;
    await runSelectedThreadGitMutation("force_push", "Force pushing", async ({ thread, cwd }) => {
      const result = await forcePush({
        environmentId: thread.environmentId,
        input: { cwd, expectedUpstreamSha: value.upstreamSha },
      });
      if (AsyncResult.isFailure(result)) return result;
      await refreshSelectedThreadGitStatus({ quiet: true, cwd });
      showGitActionResult({
        type: "success",
        title: "Force pushed",
        description: `Replaced ${result.value.upstreamRef} (${result.value.previousSha.slice(0, 7)}) with ${result.value.refName} (${result.value.newSha.slice(0, 7)}).`,
      });
      return result;
    });
  };

  return {
    canWriteSourceControl,
    canChangeThreadBranch,
    refreshSelectedThreadGitStatus,
    refreshSelectedThreadBranches,
    onCheckoutSelectedThreadBranch,
    onUseSelectedThreadWorktree,
    onCreateSelectedThreadBranch,
    onCreateSelectedThreadWorktree,
    onPullSelectedThreadBranch,
    onRunSelectedThreadGitAction,
    onForcePushSelectedThreadBranch,
  };
}
