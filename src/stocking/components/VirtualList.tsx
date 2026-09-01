'use client';

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface Props<T> {
  items: T[];
  /** Fixed pixel height of every row. */
  rowHeight: number;
  renderRow: (item: T, index: number) => ReactNode;
  /** Extra rows rendered above/below the viewport to hide scroll seams. */
  overscan?: number;
  /** Space reserved below the last row (clears the fixed bottom nav). */
  footerPad?: number;
  getKey: (item: T, index: number) => string;
  className?: string;
}

/**
 * Windowed list — only the rows in (or near) the viewport are in the DOM, so a
 * 5,000-item catalogue scrolls as cheaply as a 20-item one. Rows must be a
 * fixed height; the product list keeps each row to two single-line rows and
 * edits in a sheet so that holds.
 */
export default function VirtualList<T>({
  items,
  rowHeight,
  renderRow,
  overscan = 6,
  footerPad = 0,
  getKey,
  className,
}: Props<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setViewportH(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const start = Math.max(
    0,
    Math.floor(scrollTop / rowHeight) - overscan,
  );
  const end = Math.min(
    items.length,
    Math.ceil((scrollTop + viewportH) / rowHeight) + overscan,
  );
  const slice = items.slice(start, end);

  return (
    <div
      ref={ref}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className={className}
      style={{ overflowY: 'auto', overflowX: 'hidden' }}
    >
      <div
        style={{
          height: items.length * rowHeight + footerPad,
          position: 'relative',
        }}
      >
        <div style={{ transform: `translateY(${start * rowHeight}px)` }}>
          {slice.map((item, i) => (
            <div key={getKey(item, start + i)} style={{ height: rowHeight }}>
              {renderRow(item, start + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
