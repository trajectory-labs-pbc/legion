import { afterEach, describe, expect, test } from "bun:test";
import { useRef } from "react";

import { render } from "../../tests/react";
import { pageIdentityOf, useFocusMainOnPageChange } from "./use-focus-main";

function Shell({ pathname }: { pathname: string }) {
  const main = useRef<HTMLElement | null>(null);
  useFocusMainOnPageChange(main, pathname);
  return (
    <>
      <button type="button">elsewhere</button>
      <main ref={main} tabIndex={-1} />
    </>
  );
}

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

function mount(pathname: string) {
  const view = render(<Shell pathname={pathname} />);
  mounted.push(view);
  const focusElsewhere = () => view.container.querySelector("button")?.focus();
  focusElsewhere();
  return {
    go: (next: string) => view.rerender(<Shell pathname={next} />),
    focused: () => document.activeElement?.tagName.toLowerCase(),
    focusElsewhere,
  };
}

describe("useFocusMainOnPageChange", () => {
  test("leaves focus alone on the first page and moves it to main on another", () => {
    const shell = mount("/");
    expect(shell.focused()).toBe("button");
    shell.go("/agents");
    expect(shell.focused()).toBe("main");
  });

  test("control: another tab of the same issue is the same page, so focus stays", () => {
    const shell = mount("/issues/AB-1");
    shell.go("/issues/AB-1/plan");
    expect(shell.focused()).toBe("button");
    shell.go("/issues/AB-2");
    expect(shell.focused()).toBe("main");
  });

  test("an issue's tabs and a project's views are one page each", () => {
    expect(pageIdentityOf("/issues/AB-1/plan")).toBe(pageIdentityOf("/issues/AB-1"));
    expect(pageIdentityOf("/projects/AB/issues")).toBe(pageIdentityOf("/projects/AB"));
    expect(pageIdentityOf("/agents")).not.toBe(pageIdentityOf("/machines"));
  });
});
