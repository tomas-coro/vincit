import { useEffect } from 'react';

// Counts how many components currently want body scroll locked. The
// first locker captures the previous body styles and applies the lock;
// the last unlocker restores them. Nested overlays (e.g. a modal that
// opens another modal) compose correctly — scroll stays locked until
// every consumer has unmounted.
let lockCount = 0;
let savedOverflow = '';
let savedTouchAction = '';
let savedPaddingRight = '';

// Reserve space for the scrollbar so locking doesn't visibly shift
// content on desktop browsers that render an overlay scrollbar gutter.
function scrollbarWidth() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 0;
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

// Locks document.body scroll for the lifetime of the calling component.
// Pass `active=false` to opt out dynamically (e.g. when the overlay is
// rendered but not yet animated in). Safe to call in SSR — does nothing
// until effect time.
export default function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    if (lockCount === 0) {
      const sb = scrollbarWidth();
      savedOverflow = document.body.style.overflow;
      savedTouchAction = document.body.style.touchAction;
      savedPaddingRight = document.body.style.paddingRight;
      document.body.style.overflow = 'hidden';
      // touch-action:none prevents iOS rubber-band scroll while still
      // allowing taps inside the modal itself (the modal sets its own
      // touchAction back to auto via the standard CSS cascade).
      document.body.style.touchAction = 'none';
      if (sb > 0) document.body.style.paddingRight = `${sb}px`;
    }
    lockCount++;
    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.body.style.overflow = savedOverflow;
        document.body.style.touchAction = savedTouchAction;
        document.body.style.paddingRight = savedPaddingRight;
      }
    };
  }, [active]);
}
