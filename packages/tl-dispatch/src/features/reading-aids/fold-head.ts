// The head line of a foldable block: a button whose own Enter and Space open and fold it.
import { buttonVariants } from "@legion/ui/components/button";
import { headingVariants, textVariants } from "@legion/ui/lib/typography";
import { cn } from "@legion/ui/lib/utils";
import type { Node } from "@milkdown/kit/prose/model";

import { textOf } from "./folds";

/** The attribute of a head's row, which holds its block's id. */
export const FOLD_HEAD_ATTRIBUTE = "data-reading-aids-fold-head";

/** The attribute of the span that shows the start of the block's text. */
const START_ATTRIBUTE = "data-reading-aids-fold-start";

const KINDS: Readonly<Record<string, string>> = {
  check: "Check",
  plan_task: "Plan task",
  requirement: "Requirement",
};

/** The block types that fold to a head line. */
export const FOLDING_TYPES: ReadonlySet<string> = new Set(Object.keys(KINDS));

/** The characters of a block's text that its head line keeps. */
const START_LENGTH = 160;

const MINTED_ID = /^[\da-f]{8}-[\da-f]{4}-/i;

export const kindOf = (node: Node): string => KINDS[node.type.name] ?? node.type.name;

/** The start of a block's text, as its head line shows it. */
export const startOf = (node: Node): string => textOf(node).slice(0, START_LENGTH);

function span(className: string, text: string): HTMLSpanElement {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = text;
  return element;
}

/** A fold's row outside the text: one ghost button the width of the column. */
export function foldRow(
  tag: "div" | "li",
  {
    attribute,
    blockId,
    buttonClass,
    className,
    expanded,
  }: {
    attribute: string;
    blockId: string;
    buttonClass: string;
    className: string;
    expanded: boolean;
  }
): { button: HTMLButtonElement; row: HTMLElement } {
  const row = document.createElement(tag);
  row.className = className;
  row.setAttribute(attribute, blockId);
  row.setAttribute("contenteditable", "false");
  const button = document.createElement("button");
  button.type = "button";
  button.className = cn(
    buttonVariants({ size: "sm", variant: "ghost" }),
    "w-full justify-start",
    buttonClass
  );
  button.setAttribute("aria-expanded", String(expanded));
  row.append(button);
  return { button, row };
}

/** The head's row: a button that reads the kind, name and start folded, and "Fold" open. */
export function foldHead(
  node: Node,
  blockId: string,
  folded: boolean,
  toggle: (blockId: string) => void
) {
  const { button, row } = foldRow("div", {
    attribute: FOLD_HEAD_ATTRIBUTE,
    blockId,
    buttonClass: "group",
    className: "reading-aids-fold-head",
    expanded: !folded,
  });
  button.append(
    span(
      cn(headingVariants({ size: "label", tone: "muted" }), "group-aria-expanded:sr-only"),
      kindOf(node)
    )
  );
  if (!MINTED_ID.test(blockId)) {
    button.append(
      span(
        cn(textVariants({ size: "caption", tone: "muted" }), "group-aria-expanded:sr-only"),
        blockId
      )
    );
  }
  const start = span(
    cn(textVariants(), "min-w-0 truncate group-aria-expanded:hidden"),
    startOf(node)
  );
  start.setAttribute(START_ATTRIBUTE, "");
  button.append(
    start,
    span(
      cn(textVariants({ size: "caption", tone: "muted" }), "hidden group-aria-expanded:inline"),
      "Fold"
    )
  );
  button.addEventListener("click", () => toggle(blockId));
  return row;
}

/** Shows on each head of `root` whether its block is open, and the start of its text now. */
export function syncHeads(
  root: HTMLElement,
  folded: ReadonlySet<string>,
  starts: ReadonlyMap<string, string>
): void {
  for (const row of root.querySelectorAll(`[${FOLD_HEAD_ATTRIBUTE}]`)) {
    const blockId = row.getAttribute(FOLD_HEAD_ATTRIBUTE);
    const button = row.querySelector("button");
    if (blockId === null || button === null) continue;
    const expanded = String(!folded.has(blockId));
    if (button.getAttribute("aria-expanded") !== expanded) {
      button.setAttribute("aria-expanded", expanded);
    }
    const start = button.querySelector(`[${START_ATTRIBUTE}]`);
    const text = starts.get(blockId);
    if (start !== null && text !== undefined && start.textContent !== text)
      start.textContent = text;
  }
}
