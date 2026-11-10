import {
  OrchestratorMcpFailure,
  SkillLibraryListResult,
  SkillLibraryReadInput,
  SkillLibraryReadResult,
  SkillLibraryRemoveInput,
  SkillLibraryRemoveResult,
  SkillLibrarySetLinkInput,
  SkillLibrarySetLinkResult,
  SkillLibraryWriteInput,
  SkillLibraryWriteResult,
} from "@t3tools/contracts";
import { Tool, Toolkit } from "effect/ai";

import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as ThreadManagementService from "../../../orchestration-v2/ThreadManagementService.ts";
import * as SkillLibraryService from "../../../skills/SkillLibraryService.ts";

const shared = {
  failure: OrchestratorMcpFailure,
  failureMode: "return" as const,
  dependencies: [
    McpInvocationContext.McpInvocationContext,
    ThreadManagementService.ThreadManagementService,
    SkillLibraryService.SkillLibraryService,
  ],
};

const SkillListTool = Tool.make("t3_skill_list", {
  ...shared,
  description:
    "List the shared skill library and, per skill, whether each provider can use it: native (reads the library), linked, missing (can be linked), blocked (name taken in its own folder) or unsupported.",
  success: SkillLibraryListResult,
})
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false);

const SkillReadTool = Tool.make("t3_skill_read", {
  ...shared,
  description: "Read one library skill's SKILL.md and the paths of its other files.",
  parameters: SkillLibraryReadInput,
  success: SkillLibraryReadResult,
})
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false);

const SkillWriteTool = Tool.make("t3_skill_write", {
  ...shared,
  description:
    "Create (mode create) or rewrite (mode replace) one library skill's SKILL.md. A new skill's id is lowercase letters, digits and single hyphens, and its frontmatter needs name (the same) and description. Needs a thread in full access. Sessions that start later load it.",
  parameters: SkillLibraryWriteInput,
  success: SkillLibraryWriteResult,
}).annotate(Tool.Destructive, true);

const SkillRemoveTool = Tool.make("t3_skill_remove", {
  ...shared,
  description:
    "Move one library skill to the trash, where the user can restore it, and remove its provider links. Needs a thread in full access.",
  parameters: SkillLibraryRemoveInput,
  success: SkillLibraryRemoveResult,
}).annotate(Tool.Destructive, true);

const SkillLinkTool = Tool.make("t3_skill_link", {
  ...shared,
  description:
    "Link a library skill into a provider's own skills folder (linked true) or take the link away. Only for providers listed as linkable by t3_skill_list. Needs a thread in full access.",
  parameters: SkillLibrarySetLinkInput,
  success: SkillLibrarySetLinkResult,
}).annotate(Tool.Destructive, false);

export const SkillToolkit = Toolkit.make(
  SkillListTool,
  SkillReadTool,
  SkillWriteTool,
  SkillRemoveTool,
  SkillLinkTool,
);
