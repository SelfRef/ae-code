import { StrictMode } from "react";
import { EnvironmentId, ThreadId, type ScopedThreadRef } from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { act, render } from "../../../test/render";
import { selectThreadPanelOpen, useRightPanelStore } from "../../rightPanelStore";
import { PopoverCreateHandle } from "../ui/popover";
import { ChatCanvasContext } from "./ChatCanvasContext";
import { resolveChatCanvasLayout } from "./chatCanvasLayout";
import { ThreadDetailsCard } from "./ThreadDetailsCard";

const threadA: ScopedThreadRef = {
  environmentId: EnvironmentId.make("environment"),
  threadId: ThreadId.make("thread-a"),
};
const threadB: ScopedThreadRef = {
  environmentId: EnvironmentId.make("environment"),
  threadId: ThreadId.make("thread-b"),
};
const container = { width: 1200, height: 800 };
const placement = { x: 868, y: 0, right: 12, width: 320, height: 400 } as const;

function setup() {
  useRightPanelStore.setState({ threadPanelVisibilityByThreadKey: {} });
  const anchor = document.createElement("div");
  document.body.append(anchor);
  return {
    anchor: { current: anchor },
    handle: PopoverCreateHandle(),
    [Symbol.dispose]: () => anchor.remove(),
  };
}

const popoverOpen = (threadRef: ScopedThreadRef) =>
  selectThreadPanelOpen(
    useRightPanelStore.getState().threadPanelVisibilityByThreadKey,
    threadRef,
    "popover",
  );

function Card({
  threadRef,
  inline,
  fixture,
  rows = 1,
  automationRows = 0,
  serverOverflowRows = 0,
  secondaryHeight = 0,
}: {
  threadRef: ScopedThreadRef;
  inline: boolean;
  fixture: ReturnType<typeof setup>;
  /** Rows of 100px shown at full density. Compact always takes 50px. */
  rows?: number;
  /** Rows of 100px in an automations list shown at full density. */
  automationRows?: number;
  /** Rows of 100px that expanded server lists add, which density ignores. */
  serverOverflowRows?: number;
  /** Pixel height of a second card under the first; 0 renders none. */
  secondaryHeight?: number;
}) {
  return (
    // The web root renders in StrictMode, which re-runs ref callbacks on every mount.
    <StrictMode>
      <ChatCanvasContext
        value={{
          container,
          lane: { padding: 48, minChatWidth: 640 },
          layout: resolveChatCanvasLayout({ container, preview: null }),
          previewKey: null,
          registerTimeline: () => {},
          measureDetailsCard: () => {},
          detailsCardTopInset: 0,
          preferredDetailsCard: placement,
          detailsCardPlacement: inline ? placement : null,
        }}
      >
        <ThreadDetailsCard
          threadRef={threadRef}
          anchor={fixture.anchor}
          handle={fixture.handle}
          contentKey={String(rows)}
          renderSecondary={() =>
            secondaryHeight > 0 ? (
              <div data-testid="secondary" style={{ height: secondaryHeight }} />
            ) : null
          }
        >
          {(density) => (
            <>
              <p style={{ height: density === "full" ? rows * 100 : 50 }}>
                Details for {threadRef.threadId}
              </p>
              {density === "full" && automationRows > 0 ? (
                <section data-thread-automations-panel style={{ height: automationRows * 100 }} />
              ) : null}
              {density === "full" && serverOverflowRows > 0 ? (
                <div
                  data-thread-details-server-overflow
                  style={{ height: serverOverflowRows * 100 }}
                />
              ) : null}
            </>
          )}
        </ThreadDetailsCard>
      </ChatCanvasContext>
    </StrictMode>
  );
}

it("stays open once opened", async () => {
  using fixture = setup();
  await using _screen = await render(<Card threadRef={threadB} inline={false} fixture={fixture} />);
  await act(() => useRightPanelStore.getState().setThreadPanelOpen(threadB, "popover", true));
  await expect.element(page.getByText("Details for thread-b")).toBeVisible();
  expect(popoverOpen(threadB)).toBe(true);
});

it("closes a popup left open when the card switches inline, and reopens from the flag", async () => {
  using fixture = setup();
  await using screen = await render(<Card threadRef={threadB} inline={false} fixture={fixture} />);
  const setOpen = (open: boolean) =>
    act(() => useRightPanelStore.getState().setThreadPanelOpen(threadB, "popover", open));
  await setOpen(true);
  await expect.element(page.getByText("Details for thread-b")).toBeVisible();

  useRightPanelStore.getState().setThreadPanelOpen(threadB, "inline", false);
  await screen.rerender(<Card threadRef={threadB} inline fixture={fixture} />);
  await expect.element(page.getByText("Details for thread-b")).not.toBeInTheDocument();
  await setOpen(false);

  await screen.rerender(<Card threadRef={threadB} inline={false} fixture={fixture} />);
  await expect.element(page.getByText("Details for thread-b")).not.toBeInTheDocument();
  await setOpen(true);
  await expect.element(page.getByText("Details for thread-b")).toBeVisible();
});

