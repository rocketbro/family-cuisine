// Waits for a screen to finish loading and be left alone, so a tip never lands on a blank page
// or over a sheet someone is using. A sheet already open means no tip this time.
const SETTLE_MS = 700;
const POLL_MS = 300;
const GIVE_UP_MS = 8000;

export function sheetIsOpen(): boolean {
  return document.body.classList.contains('sheet-open') || document.querySelector('.sheet-backdrop') !== null;
}

/** Calls `show` once the screen has settled, or never. Returns a way to cancel. */
export function whenSettled(show: () => void): () => void {
  const started = Date.now();
  let timer = window.setTimeout(look, SETTLE_MS);
  function look() {
    if (document.visibilityState !== 'visible' || document.querySelector('.loading')) {
      if (Date.now() - started < GIVE_UP_MS) timer = window.setTimeout(look, POLL_MS);
      return;
    }
    if (!sheetIsOpen()) show();
  }
  return () => window.clearTimeout(timer);
}
