import { projectKey } from "@t3tools/client-runtime/issue-projects";

import { ProjectFavicon } from "../../../components/ProjectFavicon";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/models";
import { ChoiceChip } from "./ChoiceChip";

export const projectIcon = (project: EnvironmentProject, size: number) => (
  <ProjectFavicon
    environmentId={project.environmentId}
    faviconPath={project.faviconPath}
    projectIcon={project.projectIcon}
    projectTitle={project.title}
    workspaceRoot={project.workspaceRoot}
    size={size}
  />
);

/** The project picker of the Issues, Branches and Releases pages. */
export function ProjectChoiceChip(props: {
  readonly projects: ReadonlyArray<EnvironmentProject>;
  readonly project: EnvironmentProject;
  readonly onSelect: (key: string) => void;
}) {
  return (
    <ChoiceChip
      label={props.project.title}
      accessibilityLabel="Choose project"
      leading={projectIcon(props.project, 16)}
      options={props.projects.map((candidate) => ({
        value: projectKey(candidate),
        label: candidate.title,
        icon: projectIcon(candidate, 24),
      }))}
      selected={projectKey(props.project)}
      onSelect={props.onSelect}
    />
  );
}
