import { projectKey } from "@t3tools/client-runtime/issue-projects";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";

import { isElectron } from "~/env";
import { ProjectSwitcher } from "./chat/BreadcrumbSwitchers";
import { ProjectFavicon } from "./ProjectFavicon";
import {
  WorkspaceBreadcrumb,
  WorkspaceBreadcrumbItem,
  WorkspaceBreadcrumbSeparator,
  WorkspaceBreadcrumbText,
} from "./WorkspaceBreadcrumb";
import { WorkspacePageHeader } from "./WorkspacePageHeader";

/**
 * The topbar of the per-project pages: the thread header's project switcher, then the page title.
 * It clears the collapsed sidebar's toggle, which floats over the top-left corner.
 */
export function ProjectPageHeader({
  title,
  project,
  projects,
  onProject,
  reserveNativeControls,
  children,
}: {
  title: string;
  project: EnvironmentProject | null;
  /** The projects the page can list; the switcher offers no others. */
  projects: ReadonlyArray<EnvironmentProject>;
  onProject: (project: EnvironmentProject) => void;
  reserveNativeControls?: boolean;
  children?: ReactNode;
}) {
  return (
    <WorkspacePageHeader
      electron={isElectron}
      {...(reserveNativeControls === undefined ? {} : { reserveNativeControls })}
      className="border-b"
    >
      <WorkspaceBreadcrumb ariaLabel={`${title} breadcrumb`} className="shrink">
        {project ? (
          <>
            <WorkspaceBreadcrumbItem className="shrink">
              <ProjectSwitcher
                activeProject={project}
                onSelectProject={onProject}
                projectFilter={(candidate) =>
                  projects.some((listed) => projectKey(listed) === projectKey(candidate))
                }
                trigger={
                  <button
                    type="button"
                    aria-label={`Switch project, current: ${project.title}`}
                    className="group/project-crumb inline-flex min-w-0 max-w-full cursor-pointer items-center gap-1.5 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  />
                }
              >
                <ProjectFavicon project={project} className="size-3.5" />
                <WorkspaceBreadcrumbText className="max-w-40">
                  {project.title}
                </WorkspaceBreadcrumbText>
                <ChevronDownIcon aria-hidden className="size-3.5 shrink-0" />
              </ProjectSwitcher>
            </WorkspaceBreadcrumbItem>
            <WorkspaceBreadcrumbSeparator>
              <WorkspaceBreadcrumbText>/</WorkspaceBreadcrumbText>
            </WorkspaceBreadcrumbSeparator>
          </>
        ) : null}
        <WorkspaceBreadcrumbItem current>
          <h1 className="truncate">{title}</h1>
        </WorkspaceBreadcrumbItem>
      </WorkspaceBreadcrumb>
      <div className="min-w-0 flex-1" />
      {children}
    </WorkspacePageHeader>
  );
}
