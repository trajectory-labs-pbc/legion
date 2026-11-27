import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DeliverySettingsForm } from "@upstream-dispatch/features/delivery/DeliverySettingsForm";
import { railBg, railBorder, railText } from "@upstream-dispatch/theme/classes";

import { type CssDeclaration, parseCss, specificity, split } from "../tests/css";
import { render } from "../tests/react";
import { PACKAGE_ROOT, UPSTREAM_WEB } from "../tests/source";

// frame.css answers upstream's markup, so these tests draw upstream's own Delivery settings form
// in the panel and read what the cascade gives it.

const FRAME_CSS = readFileSync(join(PACKAGE_ROOT, "src/frame.css"), "utf8");
/** The weight upstream's field labels set with `font-medium`; no Tailwind loads here. */
const LABEL_WEIGHT = "label { font-weight: 500; }";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function drawForm(frame: boolean) {
  const style = document.createElement("style");
  style.textContent = frame ? `${LABEL_WEIGHT}\n${FRAME_CSS}` : LABEL_WEIGHT;
  document.head.append(style);
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <div data-testid="content-panel">
        <DeliverySettingsForm initial={null} />
      </div>
    </QueryClientProvider>
  );
  cleanups.push(() => {
    view.unmount();
    style.remove();
  });
  const field = (selector: string) => {
    const found = view.container.querySelector<HTMLElement>(selector);
    if (found === null) throw new Error(`no ${selector}`);
    return found;
  };
  return {
    grid: getComputedStyle(field("fieldset")),
    sample: field('input[placeholder="owner/repo"]'),
    sentence: field('label input[placeholder*=" "]'),
  };
}

describe("frame.css on upstream's forms", () => {
  test("a field keeps its own height, its value's weight, and a cut sentence ends in an ellipsis", () => {
    const { grid, sample, sentence } = drawForm(true);
    expect(grid.alignItems).toBe("start");
    expect(getComputedStyle(sentence).fontWeight).toBe("normal");
    expect(getComputedStyle(sentence).textOverflow).toBe("ellipsis");
    expect(getComputedStyle(sample).textOverflow).not.toBe("ellipsis");
  });

  test("control: without frame.css the grid stretches its fields and a field takes its label's weight", () => {
    const { grid, sentence } = drawForm(false);
    expect(grid.alignItems).not.toBe("start");
    expect(getComputedStyle(sentence).fontWeight).toBe("500");
    expect(getComputedStyle(sentence).textOverflow).not.toBe("ellipsis");
  });

  test("a sentence placeholder is body text; a sample value keeps the field's font", () => {
    const { sample, sentence } = drawForm(true);
    // The DOM here draws no placeholder, so the rule's selector is matched without its pseudo.
    const fonts = parseCss(FRAME_CSS).declarations.filter(
      (declaration) =>
        declaration.property === "font-family" &&
        declaration.context.at(-1)?.endsWith("::placeholder")
    );
    expect(fonts.map((font) => font.value)).toEqual(["var(--font-sans)"]);
    const field = fonts[0]?.context.at(-1)?.replace(/::placeholder$/, "") ?? "";
    expect(sentence.matches(field)).toBe(true);
    expect(sample.matches(field)).toBe(false);
  });
});

/** Works out a length in px: `vars` gives each custom property, `vh` the viewport's height. */
function px(value: string | undefined, vars: Record<string, number>, vh = 800): number {
  const source = (value ?? "")
    .replace(/var\(--([\w-]+)(?:,\s*([\d.]+)px)?\)/g, (_, name: string, fallback?: string) => {
      const known = vars[name] ?? (fallback === undefined ? undefined : Number(fallback));
      if (known === undefined) throw new Error(`--${name} has no value`);
      return String(known);
    })
    .replace(/([\d.]+)dvh/g, (_, count: string) => String((Number(count) * vh) / 100))
    .replaceAll("px", "");
  const tokens = source.match(/max|calc|[\d.]+|[-+*/(),]/g) ?? [];
  let at = 0;
  const sum = (): number => {
    let total = product();
    while (tokens[at] === "+" || tokens[at] === "-") {
      const sign = tokens[at++] === "+" ? 1 : -1;
      total += sign * product();
    }
    return total;
  };
  const product = (): number => {
    let total = term();
    while (tokens[at] === "*" || tokens[at] === "/") {
      total = tokens[at++] === "*" ? total * term() : total / term();
    }
    return total;
  };
  const term = (): number => {
    const token = tokens[at++];
    if (token !== "calc" && token !== "max" && token !== "(") return Number(token);
    if (token !== "(") at++;
    const values = [sum()];
    while (tokens[at] === ",") {
      at++;
      values.push(sum());
    }
    at++;
    return Math.max(...values);
  };
  return sum();
}

