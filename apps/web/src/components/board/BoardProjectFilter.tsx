import { projectKey } from "@t3tools/client-runtime/issue-projects";
import { pickableProjectGroups } from "@t3tools/client-runtime/state/project-grouping";
import { ChevronDownIcon, LayersIcon } from "lucide-react";
import { useState } from "react";

import { useSidebarProjectGroups } from "~/hooks/useSidebarProjectGroups";

import { ProjectFavicon } from "../ProjectFavicon";
import { Button } from "../ui/button";
import {
  Menu,
  MenuCheckboxItem,
  MenuItem,
  MenuPopup,
  MenuSearchInput,
  MenuSeparator,
  MenuTrigger,
} from "../ui/menu";

/** Picks which projects the board shows. `selected` holds project keys; empty means every project. */
export function BoardProjectFilter(props: {
  readonly selected: ReadonlyArray<string>;
  readonly onChange: (keys: string[]) => void;
}) {
  const { selected, onChange } = props;
  const [query, setQuery] = useState("");
  const groups = pickableProjectGroups(useSidebarProjectGroups()).filter(
    (group) => !group.isScratch,
  );
  const chosen = new Set(selected);
  const keysOf = (group: (typeof groups)[number]) => group.memberProjects.map(projectKey);
  const picked = groups.filter((group) => keysOf(group).some((key) => chosen.has(key)));
  const lowered = query.toLowerCase();
  const visible = groups.filter((group) => group.displayName.toLowerCase().includes(lowered));
  const [only] = picked;
  const label =
    picked.length === 0
      ? "All projects"
      : picked.length === 1 && only
        ? only.displayName
        : `${picked.length} projects`;

  return (
    <Menu onOpenChange={(open) => open || setQuery("")}>
      <MenuTrigger
        aria-label={`Projects: ${label}`}
        render={<Button variant="outline" />}
        className="min-w-0"
      >
        {picked.length === 1 && only ? (
          <ProjectFavicon project={only} className="size-3.5" />
        ) : (
          <LayersIcon aria-hidden className="size-3.5" />
        )}
        <span className="truncate">{label}</span>
        <ChevronDownIcon aria-hidden className="size-3 shrink-0 text-muted-foreground/70" />
      </MenuTrigger>
      <MenuPopup align="end" side="bottom" className="w-72">
        <MenuSearchInput
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search projects"
          aria-label="Search projects"
        />
        <MenuCheckboxItem checked={picked.length === 0} onCheckedChange={() => onChange([])}>
          <span className="flex min-w-0 items-center gap-2">
            <LayersIcon aria-hidden className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">All projects</span>
          </span>
        </MenuCheckboxItem>
        <MenuSeparator />
        {visible.map((group) => {
          const keys = keysOf(group);
          return (
            <MenuCheckboxItem
              key={group.projectKey}
              checked={picked.includes(group)}
              onCheckedChange={(next) =>
                onChange(
                  next
                    ? [...new Set([...selected, ...keys])]
                    : selected.filter((key) => !keys.includes(key)),
                )
              }
            >
              <span className="flex min-w-0 items-center gap-2">
                <ProjectFavicon project={group} className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{group.displayName}</span>
              </span>
            </MenuCheckboxItem>
          );
        })}
        {visible.length === 0 ? <MenuItem disabled>No matching projects</MenuItem> : null}
      </MenuPopup>
    </Menu>
  );
}
