"use client";

import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";

type UseFixedSizeVirtualListOptions = {
  count: number;
  itemSize: number;
  overscan?: number;
  scrollRef: RefObject<HTMLElement | null>;
};

export function useFixedSizeVirtualList({
  count,
  itemSize,
  overscan = 6,
  scrollRef
}: UseFixedSizeVirtualListOptions) {
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const syncViewport = () => {
      setViewportHeight(container.clientHeight);
      setScrollTop(container.scrollTop);
    };

    syncViewport();

    let frame = 0;
    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setScrollTop(container.scrollTop);
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", syncViewport);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", syncViewport);
    };
  }, [scrollRef]);

  const totalSize = count * itemSize;
  const visibleCount = viewportHeight > 0 ? Math.ceil(viewportHeight / itemSize) : 0;
  const baseStart = Math.floor(scrollTop / itemSize);
  const startIndex = Math.max(0, baseStart - overscan);
  const endIndex = Math.min(count - 1, baseStart + visibleCount + overscan);

  const virtualItems = useMemo(() => {
    if (count === 0 || endIndex < startIndex) return [] as { index: number; start: number; key: number }[];
    const items: { index: number; start: number; key: number }[] = [];
    for (let index = startIndex; index <= endIndex; index += 1) {
      items.push({
        index,
        start: index * itemSize,
        key: index
      });
    }
    return items;
  }, [count, endIndex, itemSize, startIndex]);

  const scrollToIndex = useCallback((index: number) => {
    if (index < 0 || index >= count) return;
    const container = scrollRef.current;
    if (!container) return;

    const itemTop = index * itemSize;
    const itemBottom = itemTop + itemSize;
    const viewportTop = container.scrollTop;
    const viewportBottom = viewportTop + container.clientHeight;

    if (itemTop < viewportTop) {
      container.scrollTo({ top: itemTop });
      return;
    }
    if (itemBottom > viewportBottom) {
      container.scrollTo({ top: itemBottom - container.clientHeight });
    }
  }, [count, itemSize, scrollRef]);

  return {
    totalSize,
    virtualItems,
    scrollToIndex
  };
}
