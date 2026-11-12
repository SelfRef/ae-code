import type { EnvironmentId, ProjectId } from "@t3tools/contracts";

import { useCommitsTabStore } from "~/commitsTabStore";

import { CommitHistory } from "./CommitHistory";

/** The branch history of the thread's workspace: its checked-out branch, or the one a Branches row picked. */
export function ThreadCommitsPanel({
  environmentId,
  projectId,
  projectName,
  workspaceRoot,
}: {
  environmentId: EnvironmentId;
  projectId: ProjectId;
  projectName: string;
  workspaceRoot: string;
}) {
  const projectKey = `${environmentId}:${projectId}`;
  const view = useCommitsTabStore((state) => state.view);
  const setView = useCommitsTabStore((state) => state.setView);
  const focus = useCommitsTabStore((state) => state.focus);
  const setFocus = useCommitsTabStore((state) => state.setFocus);
  const refName = focus?.projectKey === projectKey ? focus.ref : null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b p-3">
        <h2 className="text-sm font-semibold">Commits</h2>
      </header>
      <CommitHistory
        key={`${workspaceRoot}\n${refName ?? ""}`}
        project={{ environmentId, title: projectName }}
        cwd={workspaceRoot}
        refName={refName}
        view={view}
        onRef={(ref) => setFocus({ projectKey, ref })}
        onView={setView}
      />
    </div>
  );
}
