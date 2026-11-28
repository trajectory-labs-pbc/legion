/** A browser that refuses storage: reaching `localStorage` throws. */
export const refused = (): Storage => {
  throw new DOMException("refused", "SecurityError");
};

/** Runs `run` while `window.localStorage` is what `storage` gives, then puts the real one back. */
export function withLocalStorage(storage: () => Storage, run: () => void): void {
  const kept = Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", { configurable: true, get: storage });
  try {
    run();
  } finally {
    if (kept === undefined) Reflect.deleteProperty(window, "localStorage");
    else Object.defineProperty(window, "localStorage", kept);
  }
}
