import {
  isIssueContextSection,
  issueContextFields,
  type IssueContextInput,
} from "@t3tools/shared/issueContext";

import type { ReviewCommentContext } from "~/reviewCommentContext";

export { issueContextBody } from "@t3tools/shared/issueContext";

export function isIssueContext(comment: { readonly sectionId: string }): boolean {
  return isIssueContextSection(comment.sectionId);
}

/** An issue as a composer chip. The id carries the URL because numbers repeat across repositories. */
export function buildIssueContext(issue: IssueContextInput): ReviewCommentContext {
  return {
    ...issueContextFields(issue),
    id: `issue-context:${issue.url}`,
    startIndex: 0,
    endIndex: 0,
    diff: "",
  };
}
