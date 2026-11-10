import { ListFilterIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "./ui/button";
import { Menu, MenuPopup, MenuTrigger } from "./ui/menu";
import { RefreshIcon } from "./ui/refresh-icon";

/** The Pull requests page's "Filters" button; the submenus come in as children. */
export function ListFiltersMenu({ count, children }: { count: number; children: ReactNode }) {
  return (
    <Menu>
      <MenuTrigger render={<Button variant="outline" />}>
        <ListFilterIcon className="size-4" />
        <span>Filters</span>
        {count > 0 ? (
          <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
            {count}
          </span>
        ) : null}
      </MenuTrigger>
      <MenuPopup align="end" side="bottom">
        {children}
      </MenuPopup>
    </Menu>
  );
}

export function ListRefreshButton({
  label,
  refreshing,
  onRefresh,
}: {
  label: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <Button
      size="icon"
      variant="outline"
      aria-label={label}
      onClick={onRefresh}
      disabled={refreshing}
    >
      <RefreshIcon size="md" refreshing={refreshing} />
    </Button>
  );
}
