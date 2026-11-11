import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { useState } from "react";

import { BranchList, BranchSummary, useBranchOverview, type BranchFilters } from "./BranchesPage";

/** The thread's project branches, searchable and filterable in one right-panel tab. */
export function ThreadBranchesPanel({
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
  const [filters, setFilters] = useState<BranchFilters>({});
  const overview = useBranchOverview({ environmentId, workspaceRoot }, filters.remote);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b p-3">
        <h2 className="text-sm font-semibold">Branches</h2>
        <BranchSummary data={overview.data} />
      </header>
      <BranchList
        project={{ environmentId, id: projectId, title: projectName }}
        overview={overview}
        filters={filters}
        onFilters={(patch) => setFilters((current) => ({ ...current, ...patch }))}
      />
    </div>
  );
}
