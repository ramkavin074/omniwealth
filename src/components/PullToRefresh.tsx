'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { RefreshCw } from 'lucide-react';
import { haptic } from '@/lib/native';

const TRIGGER = 80; // px of pull needed to refresh
const MAX_PULL = 120;

// True when the touch began inside something that should keep its own
// scroll/drag behaviour: a modal/overlay (fixed), or a scroller that's
// already scrolled down.
function startedInsideOwnScroller(el: EventTarget | null): boolean {
  let node = el as HTMLElement | null;
  while (node && node !== document.body) {
    const cs = getComputedStyle(node);
    if (cs.position === 'fixed') return true;
    if (
      node.scrollTop > 0 ||
      (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight)
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * Native-only pull-down-to-refresh. Calls router.refresh() — a soft refetch
 * of the server data that keeps the app unlocked and the page state intact —
 * since the native shell has no browser reload button.
 */
export default function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const onStart = (e: TouchEvent) => {
      if (busy || window.scrollY > 0 || e.touches.length !== 1) return;
      if (startedInsideOwnScroller(e.target)) return;
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) {
        startY.current = null;
        pullRef.current = 0;
        setPull(0);
        return;
      }
      pullRef.current = Math.min(dy * 0.5, MAX_PULL);
      setPull(pullRef.current);
    };
    const onEnd = () => {
      if (startY.current === null) return;
      startY.current = null;
      const reached = pullRef.current >= TRIGGER * 0.5;
      pullRef.current = 0;
      if (!reached) {
        setPull(0);
        return;
      }
      setBusy(true);
      setPull(0);
      void haptic('light');
      router.refresh();
      setTimeout(() => setBusy(false), 900);
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [busy, router]);

  if (!pull && !busy) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[90] flex justify-center"
      style={{ top: 'calc(var(--app-safe-top) + 0.5rem)' }}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
        style={{ transform: `translateY(${busy ? 12 : pull * 0.6}px)`, opacity: busy ? 1 : Math.min(pull / 40, 1) }}
      >
        <RefreshCw
          className={`h-4 w-4 text-teal-600 ${busy ? 'animate-spin' : ''}`}
          style={busy ? undefined : { transform: `rotate(${pull * 4}deg)` }}
        />
      </div>
    </div>
  );
}
