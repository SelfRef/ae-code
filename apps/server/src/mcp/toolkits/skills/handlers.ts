import { OrchestratorMcpFailure, type SkillLibraryError } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import * as SkillLibraryService from "../../../skills/SkillLibraryService.ts";
import * as McpToolAccess from "../../McpToolAccess.ts";
import { assertFullAccess, loadCaller } from "../../threadAccess.ts";
import { SkillToolkit } from "./tools.ts";

const failure = (error: SkillLibraryError) =>
  new OrchestratorMcpFailure({
    code: error.code === "unavailable" ? "orchestration_error" : "invalid_request",
    message: error.message,
  });

// Skills are instructions every later session follows. In full access the agent can already write
// any file unasked, so a write here grants nothing more; elsewhere the user changes skills in Settings.
const requireFullAccess = Effect.gen(function* () {
  yield* assertFullAccess(
    yield* loadCaller(),
    "Changing skills needs a thread in full access, where this agent can already write any file. Ask the user to change it in Settings → Skills, or to run this thread in full access.",
  );
});

export const layer = McpToolAccess.toLayer(SkillToolkit, {
  t3_skill_list: McpToolAccess.readsAsCaller(() =>
    SkillLibraryService.SkillLibraryService.use((skills) => skills.list()).pipe(
      Effect.mapError(failure),
    ),
  ),
  t3_skill_read: McpToolAccess.readsAsCaller((input) =>
    SkillLibraryService.SkillLibraryService.use((skills) => skills.read(input)).pipe(
      Effect.mapError(failure),
    ),
  ),
  t3_skill_write: McpToolAccess.actsAsCaller((input) =>
    requireFullAccess.pipe(
      Effect.andThen(SkillLibraryService.SkillLibraryService.use((skills) => skills.write(input))),
      Effect.mapError((error) => (error._tag === "SkillLibraryError" ? failure(error) : error)),
    ),
  ),
  t3_skill_remove: McpToolAccess.actsAsCaller((input) =>
    requireFullAccess.pipe(
      Effect.andThen(SkillLibraryService.SkillLibraryService.use((skills) => skills.remove(input))),
      Effect.mapError((error) => (error._tag === "SkillLibraryError" ? failure(error) : error)),
    ),
  ),
  t3_skill_link: McpToolAccess.actsAsCaller((input) =>
    requireFullAccess.pipe(
      Effect.andThen(
        SkillLibraryService.SkillLibraryService.use((skills) => skills.setLink(input)),
      ),
      Effect.mapError((error) => (error._tag === "SkillLibraryError" ? failure(error) : error)),
    ),
  ),
});
