import type {
  ServerProvider,
  SkillLibrarySkill,
  SkillLibrarySource,
  SkillLibraryTarget,
} from "@t3tools/contracts";

/** A new skill: the frontmatter every provider needs and a place for the instructions. */
export function skillTemplate(id: string, description: string): string {
  const single = description.replace(/\s+/g, " ").trim();
  return `---\nname: ${id}\ndescription: ${JSON.stringify(single)}\n---\n\n# ${id}\n\n`;
}

/** Lowercase letters, digits and single hyphens, as the Agent Skills specification asks. */
export function isValidSkillName(name: string): boolean {
  return name.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name);
}

export function filterSkills(
  skills: ReadonlyArray<SkillLibrarySkill>,
  query: string,
): ReadonlyArray<SkillLibrarySkill> {
  const terms = query.toLowerCase().split(/\s+/u).filter(Boolean);
  return skills.filter((skill) => {
    const haystack = `${skill.id} ${skill.name} ${skill.description ?? ""}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

/** `owner/repo`, the folder inside it when there is one, and the commit it was taken at. */
export function skillSourceLabel(source: SkillLibrarySource): string {
  const place = source.path === "" ? source.source : `${source.source} · ${source.path}`;
  return `${place} @ ${source.commit.slice(0, 7)}`;
}

export function targetLabel(
  target: SkillLibraryTarget,
  providers: ReadonlyArray<Pick<ServerProvider, "instanceId" | "displayName">>,
): string {
  return (
    providers.find((provider) => provider.instanceId === target.instanceId)?.displayName ??
    target.displayName
  );
}

export interface ProviderOwnSkills {
  readonly instanceId: string;
  readonly displayName: string;
  readonly skills: ReadonlyArray<{
    readonly name: string;
    readonly path: string;
    readonly scope: string | undefined;
  }>;
}

/**
 * What providers load from their own folders: plugin, built-in and synced skills, and ones
 * made by hand. A skill that came through the library, by name or path, is not repeated here.
 */
export function providerOwnSkills(
  providers: ReadonlyArray<
    Pick<ServerProvider, "instanceId" | "displayName" | "enabled" | "skills">
  >,
  library: { readonly libraryPath: string; readonly skills: ReadonlyArray<SkillLibrarySkill> },
): ReadonlyArray<ProviderOwnSkills> {
  const managed = new Set(library.skills.flatMap((skill) => [skill.id, skill.name]));
  const result: ProviderOwnSkills[] = [];
  for (const provider of providers) {
    if (!provider.enabled) continue;
    const seen = new Set<string>();
    const skills = provider.skills.flatMap((skill) => {
      if (managed.has(skill.name) || skill.path.startsWith(library.libraryPath)) return [];
      if (seen.has(skill.name)) return [];
      seen.add(skill.name);
      return [{ name: skill.name, path: skill.path, scope: skill.scope }];
    });
    if (skills.length > 0) {
      result.push({
        instanceId: provider.instanceId,
        displayName: provider.displayName ?? provider.instanceId,
        skills: skills.toSorted((a, b) => a.name.localeCompare(b.name)),
      });
    }
  }
  return result;
}
