import { ALL_VCS_REFS, type EnvironmentId } from "@t3tools/contracts";
import { ChevronDownIcon, GitBranchIcon, LayersIcon } from "lucide-react";
import { useState } from "react";

import { sanitizeNewRefName } from "../BranchToolbar.logic";
import { usePaginatedBranches } from "~/state/queries";
import { BranchPicker, BranchPickerRefItem } from "../BranchPicker";
import { Button } from "../ui/button";
import { ComboboxItem, ComboboxTrigger } from "../ui/combobox";
import { MiddleTruncate } from "../ui/middle-truncate";

/** The branch whose history is listed: any local or remote branch, or all of them. */
export function CommitRefPicker({
  environmentId,
  cwd,
  value,
  label,
  onChange,
}: {
  environmentId: EnvironmentId;
  cwd: string;
  /** The ref picked, or null for the checked-out branch. */
  value: string | null;
  /** What the trigger shows while no ref is picked. */
  label: string;
  onChange: (ref: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const branches = usePaginatedBranches({
    environmentId,
    cwd,
    query: sanitizeNewRefName(query.trim()),
  });
  const byName = new Map(branches.refs.map((ref) => [ref.name, ref]));
  const items = [...(query.trim() === "" ? [ALL_VCS_REFS] : []), ...byName.keys()];
  const hasNextPage = branches.data?.nextCursor != null;
  const select = (ref: string) => {
    onChange(ref);
    setOpen(false);
    setQuery("");
  };
  return (
    <BranchPicker
      items={items}
      filteredItems={items}
      value={value}
      query={query}
      onQueryChange={setQuery}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      onSelectItem={select}
      hasNextPage={hasNextPage}
      isFetchingNextPage={branches.isFetchingNextPage}
      onLoadNext={branches.loadNext}
      statusText={
        branches.error ?? (branches.isPending && branches.data === null ? "Loading refs..." : null)
      }
      popupProps={{ align: "start", side: "bottom", className: "flex w-80 flex-col" }}
      renderItem={(name, index) => {
        if (name === ALL_VCS_REFS) {
          return (
            <ComboboxItem hideIndicator index={index} value={name} onClick={() => select(name)}>
              <span className="flex items-center gap-2">
                <LayersIcon className="size-3.5 text-muted-foreground" />
                All branches
              </span>
            </ComboboxItem>
          );
        }
        const ref = byName.get(name);
        return ref ? (
          <BranchPickerRefItem
            branch={ref}
            projectCwd={cwd}
            index={index}
            onClick={() => select(name)}
          />
        ) : null;
      }}
    >
      <ComboboxTrigger
        render={<Button variant="outline" size="sm" aria-label="Choose branch" />}
        className="min-w-0 max-w-64 justify-between"
      >
        {value === ALL_VCS_REFS ? (
          <LayersIcon className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <MiddleTruncate
          value={value === ALL_VCS_REFS ? "All branches" : (value ?? label)}
          className="flex-1 text-left"
        />
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </ComboboxTrigger>
    </BranchPicker>
  );
}
