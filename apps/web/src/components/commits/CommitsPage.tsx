import { branchProjects } from "@t3tools/client-runtime/branch-overview";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { useCommitsTabStore } from "~/commitsTabStore";
import { usePageProject } from "~/hooks/usePageProject";
import { useProjects } from "~/state/entities";

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../ui/empty";
import { SidebarInset } from "../ui/sidebar";
import { ProjectPageHeader } from "../ProjectPageHeader";
import { CommitHistory } from "./CommitHistory";

/** The commit history of a project's branch, opened from the sidebar or a Branches row. */
export function CommitsPage() {
  const search = useSearch({ from: "/_chat/commits" });
  const navigate = useNavigate();
  const projects = branchProjects(useProjects());
  const project = usePageProject(projects, search);
  const view = useCommitsTabStore((state) => state.view);
  const setView = useCommitsTabStore((state) => state.setView);

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none">
      <ProjectPageHeader
        title="Commits"
        project={project}
        projects={projects}
        onProject={(next) =>
          void navigate({
            to: "/commits",
            search: { environmentId: next.environmentId, projectId: next.id },
          })
        }
      />
      {project === null ? (
        <Empty size="compact">
          <EmptyHeader>
            <EmptyTitle>No project</EmptyTitle>
            <EmptyDescription>Add a project to see its commits.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <CommitHistory
          key={`${project.environmentId}:${project.id}\n${search.ref ?? ""}`}
          project={project}
          cwd={project.workspaceRoot}
          refName={search.ref ?? null}
          view={view}
          onRef={(ref) =>
            void navigate({
              to: "/commits",
              search: { environmentId: project.environmentId, projectId: project.id, ref },
            })
          }
          onView={setView}
        />
      )}
    </SidebarInset>
  );
}
