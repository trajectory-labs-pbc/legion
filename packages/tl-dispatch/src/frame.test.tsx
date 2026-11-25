import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DeliverySettingsForm } from "@upstream-dispatch/features/delivery/DeliverySettingsForm";

import { parseCss } from "../tests/css";
import { render } from "../tests/react";
import { PACKAGE_ROOT } from "../tests/source";

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

test("the margin sheet stays under the panel's top border, or under its stuck top row", () => {
  const sheet = parseCss(FRAME_CSS).declarations.filter((declaration) =>
    declaration.context.at(-1)?.includes('[data-testid="margin-sheet"]')
  );
  const at = (property: string) => sheet.find((declaration) => declaration.property === property);
  // Stuck, the row covers where the panel's 1 px top border was.
  const above = "max(var(--panel-row, 0px), 1px)";
  expect(at("top")?.value).toBe(`calc(var(--panel-inset) + ${above})`);
  // So the sheet's bottom stays 1 px over the panel's bottom inset.
  expect(at("height")?.value).toBe(`calc(100dvh - 2 * var(--panel-inset) - ${above} - 1px)`);
  expect(at("max-height")?.value).toBe(at("height")?.value);
});

test("while the folded sidebar's row is drawn, a focused field scrolls clear of it", () => {
  const padding = parseCss(FRAME_CSS).declarations.filter(
    (declaration) => declaration.property === "scroll-padding-top"
  );
  // The panel's inset is spacing 2 and its row spacing 11 (content-panel.tsx).
  expect(padding.map((declaration) => [declaration.context.at(-1), declaration.value])).toEqual([
    ['html:has([data-testid="panel-header"])', "calc(var(--spacing) * 13)"],
  ]);
});
