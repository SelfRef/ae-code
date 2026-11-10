import { EnvironmentId, type ProjectEntry } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { render } from "../../../test/render";
import { EntryDestinationDialog } from "./FileEntryDialogs";

const entries: readonly ProjectEntry[] = [
  { path: "a", kind: "directory" },
  { path: "a/inner", kind: "directory" },
  { path: "a/note.md", kind: "file" },
  { path: "dist", kind: "directory", ignored: true },
];

vi.mock("./useDirectoryEntries", () => ({
  useDirectoryEntries: () => ({
    entries,
    load: () => Promise.resolve(),
    error: null,
    loadingDirectories: new Set(),
  }),
}));

describe("EntryDestinationDialog", () => {
  it("hides ignored folders and copies into the chosen folder", async () => {
    const onSubmit = vi.fn().mockResolvedValue(null);
    await using _screen = await render(
      <EntryDestinationDialog
        environmentId={EnvironmentId.make("env-files")}
        cwd="/repo"
        rootLabel="repo"
        mode="copy"
        source={{ path: "top.md", kind: "file" }}
        onSubmit={onSubmit}
        onClose={() => {}}
      />,
    );
    // Copying beside the original would collide, so the starting folder is not a destination.
    await expect.element(page.getByRole("button", { name: "Copy here" })).toBeDisabled();
    await expect.element(page.getByRole("button", { name: "dist" })).not.toBeInTheDocument();
    await userEvent.click(page.getByRole("button", { name: "a", exact: true }));
    (page.getByRole("button", { name: "Copy here" }).element() as HTMLElement).click();
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith("a/top.md"));
  });
});
