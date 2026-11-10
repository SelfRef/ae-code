/**
 * Which skills a Claude instance loads, when the user chose "only the library's". `undefined`: no
 * filter, Claude loads everything it discovers. Process-wide for the reason `memoryPolicy` is: the
 * session builds its options synchronously. SkillLibraryService publishes it at server start and
 * after every change to the library or its links.
 */
let source: (instanceId: string) => ReadonlyArray<string> | undefined = () => undefined;

export const setClaudeSkillAllowlistSource = (
  next: (instanceId: string) => ReadonlyArray<string> | undefined,
): void => {
  source = next;
};

export const claudeSkillAllowlist = (instanceId: string): ReadonlyArray<string> | undefined =>
  source(instanceId);
