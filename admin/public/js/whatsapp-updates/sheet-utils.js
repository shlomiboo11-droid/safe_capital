// Bottom-sheet mobile UX helpers — Phase 5.
//
//   attachDragToDismiss(overlayEl, onDismiss)
//     On viewports ≤768px, when the user pulls the sheet down by more than
//     ~120px (or flicks fast), the overlay's `onDismiss` callback fires.
//     Above 768px the helper is a no-op (modals don't act like sheets).
//
// Implementation notes:
// - We translateY the .wa-modal inside the overlay while the user drags.
// - We only start a drag when the gesture begins on the modal HEADER, OR
//   when scrollTop of the modal body is already 0 and the user pulls down.
//   That way internal scrolling still works.

const DRAG_THRESHOLD_PX  = 120;
const FLICK_VELOCITY_PX  = 0.6;   // px/ms

function isMobileViewport() {
  return window.matchMedia('(max-width: 768px)').matches;
}

export function attachDragToDismiss(overlayEl, onDismiss) {
  if (!overlayEl) return;

  const modal = overlayEl.querySelector('.wa-modal');
  if (!modal) return;

  let startY = 0;
  let lastY  = 0;
  let lastT  = 0;
  let dragging = false;
  let startScrollTop = 0;
  let dragSurface = null;

  function onTouchStart(e) {
    if (!isMobileViewport()) return;
    const t = e.touches[0];
    if (!t) return;

    // Allow drag from the header reliably; from the body only if it's not
    // already scrolled — otherwise let the native scroll win.
    const header  = modal.querySelector('.wa-modal-header');
    const body    = modal.querySelector('.wa-modal-body');
    const target  = e.target;
    const startsOnHeader = header && header.contains(target);
    const startsOnBody   = body && body.contains(target);
    if (!startsOnHeader && !startsOnBody) return;

    startY = t.clientY;
    lastY  = t.clientY;
    lastT  = e.timeStamp;
    dragging = true;
    startScrollTop = body ? body.scrollTop : 0;
    dragSurface = startsOnHeader ? 'header' : 'body';

    modal.style.transition = 'none';
  }

  function onTouchMove(e) {
    if (!dragging) return;
    const t = e.touches[0];
    if (!t) return;

    const dy = t.clientY - startY;

    // Body drag is only valid when scrollTop has stayed at 0 and we pulled down.
    if (dragSurface === 'body') {
      const body = modal.querySelector('.wa-modal-body');
      if (body.scrollTop > 0 || startScrollTop > 0) {
        dragging = false;
        modal.style.transform = '';
        modal.style.transition = '';
        return;
      }
    }

    if (dy > 0) {
      // Linear translate while dragging down. Cap visually so it doesn't fly.
      modal.style.transform = `translateY(${Math.min(dy, 600)}px)`;
      lastY = t.clientY;
      lastT = e.timeStamp;
      // Prevent the body from also scrolling while we drag the sheet.
      if (e.cancelable) e.preventDefault();
    }
  }

  function onTouchEnd(e) {
    if (!dragging) return;
    dragging = false;

    const t = (e.changedTouches && e.changedTouches[0]) || null;
    const endY = t ? t.clientY : lastY;
    const dy = endY - startY;
    const dt = (e.timeStamp - lastT) || 1;
    const velocity = (endY - lastY) / dt;

    if (dy > DRAG_THRESHOLD_PX || velocity > FLICK_VELOCITY_PX) {
      // Animate out then dismiss.
      modal.style.transition = 'transform 0.2s ease-out';
      modal.style.transform  = 'translateY(100%)';
      setTimeout(() => {
        modal.style.transition = '';
        modal.style.transform  = '';
        if (typeof onDismiss === 'function') onDismiss();
      }, 200);
    } else {
      // Snap back.
      modal.style.transition = 'transform 0.2s ease-out';
      modal.style.transform  = '';
      setTimeout(() => { modal.style.transition = ''; }, 220);
    }
  }

  overlayEl.addEventListener('touchstart', onTouchStart, { passive: true });
  overlayEl.addEventListener('touchmove',  onTouchMove,  { passive: false });
  overlayEl.addEventListener('touchend',   onTouchEnd,   { passive: true });
  overlayEl.addEventListener('touchcancel', onTouchEnd,  { passive: true });
}
