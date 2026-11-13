import { ComposerContextId, type ReviewCommentContextRecord } from "@t3tools/contracts";
import { issueContextFields, type IssueContextInput } from "@t3tools/shared/issueContext";

/** An issue as a composer chip: the same words as on the web, from `issueContextFields`. */
export function issueComposerContext(
  issue: IssueContextInput,
  id: string,
): ReviewCommentContextRecord {
  return {
    version: 1,
    kind: "review-comment",
    contextId: ComposerContextId.make(id),
    label: `#${issue.number}`,
    ...issueContextFields(issue),
    startIndex: 0,
    endIndex: 0,
    diff: "",
  };
}
