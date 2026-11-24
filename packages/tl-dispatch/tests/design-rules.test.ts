import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { contrastFailures, ratio, readSchemes, resolveColour } from "./contrast";
import { COPIED_FROM_UPSTREAM, designViolations, radiusNames } from "./design-rules";
import { PACKAGE_ROOT, sourceFiles } from "./source";

const theme = readFileSync(join(PACKAGE_ROOT, "src/ui/theme.css"), "utf8");
const tokens = readFileSync(join(PACKAGE_ROOT, "src/ui/tokens.css"), "utf8");
const radii = radiusNames(theme);

const check = (path: string, text: string) => designViolations([{ path, text }], radii);

describe("design rules", () => {
  test("the app's own files keep them, the files copied from upstream aside", () => {
    const violations = designViolations(sourceFiles(), radii).filter(
      (violation) => COPIED_FROM_UPSTREAM[violation.file] === undefined
    );
    expect(violations).toEqual([]);
  });

  test("each file copied from upstream still breaks a rule, so a rebuilt one leaves the list", () => {
    const files = sourceFiles();
    for (const path of Object.keys(COPIED_FROM_UPSTREAM)) {
      const file = files.find((candidate) => candidate.path === path);
      expect(file === undefined ? [] : designViolations([file], radii)).not.toEqual([]);
    }
  });

  test.each([
    ['<p className="text-sky-700">', "raw colour"],
    ['<p className="hover:bg-slate-100/50">', "raw colour"],
    ['<p className="text-white">', "raw colour"],
    ['<p style={{ color: "#1e40af" }}>', "raw colour"],
    ['<p className="bg-[#fff]">', "raw colour"],
    ['<p style={{ color: "oklch(0.5 0.1 200)" }}>', "raw colour"],
    ['import { card } from "@upstream-dispatch/theme/classes";', "raw colour"],
    ['<p className="rounded">', "radius"],
    ['<p className="rounded-xs">', "radius"],
    ['<p className="rounded-[6px]">', "radius"],
    ['<button className="h-10">', "control height"],
    ['<button className="h-[30px]">', "control height"],
    ['<button onClick={() => go()} className="min-h-9">', "control height"],
    ['<input type="checkbox" className="size-5" />', "control height"],
    ['<Button className="h-8">', "control height"],
    ['<a className="focus-visible:outline-chart-5">', "focus"],
    ['<a className="ring-chart-3">', "focus"],
    ['<div className="scale-95">', "motion"],
    ['<div className="hover:scale-105">', "motion"],
    ['<div className="animate-spin">', "motion"],
    ['<div className="transition-transform">', "motion"],
  ])("refuses %s", (text, rule) => {
    const violations = check("src/pages/rebuilt.tsx", text);
    expect(violations.map((violation) => violation.rule).join()).toContain(rule);
  });

  test.each([
    ["src/ui/x.css", ".x { color: #123456; }", "raw colour"],
    ["src/ui/x.css", ".x { border-radius: 6px; }", "radius"],
    ["src/ui/x.css", ".x { outline: 2px solid var(--chart-5); }", "focus"],
    ["src/ui/x.css", ".x { animation: spin 1s; }", "motion"],
    ["src/ui/button.tsx", 'const sizes = { md: "h-10" };', "control height"],
  ])("refuses in %s: %s", (path, text, rule) => {
    expect(
      check(path, text)
        .map((violation) => violation.rule)
        .join()
    ).toContain(rule);
  });

  test.each([
    '<p className="text-foreground bg-card border-border">',
    '<p className="rounded-md rounded-t-lg rounded-full rounded-none">',
    '<button className="h-8 px-3">',
    '<button className="min-h-11">',
    '<input type="checkbox" className="size-4" />',
    '<a className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">',
    '<div className="motion-safe:animate-spin motion-safe:hover:scale-105">',
    '<a href="#b-r1">',
  ])("allows %s", (text) => {
    expect(check("src/pages/rebuilt.tsx", text)).toEqual([]);
  });

  test("allows motion inside a reduced-motion guard in a stylesheet", () => {
    const css = "@media (prefers-reduced-motion: no-preference) { .x { animation: spin 1s; } }";
    expect(check("src/ui/x.css", css)).toEqual([]);
  });

  test("leaves out a page file that only maps upstream's page", () => {
    expect(check("src/pages/x.tsx", 'server: "upstream", <p className="text-sky-700">')).toEqual(
      []
    );
  });
});

describe("contrast", () => {
  const schemes = readSchemes(theme, tokens);

  test("every text pair the theme declares, and focus on every surface, in light and dark", () => {
    expect(contrastFailures(schemes)).toEqual([]);
  });

  test("a token set to the page colour fails", () => {
    const broken = readSchemes(theme, tokens, ":root { --muted-foreground: var(--background); }");
    expect(
      contrastFailures(broken).map(
        (failure) => `${failure.scheme} ${failure.text} on ${failure.on}`
      )
    ).toContain("light --muted-foreground on --background");
  });

  test("the platform's own light ring is below 3:1 on the page, which is why focus has its own token", () => {
    const light = schemes.light;
    expect(
      ratio(resolveColour(light, "--ring"), resolveColour(light, "--background"))
    ).toBeLessThan(3);
    expect(
      ratio(resolveColour(light, "--focus"), resolveColour(light, "--background"))
    ).toBeGreaterThanOrEqual(3);
  });
});
