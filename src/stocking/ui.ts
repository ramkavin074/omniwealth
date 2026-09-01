// Bottom padding that clears the fixed bottom nav (~3.25rem) plus the OS
// gesture bar. The product list handles its own clearance via VirtualList's
// footerPad; the shorter screens spread this on their root.
export const SCREEN_PAD_STYLE = {
  paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))',
} as const;
