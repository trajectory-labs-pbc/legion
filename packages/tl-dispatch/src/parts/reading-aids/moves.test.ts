import { afterEach, expect, test } from "bun:test";
import type { EditorHandle } from "@/upstream/editor/frame";

import { moveToBlock } from "./moves";

afterEach(() => {
  document.body.replaceChildren();
});

test("a move puts the focus on the host, which takes none once the focus leaves it", () => {
  const host = document.body.appendChild(document.createElement("div"));
  const dom = host.appendChild(document.createElement("div"));
  const focused: string[] = [];
  const editor = { focusBlock: (id: string) => focused.push(id), view: { dom } };

  moveToBlock({ editor: editor as unknown as EditorHandle, host }, "b-1", "key");
  expect(focused).toContain("b-1");
  expect(document.activeElement).toBe(host);

  host.blur();
  expect(host.hasAttribute("tabindex")).toBe(false);
});

test("moves while the host has the focus add one blur listener", () => {
  const host = document.body.appendChild(document.createElement("div"));
  const dom = host.appendChild(document.createElement("div"));
  const editor = { focusBlock: () => true, view: { dom } } as unknown as EditorHandle;
  const blurs: unknown[] = [];
  const add = host.addEventListener.bind(host);
  host.addEventListener = (type: string, ...rest: [EventListener, AddEventListenerOptions]) => {
    if (type === "blur") blurs.push(rest[0]);
    add(type, ...rest);
  };

  for (const id of ["b-1", "b-2", "b-3"]) moveToBlock({ editor, host }, id, "key");
  expect(document.activeElement).toBe(host);
  expect(blurs).toHaveLength(1);
});
