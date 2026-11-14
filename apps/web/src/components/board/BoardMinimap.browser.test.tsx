import "~/index.css";

import { useState } from "react";
import { describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { render } from "../../../test/render";
import { BoardMinimap } from "./BoardMinimap";

// The scroller carries the same snap classes as the board's.
function Harness() {
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  return (
    <div style={{ width: 900 }}>
      <BoardMinimap scroller={scroller} />
      <div
        ref={setScroller}
        data-testid="scroller"
        className="relative flex snap-x gap-3 overflow-x-auto p-3"
        style={{ width: 600 }}
      >
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            aria-label={`column ${index}`}
            className="h-20 w-72 shrink-0 snap-start"
          />
        ))}
      </div>
    </div>
  );
}

describe("BoardMinimap", () => {
  it("scrolls the board to where the outline is dragged, without snapping to a column", async () => {
    await page.viewport(1024, 768);
    await using screen = await render(<Harness />, { router: false });
    const minimap = screen.getByTestId("board-minimap");
    await expect.element(minimap).toBeVisible();
    const scroller = screen.container.querySelector<HTMLElement>('[data-testid="scroller"]')!;
    const { width, height } = minimap.element().getBoundingClientRect();

    // Releasing may snap the board to a column, so read the position as each drag step lands.
    const landed: number[] = [];
    const scrollTo = scroller.scrollTo.bind(scroller);
    scroller.scrollTo = ((options: ScrollToOptions) => {
      scrollTo(options);
      landed.push(scroller.scrollLeft);
    }) as typeof scroller.scrollTo;

    await userEvent.dragAndDrop(minimap, minimap, {
      sourcePosition: { x: width * 0.2, y: height / 2 },
      targetPosition: { x: width * 0.55, y: height / 2 },
    });

    const expected = 0.55 * scroller.scrollWidth - scroller.clientWidth / 2;
    // Within a few minimap pixels (its border shifts the drop point), far from the column edge at 612.
    expect(Math.abs(landed.at(-1)! - expected)).toBeLessThan((3 * scroller.scrollWidth) / width);
  });
});
