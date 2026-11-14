import { SquarePenIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";

import { useNewThreadAction } from "../../hooks/useNewThreadAction";
import { cn } from "../../lib/utils";
import { SidebarMenuButton } from "../ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { useAppNavItems } from "./useAppNavItems";

function RailButton({
  label,
  tooltip = label,
  icon,
  isActive = false,
  disabled,
  onClick,
}: {
  label: string;
  tooltip?: ReactNode;
  icon: ReactNode;
  isActive?: boolean;
  disabled?: boolean | undefined;
  onClick: (event: React.MouseEvent) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <SidebarMenuButton
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
            className="shrink-0"
            disabled={disabled}
            isActive={isActive}
            onClick={onClick}
            size="icon"
            type="button"
          >
            {icon}
          </SidebarMenuButton>
        }
      />
      <TooltipPopup side="right">{tooltip}</TooltipPopup>
    </Tooltip>
  );
}

/** Far-left bar of the sidebar toggle, New thread and the app's pages; phones use the sidebar footer instead. */
export function AppNavRail({
  toggle,
  reserveTitlebar,
}: {
  toggle: ReactNode;
  /** The macOS traffic lights fill the top row, so the controls start below it. */
  reserveTitlebar: boolean;
}) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const items = useAppNavItems();
  const newThread = useNewThreadAction();
  const renderItem = (item: (typeof items)[number]) => (
    <RailButton
      key={item.id}
      label={item.label}
      icon={item.icon}
      isActive={item.isActive(pathname)}
      onClick={item.go}
    />
  );

  return (
    <nav
      aria-label="App navigation"
      className="relative z-20 hidden w-[var(--workspace-nav-rail-width)] shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar surface-grain pb-2 text-sidebar-foreground md:flex"
    >
      <div
        className={cn(
          "flex h-[var(--workspace-topbar-height)] w-full shrink-0 items-center justify-center",
          reserveTitlebar && "drag-region",
        )}
      >
        {reserveTitlebar ? null : toggle}
      </div>
      {reserveTitlebar ? toggle : null}
      <RailButton
        label="New thread"
        tooltip={
          <span className="flex flex-col gap-0.5">
            <span>
              {newThread.shortcutLabel ? `New thread (${newThread.shortcutLabel})` : "New thread"}
            </span>
            {newThread.showInProjectHint ? (
              <span className="text-muted-foreground">
                New thread in current project: Shift+click
                {newThread.inProjectShortcutLabel ? ` (${newThread.inProjectShortcutLabel})` : ""}
              </span>
            ) : null}
          </span>
        }
        icon={<SquarePenIcon />}
        disabled={newThread.disabled}
        onClick={newThread.onNewThread}
      />
      <div className="my-1 h-px w-5 shrink-0 bg-sidebar-border" />
      {items.filter((item) => !item.bottom).map(renderItem)}
      <div className="flex-1" />
      {items
        .filter((item) => item.bottom)
        .toReversed()
        .map(renderItem)}
    </nav>
  );
}