it("does not reopen the popover when the card returns from inline mode", async () => {
  using fixture = setup();
  await using screen = await render(<Card threadRef={threadB} inline={false} fixture={fixture} />);
  await act(() => useRightPanelStore.getState().setThreadPanelOpen(threadB, "popover", true));
  await expect.element(page.getByText("Details for thread-b")).toBeVisible();

  useRightPanelStore.getState().setThreadPanelOpen(threadB, "inline", false);
  await screen.rerender(<Card threadRef={threadB} inline fixture={fixture} />);
  await expect.element(page.getByText("Details for thread-b")).not.toBeInTheDocument();

  await screen.rerender(<Card threadRef={threadB} inline={false} fixture={fixture} />);
  await expect.element(page.getByText("Details for thread-b")).not.toBeInTheDocument();
  expect(popoverOpen(threadB)).toBe(false);
});

it("removes the leaving thread's popup on a thread switch", async () => {
  using fixture = setup();
  await using screen = await render(<Card threadRef={threadB} inline={false} fixture={fixture} />);
  await act(() => useRightPanelStore.getState().setThreadPanelOpen(threadB, "popover", true));
  await expect.element(page.getByText("Details for thread-b")).toBeVisible();

  await screen.rerender(<Card threadRef={threadA} inline={false} fixture={fixture} />);
  await expect.element(page.getByText("Details for thread-b")).not.toBeInTheDocument();
  await expect.element(page.getByText("Details for thread-a")).not.toBeInTheDocument();
});

it("reopens after a normal close", async () => {
  using fixture = setup();
  await using _screen = await render(<Card threadRef={threadB} inline={false} fixture={fixture} />);
  const setOpen = (open: boolean) =>
    act(() => useRightPanelStore.getState().setThreadPanelOpen(threadB, "popover", open));
  await setOpen(true);
  await expect.element(page.getByText("Details for thread-b")).toBeVisible();
  await setOpen(false);
  await expect.element(page.getByText("Details for thread-b")).not.toBeInTheDocument();
  await setOpen(true);
  await expect.element(page.getByText("Details for thread-b")).toBeVisible();
});

it("returns to full density when hidden items make the content fit", async () => {
  using fixture = setup();
  await using screen = await render(<Card threadRef={threadB} inline fixture={fixture} rows={6} />);
  const card = page.getByRole("region", { name: "Thread details" });
  await expect.element(card).toHaveAttribute("data-density", "compact");

  await screen.rerender(<Card threadRef={threadB} inline fixture={fixture} rows={2} />);
  await expect.element(card).toHaveAttribute("data-density", "full");
});

it("keeps full density when many automations make the content tall", async () => {
  using fixture = setup();
  await using _screen = await render(
    <Card threadRef={threadB} inline fixture={fixture} rows={2} automationRows={6} />,
  );
  await expect.element(page.getByText("Details for thread-b")).toBeVisible();
  await expect
    .element(page.getByRole("region", { name: "Thread details" }))
    .toHaveAttribute("data-density", "full");
});

it("stays full while expanded server rows overflow", async () => {
  using fixture = setup();
  await using _screen = await render(
    <Card threadRef={threadB} inline fixture={fixture} rows={2} serverOverflowRows={4} />,
  );
  await expect
    .element(page.getByRole("region", { name: "Thread details" }))
    .toHaveAttribute("data-density", "full");
});

it("leaves room for a second card under the first", async () => {
  using fixture = setup();
  await using screen = await render(<Card threadRef={threadB} inline fixture={fixture} rows={3} />);
  const card = page.getByRole("region", { name: "Thread details" });
  await expect.element(card).toHaveAttribute("data-density", "full");

  await screen.rerender(
    <Card threadRef={threadB} inline fixture={fixture} rows={3} secondaryHeight={150} />,
  );
  await expect.element(card).toHaveAttribute("data-density", "compact");
  const secondary = page.getByTestId("secondary").element().getBoundingClientRect();
  const first = page.getByText("Details for thread-b").element().getBoundingClientRect();
  expect(secondary.top).toBeGreaterThanOrEqual(first.bottom);
});