/** The panel's inset and folded row, in spacing units, as content-panel.tsx sets them. */
const PANEL_SOURCE = readFileSync(join(PACKAGE_ROOT, "src/shell/content-panel.tsx"), "utf8");
const spacingOf = (name: string) =>
  Number(new RegExp(`\\[--${name}:--spacing\\(([\\d.]+)\\)\\]`).exec(PANEL_SOURCE)?.[1]);

test("the margin sheet runs from under the panel's top border, or its stuck row, to one border over its bottom", () => {
  const sheet = parseCss(FRAME_CSS).declarations.filter((declaration) =>
    declaration.context.at(-1)?.includes('[data-testid="margin-sheet"]')
  );
  const at = (property: string) =>
    sheet.find((declaration) => declaration.property === property)?.value;
  const vh = 800;
  const inset = 8;
  const border = 1;
  for (const row of [undefined, 44]) {
    const vars: Record<string, number> = { "border-width": border, "panel-inset": inset };
    if (row !== undefined) vars["panel-row"] = row;
    vars["sheet-above"] = px(at("--sheet-above"), vars, vh);
    const top = px(at("top"), vars, vh);
    const height = px(at("height"), vars, vh);
    // Stuck, the row covers where the panel's top border was.
    expect(top).toBe(inset + (row ?? border));
    expect(top + height).toBe(vh - inset - border);
    expect(px(at("max-height"), vars, vh)).toBe(height);
  }
});

test("while the folded sidebar's row is drawn, a focused field scrolls clear of it", () => {
  const padding = parseCss(FRAME_CSS).declarations.filter(
    (declaration) => declaration.property === "scroll-padding-top"
  );
  expect(padding.map((declaration) => declaration.context.at(-1))).toEqual([
    'html:has([data-testid="panel-header"])',
  ]);
  const spacing = 4;
  const below = (spacingOf("panel-inset") + spacingOf("panel-row")) * spacing;
  expect(below).toBeGreaterThan(0);
  expect(px(padding[0]?.value, { spacing })).toBeGreaterThanOrEqual(below);
});

test("wider than a phone, the issue's details line wraps rather than scrolls", () => {
  const rail = parseCss(FRAME_CSS).declarations.filter((declaration) =>
    declaration.context.includes('[data-testid="issue-metadata-rail"]')
  );
  expect(rail.map(({ context, property, value }) => [context.at(-1), property, value])).toEqual([
    ["@variant md", "flex-wrap", "wrap"],
  ]);
});

test("the folded margin's rail sits on the canvas, not in upstream's dark navigation colour", () => {
  // Stand-ins for the theme's tokens and upstream's rail utilities, which load no Tailwind here.
  const UPSTREAM = `:root { --background: rgb(250, 249, 247); --muted-foreground: rgb(93, 92, 89); }
.${railBg} { background-color: rgb(2, 6, 23); }
.${railBorder} { border-color: rgb(30, 41, 59); }
.${railText} { color: rgb(241, 245, 249); }`;
  const draw = (frame: boolean) => {
    const style = document.createElement("style");
    style.textContent = frame ? `${UPSTREAM}\n${FRAME_CSS}` : UPSTREAM;
    document.head.append(style);
    const rail = document.createElement("aside");
    rail.dataset.testid = "margin-rail";
    rail.className = `border-l ${railBorder} ${railBg} ${railText}`;
    document.body.append(rail);
    const { backgroundColor, color } = getComputedStyle(rail);
    rail.remove();
    style.remove();
    return [backgroundColor, color];
  };
  expect(draw(false)).toEqual(["rgb(2, 6, 23)", "rgb(241, 245, 249)"]);
  expect(draw(true)).toEqual(["rgb(250, 249, 247)", "rgb(93, 92, 89)"]);
});

const browser = (window as unknown as { happyDOM: { setViewport(size: { width: number }): void } })
  .happyDOM;

/** Loads `css` at `width`, and puts the width and the document back after the test. */
function sheetAt(width: number, css: string) {
  const before = window.innerWidth;
  browser.setViewport({ width });
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  const host = document.body.appendChild(document.createElement("div"));
  cleanups.push(() => {
    host.remove();
    style.remove();
    browser.setViewport({ width: before });
  });
  return (tag: string, attributes: Record<string, string>, parent: HTMLElement = host) => {
    const part = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) part.setAttribute(name, value);
    parent.append(part);
    return part;
  };
}

