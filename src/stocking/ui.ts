// Bottom padding that clears the fixed bottom nav (~3.25rem) plus the OS
// gesture bar on phones. On desktop (md+) the nav moves inline to the top, so
// only a normal bottom gap is needed. The product list handles its own
// clearance via VirtualList's footerPad.
export const SCREEN_PAD =
  'pb-[calc(5rem_+_env(safe-area-inset-bottom))] md:pb-8';

/** Overlay that a bottom sheet / modal lives in: slides up from the bottom on
 *  phones, centred dialog on desktop. */
export const SHEET_OVERLAY =
  'fixed inset-0 z-20 flex flex-col justify-end bg-black/40 md:items-center md:justify-center';

/** The sheet panel itself. */
export const SHEET_PANEL =
  'mx-auto w-full max-w-md rounded-t-2xl bg-white p-4 dark:bg-slate-900 md:rounded-2xl';
