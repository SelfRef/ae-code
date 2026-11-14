import { observeResize } from "~/lib/observeResize";
import { useEffect, useRef, useState, type PointerEvent } from "react";

interface Block {
  readonly id: string;
  readonly left: number;
  readonly width: number;
}

const NO_BLOCKS: ReadonlyArray<Block> = [];

/**
 * A miniature of the board's columns with the visible part outlined, like Jira's board scrollbar:
 * drag the outline, or click anywhere on it, to scroll. It hides while the board fits.
 * Scrolling moves the outline straight on the element, so a scroll never re-renders React.
 */
export function BoardMinimap(props: { readonly scroller: HTMLElement | null }) {
  const { scroller } = props;
  const [blocks, setBlocks] = useState(NO_BLOCKS);
  const [scrollable, setScrollable] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- mirrors the scroller's layout and scroll position, which only the DOM knows
  useEffect(() => {
    if (!scroller) return;
    const place = () => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const { scrollLeft, scrollWidth, clientWidth } = scroller;
      viewport.style.left = `${(scrollLeft / scrollWidth) * 100}%`;
      viewport.style.width = `${(clientWidth / scrollWidth) * 100}%`;
    };
    const measure = () => {
      const { scrollWidth, clientWidth } = scroller;
      setScrollable(scrollWidth > clientWidth + 1);
      setBlocks(
        Array.from(scroller.children, (child) => ({
          id: child.getAttribute("aria-label") ?? "",
          left: ((child as HTMLElement).offsetLeft / scrollWidth) * 100,
          width: ((child as HTMLElement).offsetWidth / scrollWidth) * 100,
        })),
      );
      place();
    };
    // The board snaps to columns, which would pull every drag step back to a column edge.
    const track = trackRef.current;
    const snap = (value: "none" | "") => () => void (scroller.style.scrollSnapType = value);
    const unsnap = snap("none");
    const resnap = snap("");
    track?.addEventListener("pointerdown", unsnap);
    track?.addEventListener("pointerup", resnap);
    track?.addEventListener("pointercancel", resnap);
    const stopObserving = observeResize([scroller, ...scroller.children], measure);
    scroller.addEventListener("scroll", place, { passive: true });
    measure();
    return () => {
      stopObserving();
      track?.removeEventListener("pointerdown", unsnap);
      track?.removeEventListener("pointerup", resnap);
      track?.removeEventListener("pointercancel", resnap);
      resnap();
      scroller.removeEventListener("scroll", place);
    };
  }, [scroller]);

  const scrollTo = (event: PointerEvent<HTMLDivElement>) => {
    if (!scroller) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    scroller.scrollTo({ left: fraction * scroller.scrollWidth - scroller.clientWidth / 2 });
  };

  return (
    <div
      ref={trackRef}
      aria-hidden
      data-testid="board-minimap"
      className="relative hidden h-7 w-32 shrink-0 cursor-pointer touch-none rounded-md border bg-muted/40 [-webkit-app-region:no-drag] data-[scrollable=true]:md:block"
      data-scrollable={scrollable}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        scrollTo(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) scrollTo(event);
      }}
    >
      {blocks.map((block) => (
        <div
          key={block.id}
          className="absolute inset-y-1 rounded-sm bg-muted-foreground/25"
          style={{ left: `${block.left}%`, width: `${block.width}%` }}
        />
      ))}
      <div
        ref={viewportRef}
        className="pointer-events-none absolute inset-y-0 rounded-md border-2 border-primary/70 bg-primary/10"
      />
    </div>
  );
}
