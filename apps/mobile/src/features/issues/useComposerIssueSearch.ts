import type { EnvironmentId, IssueSummary, ProjectId } from "@t3tools/contracts";

import { issueEnvironment } from "../../state/issues";
import { useDebouncedValue } from "../../state/queries";
import { useEnvironmentQuery } from "../../state/query";

const ISSUE_RESULT_LIMIT = 8;

/**
 * The project's issues for the composer's `#` menu. Text goes to the host's search; a number
 * matches only the 50 most recently updated issues. Hosts without issues answer an error, so none show.
 */
export function useComposerIssueSearch(input: {
  readonly environmentId: EnvironmentId | null;
  readonly projectId: ProjectId | null;
  readonly repository: string | null;
  readonly query: string | null;
}) {
  const query = useDebouncedValue(input.query, 180);
  const ready =
    query === input.query &&
    query !== null &&
    input.environmentId !== null &&
    input.projectId !== null &&
    input.repository !== null;
  const numeric = query !== null && /^\d*$/.test(query);
  const list = useEnvironmentQuery(
    ready
      ? issueEnvironment.list({
          environmentId: input.environmentId!,
          input: {
            projectId: input.projectId!,
            state: "all",
            ...(!numeric && query ? { query } : {}),
          },
        })
      : null,
  );
  const entries: ReadonlyArray<IssueSummary> = (list.data?.issues ?? [])
    .filter((issue) => !numeric || !query || String(issue.number).startsWith(query))
    .slice(0, ISSUE_RESULT_LIMIT);
  return { entries, isPending: list.isPending };
}
