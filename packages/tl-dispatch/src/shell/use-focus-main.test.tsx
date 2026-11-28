import { afterEach, describe, expect, test } from "bun:test";
import { useRef } from "react";
import { pageAt } from "@/pages/index";
import { parseIssuePath, parseProjectPath } from "@/upstream/routes";
import { render } from "../../tests/react";
import { pageIdentityOf, useFocusMainOnPageChange } from "./use-focus-main";

const identity = (pathname: string) => pageIdentityOf(pageAt(pathname)?.layout ?? {}, pathname);

function Shell({ pathname }: { pathname: string }) {
  const main = useRef<HTMLElement | null>(null);
  useFocusMainOnPageChange(main, identity(pathname));
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
  test("SHL-32 leaves focus alone on the first page and moves it to main on another", () => {
    const shell = mount("/");
    expect(shell.focused()).toBe("button");
    shell.go("/agents");
    expect(shell.focused()).toBe("main");
  });

  test("SHL-32 control: another tab of the same issue is the same page, so focus stays", () => {
    const shell = mount("/issues/AB-1");
    shell.go("/issues/AB-1/plan");
    expect(shell.focused()).toBe("button");
    shell.go("/issues/AB-2");
    expect(shell.focused()).toBe("main");
  });

  test("SHL-32 an issue's tabs and a project's views are one page each", () => {
    expect(identity("/issues/AB-1/plan")).toBe(identity("/issues/AB-1"));
    expect(identity("/projects/AB/issues")).toBe(identity("/projects/AB"));
    expect(identity("/agents")).not.toBe(identity("/machines"));
  });

  test.each([
    "/issues/AB-1/asks/a1",
    "/issues/ab-1",
    "/projects/AB/documents/spec",
    "/projects/ab",
    "/agents/s-1/live",
    "/",
  ])("SHL-32 at %s, is upstream's: the issue, else the project page, else the address", (pathname) => {
    expect(identity(pathname)).toBe(
      parseIssuePath(pathname)?.key ?? parseProjectPath(pathname)?.project ?? pathname
    );
  });
});
