import type { EnvironmentId, ProjectId, ScopedThreadRef } from "@t3tools/contracts";
import { useState } from "react";

import { useCommitsTabStore } from "~/commitsTabStore";
import { useRightPanelStore } from "~/rightPanelStore";

import { BranchList, BranchSummary, useBranchOverview, type BranchFilters } from "./BranchesPage";

/** The thread's project branches, searchable and filterable in one right-panel tab. */
export function ThreadBranchesPanel({
  threadRef,
  environmentId,
  projectId,
  projectName,
  workspaceRoot,
}: {
  threadRef: ScopedThreadRef;
  environmentId: EnvironmentId;
  projectId: ProjectId;
  projectName: string;
  workspaceRoot: string;
}) {
  const [filters, setFilters] = useState<BranchFilters>({});
  const overview = useBranchOverview({ environmentId, workspaceRoot }, filters.remote);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b p-3">
        <h2 className="text-sm font-semibold">Branches</h2>
        <BranchSummary data={overview.data} />
      </header>
      <BranchList
        project={{ environmentId, id: projectId, title: projectName, workspaceRoot }}
        overview={overview}
        filters={filters}
        onFilters={(patch) => setFilters((current) => ({ ...current, ...patch }))}
        onOpenCommits={(ref) => {
          useCommitsTabStore
            .getState()
            .setFocus({ projectKey: `${environmentId}:${projectId}`, ref });
          useRightPanelStore.getState().open(threadRef, "commits");
        }}
      />
    </div>
  );
}
