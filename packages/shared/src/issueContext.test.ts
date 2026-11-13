import { describe, expect, it } from "vite-plus/test";

import { isIssueContextSection, issueContextBody, issueContextFields } from "./issueContext.ts";

describe("issue chip text", () => {
  const issue = { number: 12, title: "Crash\non  start", url: "https://github.com/o/r/issues/12" };

  it("sends the agent to the tool or the URL when the body is unknown", () => {
    const fields = issueContextFields(issue);
    expect(isIssueContextSection(fields.sectionId)).toBe(true);
    expect(fields.rangeLabel).toBe("Crash on start");
    expect(fields.text).toContain("`read_issue` tool (number 12)");
  });

  it("embeds the description and comments, fenced and untrusted, when known", () => {
    const body = issueContextBody({
      body: "Steps ``` here",
      comments: [
        { author: { login: "ann" }, body: "Me too" },
        { author: null, body: "  " },
      ],
    });
    expect(body).toBe("Steps ``` here\n\n---\n\n@ann:\nMe too");
    const { text } = issueContextFields({ ...issue, body });
    expect(text).toContain("untrusted data");
    expect(text).toContain("````markdown");
  });
});
