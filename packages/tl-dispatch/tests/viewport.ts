// Every test file shares one window, so a width one test sets would reach later files.
const browser = (window as unknown as { happyDOM: { setViewport(size: { width: number }): void } })
  .happyDOM;
const startWidth = window.innerWidth;

/** Draws what mounts next at `width`; the next test starts at the default width again. */
export function setWidth(width: number) {
  browser.setViewport({ width });
}

/** Puts the default width back; tests/setup.ts calls it before each test. */
export function resetWidth() {
  browser.setViewport({ width: startWidth });
}
