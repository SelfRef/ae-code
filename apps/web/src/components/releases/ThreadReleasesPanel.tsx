import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { ArrowLeftIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "../ui/button";
import { RefreshIcon } from "../ui/refresh-icon";
import { ReleaseDetailPane } from "./ReleaseDetailPane";
import { ReleaseListPage } from "./ReleasesPage";

/** The thread's project releases, list and detail in one right-panel tab. */
export function ThreadReleasesPanel({
  environmentId,
  projectId,
  workspaceRoot,
}: {
  environmentId: EnvironmentId;
  projectId: ProjectId;
  workspaceRoot: string;
}) {
  const [pages, setPages] = useState(1);
  const [refreshToken, setRefreshToken] = useState(0);
  const [id, setId] = useState<number | undefined>();

  if (id !== undefined) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b p-2">
          <Button size="compact" variant="ghost-muted" onClick={() => setId(undefined)}>
            <ArrowLeftIcon /> Releases
          </Button>
        </div>
        <ReleaseDetailPane
          key={`${id}:${refreshToken}`}
          environmentId={environmentId}
          projectId={projectId}
          workspaceRoot={workspaceRoot}
          id={id}
        />
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b p-3">
        <h2 className="text-sm font-semibold">Releases</h2>
        <Button
          size="icon-sm"
          variant="ghost-muted"
          aria-label="Refresh"
          className="ms-auto"
          onClick={() => {
            setPages(1);
            setRefreshToken((token) => token + 1);
          }}
        >
          <RefreshIcon className="size-3.5" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {Array.from({ length: pages }, (_, index) => (
          <ReleaseListPage
            key={`${refreshToken}:${index + 1}`}
            environmentId={environmentId}
            projectId={projectId}
            page={index + 1}
            selectedId={undefined}
            isLast={index + 1 === pages}
            onSelect={setId}
            onMore={() => setPages((current) => current + 1)}
          />
        ))}
      </div>
    </div>
  );
}
