import type { EnvironmentId, IssueListState, ProjectId } from "@t3tools/contracts";
import { ArrowLeftIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { RefreshIcon } from "../ui/refresh-icon";
import { IssueDetailPane } from "./IssueDetailPane";
import { IssueListPage, ISSUE_STATES } from "./IssuesPage";

/** The thread's project issues, list and detail in one right-panel tab. */
export function ThreadIssuesPanel({
  environmentId,
  projectId,
  workspaceRoot,
}: {
  environmentId: EnvironmentId;
  projectId: ProjectId;
  workspaceRoot: string;
}) {
  const [state, setState] = useState<IssueListState>("open");
  const [query, setQuery] = useState<string | undefined>();
  const [draft, setDraft] = useState("");
  const [pages, setPages] = useState(1);
  const [refreshToken, setRefreshToken] = useState(0);
  const [number, setNumber] = useState<number | undefined>();

  if (number !== undefined) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b p-2">
          <Button size="compact" variant="ghost-muted" onClick={() => setNumber(undefined)}>
            <ArrowLeftIcon /> Issues
          </Button>
        </div>
        <IssueDetailPane
          key={`${number}:${refreshToken}`}
          environmentId={environmentId}
          projectId={projectId}
          workspaceRoot={workspaceRoot}
          number={number}
        />
      </div>
    );
  }

  const submitQuery = (event: FormEvent) => {
    event.preventDefault();
    setPages(1);
    setQuery(draft.trim() || undefined);
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-col gap-2 border-b p-3">
        <div className="flex items-center gap-2">
          <form className="min-w-0 flex-1" onSubmit={submitQuery}>
            <Input
              size="compact"
              placeholder="Search issues"
              aria-label="Search issues"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </form>
          <Button
            size="icon-sm"
            variant="ghost-muted"
            aria-label="Refresh"
            onClick={() => {
              setPages(1);
              setRefreshToken((token) => token + 1);
            }}
          >
            <RefreshIcon className="size-3.5" />
          </Button>
        </div>
        <div className="flex gap-1" role="tablist" aria-label="State">
          {ISSUE_STATES.map((entry) => (
            <Button
              key={entry.value}
              size="compact"
              role="tab"
              aria-selected={state === entry.value}
              variant={state === entry.value ? "outline" : "ghost-muted"}
              onClick={() => {
                setPages(1);
                setState(entry.value);
              }}
            >
              {entry.label}
            </Button>
          ))}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {Array.from({ length: pages }, (_, index) => (
          <IssueListPage
            key={`${state}:${query ?? ""}:${refreshToken}:${index + 1}`}
            environmentId={environmentId}
            projectId={projectId}
            state={state}
            query={query}
            page={index + 1}
            selectedNumber={undefined}
            isLast={index + 1 === pages}
            onSelect={setNumber}
            onMore={() => setPages((current) => current + 1)}
          />
        ))}
      </div>
    </div>
  );
}
