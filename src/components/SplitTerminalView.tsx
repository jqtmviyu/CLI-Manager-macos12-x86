import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { useTerminalStore } from "../stores/terminalStore";
import type { TerminalPaneLeaf, TerminalPaneNode, TerminalPaneSplit } from "../stores/terminalPaneTree";

interface Props {
  node: TerminalPaneNode;
  renderLeaf: (leaf: TerminalPaneLeaf) => ReactNode;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface LeafLayout {
  leaf: TerminalPaneLeaf;
  rect: Rect;
}

interface DividerLayout {
  split: TerminalPaneSplit;
  rect: Rect;
  splitRect: Rect;
}

interface SplitLayout {
  leaves: LeafLayout[];
  dividers: DividerLayout[];
}

const DIVIDER_SIZE = 4;

function clampSize(value: number): number {
  return Math.max(0, value);
}

function buildSplitLayout(node: TerminalPaneNode, rect: Rect): SplitLayout {
  if (node.type === "leaf") {
    return { leaves: [{ leaf: node, rect }], dividers: [] };
  }

  const isHorizontal = node.direction === "horizontal";
  const totalLength = isHorizontal ? rect.width : rect.height;
  const firstLength = clampSize(totalLength * node.ratio - DIVIDER_SIZE / 2);
  const secondLength = clampSize(totalLength - firstLength - DIVIDER_SIZE);

  const firstRect: Rect = isHorizontal
    ? { left: rect.left, top: rect.top, width: firstLength, height: rect.height }
    : { left: rect.left, top: rect.top, width: rect.width, height: firstLength };
  const dividerRect: Rect = isHorizontal
    ? { left: rect.left + firstLength, top: rect.top, width: DIVIDER_SIZE, height: rect.height }
    : { left: rect.left, top: rect.top + firstLength, width: rect.width, height: DIVIDER_SIZE };
  const secondRect: Rect = isHorizontal
    ? { left: dividerRect.left + DIVIDER_SIZE, top: rect.top, width: secondLength, height: rect.height }
    : { left: rect.left, top: dividerRect.top + DIVIDER_SIZE, width: rect.width, height: secondLength };

  const firstLayout = buildSplitLayout(node.first, firstRect);
  const secondLayout = buildSplitLayout(node.second, secondRect);

  return {
    leaves: [...firstLayout.leaves, ...secondLayout.leaves],
    dividers: [{ split: node, rect: dividerRect, splitRect: rect }, ...firstLayout.dividers, ...secondLayout.dividers],
  };
}

function rectStyle(rect: Rect): CSSProperties {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export function SplitTerminalView({ node, renderLeaf }: Props) {
  const setSplitRatio = useTerminalStore((s) => s.setSplitRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerRect, setContainerRect] = useState<Rect>({ left: 0, top: 0, width: 0, height: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateContainerRect = (width: number, height: number) => {
      setContainerRect((current) => {
        if (current.width === width && current.height === height) return current;
        return { left: 0, top: 0, width, height };
      });
    };

    const initialRect = container.getBoundingClientRect();
    updateContainerRect(initialRect.width, initialRect.height);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      updateContainerRect(entry.contentRect.width, entry.contentRect.height);
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const layout = useMemo(() => buildSplitLayout(node, containerRect), [containerRect, node]);

  const handleDragStart = useCallback(
    (split: TerminalPaneSplit, splitRect: Rect, e: MouseEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rootRect = container.getBoundingClientRect();
      const isHorizontal = split.direction === "horizontal";
      let latestRatio = split.ratio;
      let rafId: number | null = null;

      const flush = () => {
        rafId = null;
        setSplitRatio(split.id, latestRatio);
      };

      const onMove = (ev: globalThis.MouseEvent) => {
        latestRatio = isHorizontal
          ? (ev.clientX - rootRect.left - splitRect.left) / splitRect.width
          : (ev.clientY - rootRect.top - splitRect.top) / splitRect.height;
        if (rafId === null) rafId = requestAnimationFrame(flush);
      };

      const onUp = () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        setSplitRatio(split.id, latestRatio);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = isHorizontal ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [setSplitRatio]
  );

  return (
    <div ref={containerRef} className="ui-terminal-split-node relative h-full min-h-0 w-full min-w-0 overflow-hidden">
      {layout.leaves.map(({ leaf, rect }) => (
        <div key={leaf.id} className="ui-terminal-split-child absolute min-h-0 min-w-0 overflow-hidden" style={rectStyle(rect)}>
          {renderLeaf(leaf)}
        </div>
      ))}
      {layout.dividers.map(({ split, rect, splitRect }) => {
        const isHorizontal = split.direction === "horizontal";
        return (
          <div
            key={split.id}
            onMouseDown={(event) => handleDragStart(split, splitRect, event)}
            className="ui-terminal-split-divider absolute shrink-0 transition-colors"
            style={{
              ...rectStyle(rect),
              cursor: isHorizontal ? "col-resize" : "row-resize",
              zIndex: 10,
            }}
          />
        );
      })}
    </div>
  );
}
