import { afterEach, expect, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PACKAGE_ROOT } from "./source";

const RELOADS_KEY = "dispatch.chunk-reloads";

/** The one script of `index.html` the page runs before any of the app's code. */
function inlineScript(): string {
  const page = new DOMParser().parseFromString(
    readFileSync(join(PACKAGE_ROOT, "index.html"), "utf8"),
    "text/html"
  );
  const scripts = [...page.querySelectorAll("script:not([src])")];
  if (scripts.length !== 1) throw new Error(`index.html has ${scripts.length} inline scripts`);
  return scripts[0]?.textContent ?? "";
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

/** Runs the inline script on this window, and takes its listeners away after the test. */
function runInlineScript(): void {
  const added = spyOn(window, "addEventListener");
  try {
    new Function(inlineScript())();
  } finally {
    added.mockRestore();
  }
  for (const [type, listener, options] of added.mock.calls) {
    cleanups.push(() => window.removeEventListener(type, listener, options));
  }
}

/** A script element of the page whose load failed. */
function failedScript(src: string): void {
  const script = document.createElement("script");
  // A type the browser does not run, so nothing loads it.
  script.type = "application/json";
  script.src = src;
  document.head.append(script);
  cleanups.push(() => script.remove());
  script.dispatchEvent(new Event("error"));
}

test("SHL-39 an asset of this build that fails to load reloads the page before the app runs, three times at most", () => {
  window.sessionStorage.removeItem(RELOADS_KEY);
  const reload = spyOn(window.location, "reload").mockImplementation(() => undefined);
  cleanups.push(() => {
    reload.mockRestore();
    window.sessionStorage.removeItem(RELOADS_KEY);
  });
  runInlineScript();
  failedScript("https://elsewhere.example/assets/index-old.js");
  expect(reload).not.toHaveBeenCalled();
  const ours = `${window.location.origin}/assets/index-old.js`;
  failedScript(ours);
  expect(reload).toHaveBeenCalledTimes(1);
  // Each reload spends one of the recovery reloads that the app's own recovery also counts.
  expect(JSON.parse(window.sessionStorage.getItem(RELOADS_KEY) ?? "[]")).toHaveLength(1);
  // A page whose assets fail on every load stops after three reloads in five minutes.
  for (let failures = 0; failures < 3; failures += 1) failedScript(ours);
  expect(reload).toHaveBeenCalledTimes(3);
});
