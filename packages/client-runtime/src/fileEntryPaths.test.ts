import { describe, expect, it } from "vite-plus/test";

import {
  canMoveInto,
  entryName,
  entryNameError,
  entryParent,
  joinEntryPath,
} from "./fileEntryPaths.ts";

describe("fileEntryPaths", () => {
  it("splits and joins paths with the root as an empty parent", () => {
    expect(entryParent("a/b/c.ts")).toBe("a/b");
    expect(entryParent("c.ts")).toBe("");
    expect(entryName("a/b/c.ts")).toBe("c.ts");
    expect(joinEntryPath("", "c.ts")).toBe("c.ts");
    expect(joinEntryPath("a", "c.ts")).toBe("a/c.ts");
  });

  it("rejects unusable names and case-insensitive collisions", () => {
    expect(entryNameError(" ", [])).not.toBeNull();
    expect(entryNameError("..", [])).not.toBeNull();
    expect(entryNameError("a/b", [])).not.toBeNull();
    expect(entryNameError("Readme.md", ["README.md"])).toContain("already exists");
    expect(entryNameError("notes.md", ["README.md"])).toBeNull();
  });

  it("does not move a folder into itself", () => {
    expect(canMoveInto({ path: "a", kind: "directory" }, "a/b")).toBe(false);
    expect(canMoveInto({ path: "a", kind: "directory" }, "ab")).toBe(true);
    expect(canMoveInto({ path: "a/f.ts", kind: "file" }, "a")).toBe(true);
  });
});
