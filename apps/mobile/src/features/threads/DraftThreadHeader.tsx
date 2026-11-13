import { uuidv4 } from "../../lib/uuid";
import * as Dialog from "../../components/ui/Dialog";
import { useNavigation } from "@react-navigation/native";
import { AsyncResult } from "effect/reactivity";
import * as Cause from "effect/Cause";
import {
  AuthFilesystemReadScope,
  AuthSourceControlWriteScope,
  AuthTerminalOperateScope,
  AuthTerminalReadScope,
} from "@t3tools/contracts";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import { useEnvironmentQuery } from "../../state/query";
import { useEnvironmentScope } from "../../state/session";
import { useAtomCommand } from "../../state/use-atom-command";
import { vcsActionManager, vcsEnvironment } from "../../state/vcs";
import { useVcsActionState } from "../../state/use-vcs-action-state";
import { useKnownTerminalSessions } from "../../state/use-terminal-session";
import { buildTerminalMenuSessions, nextOpenTerminalId } from "../terminal/terminalMenu";
import { ThreadHeader } from "./ThreadHeader";

export function DraftThreadHeader(props: {
  readonly thread: EnvironmentThreadShell;
  readonly project: EnvironmentProject;
  readonly cwd: string | null;
}) {
  const navigation = useNavigation();
  const environmentId = props.thread.environmentId;
  const canReadFiles = useEnvironmentScope(environmentId, AuthFilesystemReadScope);
  const canWriteGit = useEnvironmentScope(environmentId, AuthSourceControlWriteScope);
  const canReadTerminal = useEnvironmentScope(environmentId, AuthTerminalReadScope);
  const canOperateTerminal = useEnvironmentScope(environmentId, AuthTerminalOperateScope);
  const { sessions: knownTerminalSessions } = useKnownTerminalSessions({
    environmentId,
    threadId: props.thread.id,
  });
  const terminalSessions = buildTerminalMenuSessions({
    knownSessions: knownTerminalSessions ?? [],
    workspaceRoot: props.cwd,
  });
  // The draft has no saved thread: the terminal route takes its workspace from here.
  const openTerminal = (terminalId?: string | null) => {
    if (!props.cwd) return;
    navigation.navigate("ThreadTerminal", {
      environmentId: String(environmentId),
      threadId: String(props.thread.id),
      draftCwd: props.cwd,
      draftTitle: props.project.title,
      ...(terminalId ? { terminalId } : {}),
    });
  };
  const status = useEnvironmentQuery(
    props.cwd ? vcsEnvironment.status({ environmentId, input: { cwd: props.cwd } }) : null,
  );
  const target = { environmentId, cwd: props.cwd };
  const progress = useVcsActionState(target);
  const runAction = useAtomCommand(vcsActionManager.runStackedAction(target), {
    reportFailure: false,
  });
  const pull = useAtomCommand(vcsEnvironment.pull, { reportFailure: false });
  const openFiles = () => {
    if (!props.cwd || !canReadFiles) return;
    navigation.navigate("NewTaskFiles", {
      environmentId,
      cwd: props.cwd,
      projectName: props.project.title,
    });
  };
  const requiresThread = () =>
    Dialog.alert("Available after the first message", "This action needs a saved thread.");
  return (
    <ThreadHeader
      draft
      title="New thread"
      subtitle=""
      hasThreadCwd={props.cwd !== null}
      inspectorMode={null}
      onOpenFilesInspector={openFiles}
      gitControls={{
        environmentId,
        threadId: props.thread.id,
        hasThread: false,
        currentBranch: props.thread.branch,
        gitStatus: status.data,
        gitOperationLabel: progress.currentLabel,
        canOpenTerminal: props.cwd !== null && (canReadTerminal || canOperateTerminal),
        canOperateTerminal,
        canOpenFiles: canReadFiles && props.cwd !== null,
        projectScripts: [],
        terminalSessions,
        onOpenFilesInspector: openFiles,
        onOpenGitInspector: requiresThread,
        onOpenTerminal: openTerminal,
        onOpenNewTerminal: () =>
          openTerminal(
            nextOpenTerminalId({
              listedTerminalIds: terminalSessions.map((session) => session.terminalId),
              ...(knownTerminalSessions === null || !canReadTerminal
                ? { uniqueSuffix: uuidv4() }
                : {}),
            }),
          ),
        onRunProjectScript: async () => {
          requiresThread();
        },
        onPull: async () => {
          if (!canWriteGit || !props.cwd) return;
          const result = await pull({ environmentId, input: { cwd: props.cwd } });
          if (AsyncResult.isFailure(result))
            Dialog.alert("Could not pull", String(Cause.squash(result.cause)));
        },
        onRunAction: async (input) => {
          if (!canWriteGit || !props.cwd) return null;
          const result = await runAction({
            ...input,
            projectId: props.project.id,
            actionId: uuidv4(),
          });
          if (AsyncResult.isFailure(result)) {
            Dialog.alert("Git action failed", String(Cause.squash(result.cause)));
            return null;
          }
          return result.value;
        },
      }}
    />
  );
}