describe("the folded margin sheet beside the sidebar", () => {
  /** The sheet's left edge and the sidebar's width at `width`, with the sidebar drawn or not.
   *  The sidebar's width is its `w-(--sidebar-width)` class, which loads no Tailwind here. */
  const placeAt = (width: number, { sidebar = true, expanded = false } = {}) => {
    const add = sheetAt(width, `:root { --spacing: 0.25rem; }\n${FRAME_CSS}`);
    const nav = sidebar
      ? add("nav", { "data-testid": "sidebar", style: "width: var(--sidebar-width)" })
      : undefined;
    const sheet = add("aside", {
      "data-testid": "margin-sheet",
      "data-expanded": String(expanded),
    });
    return { left: getComputedStyle(sheet).left, sidebar: nav ? getComputedStyle(nav).width : "" };
  };
  const leftOf = (width: number, options?: { sidebar?: boolean; expanded?: boolean }) =>
    placeAt(width, options).left;

  test("from 768 to 1279 px it starts at the sidebar's edge, so the account at its foot stays in view", () => {
    for (const width of [768, 1024, 1279]) {
      const { left, sidebar } = placeAt(width);
      expect(left).not.toBe("");
      expect(left).toBe(sidebar);
    }
  });

  test("control: it keeps upstream's place with no sidebar, open as a dialog, or as a column from 1280 px", () => {
    expect(leftOf(1024, { sidebar: false })).toBe("");
    expect(leftOf(1024, { expanded: true })).toBe("");
    expect(leftOf(1280)).toBe("");
    expect(leftOf(767)).toBe("");
  });
});

describe("below 1280 px, upstream's 44 px floor", () => {
  // Both stylesheets are outside any layer and frame.css loads later, so a frame.css rule wins
  // where its selector is at least as specific as upstream's. happy-dom does not weigh `:not()`
  // as a browser does, so the winner is worked out from the selectors.
  const UPSTREAM = parseCss(readFileSync(join(UPSTREAM_WEB, "styles.css"), "utf8")).declarations;
  const FRAME = parseCss(FRAME_CSS).declarations;

  /** The specificity of the heaviest selector in `media` that sets `element`'s min-height; -1
   *  with none. */
  const heaviest = (declarations: readonly CssDeclaration[], media: string, element: Element) =>
    Math.max(
      -1,
      ...declarations
        .filter(({ property, context }) => property === "min-height" && context[0] === media)
        .flatMap(({ context }) => split(context[1] ?? "", ","))
        .filter((selector) => {
          try {
            return element.matches(selector);
          } catch {
            // A selector the DOM here cannot read is none of these plain elements'.
            return false;
          }
        })
        .map(specificity)
    );

  test.each([
    [
      "a menu's link entry, as tall as Sign out beside it",
      "data-slot",
      "dropdown-menu-content",
      "a",
    ],
    ["a link in the navigation", "data-slot", "nav-surface", "a"],
    ["a button in the navigation", "data-slot", "nav-surface", "button"],
    ["a link in the panel's top row", "data-testid", "panel-header", "a"],
    ["a button in the panel's top row", "data-testid", "panel-header", "button"],
  ])("under a mouse, gives way to %s", (_name, attribute, value, tag) => {
    const add = sheetAt(1024, "");
    const element = add(tag, { role: "menuitem" }, add("div", { [attribute]: value }));
    const floor = heaviest(UPSTREAM, "@media (max-width: 1279px)", element);
    expect(floor).toBeGreaterThan(-1);
    const own = heaviest(FRAME, "@media (max-width: 1279px) and (pointer: fine)", element);
    expect(own).toBeGreaterThanOrEqual(floor);
  });

  test("under a finger every entry takes the 44 px floor", () => {
    // happy-dom has a mouse alone, so the finger's rule is read rather than drawn.
    const floors = parseCss(FRAME_CSS).declarations.filter(
      (declaration) =>
        declaration.property === "min-height" &&
        declaration.context.some((prelude) => prelude.includes("pointer: coarse"))
    );
    expect(floors.map((floor) => floor.context.at(-1))).toEqual([
      '[data-slot="dropdown-menu-content"] [role="menuitem"]',
    ]);
    expect(px(floors[0]?.value, { spacing: 4 })).toBe(44);
  });
});
