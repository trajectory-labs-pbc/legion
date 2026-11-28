import { describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PageLink } from "@/navigation/page-link";
import { type PageRoute, pageRoute, routePath } from "@/navigation/page-route";
import { PageRoutes, RouteProvider } from "@/navigation/route-tree";
import { mount } from "../../../tests/mount";
import { MemoryNavigationProvider } from "../../../tests/navigation";
import { ViewHeader } from ".";

const HOME = routePath({ path: "/" });
const ANSWERS = routePath({ path: "/answers" });

/** A test page whose header shows `view`'s tab as the current one, over the view's own text. */
function viewPage(view: "home" | "answers"): PageRoute<string, string> {
  return pageRoute({
    ...(view === "home" ? HOME : ANSWERS),
    element: (
      <>
        <ViewHeader
          count={3}
          tabs={[
            { label: "Inbox", link: <PageLink page={HOME} />, current: view === "home" },
            {
              label: "Answered by you",
              link: <PageLink page={ANSWERS} />,
              current: view === "answers",
            },
          ]}
          title="Inbox"
        />
        <p>{view === "home" ? "The list" : "The answers"}</p>
      </>
    ),
  });
}

function drawAt(path: string) {
  mount(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryNavigationProvider path={path}>
        <RouteProvider
          pages={[{ routes: { home: viewPage("home"), answers: viewPage("answers") } }]}
        >
          <PageRoutes />
        </RouteProvider>
      </MemoryNavigationProvider>
    </QueryClientProvider>
  );
}

const tab = (name: string) => screen.getByRole("link", { name });
const current = () =>
  screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent);

describe("ViewHeader", () => {
  test("INB-22 draws the title, the count and the page's views as tabs, the shown one current", () => {
    drawAt("/");
    expect(screen.getByRole("heading", { level: 1, name: "Inbox" })).toBeDefined();
    expect(screen.getByRole("navigation", { name: "Inbox views" })).toBeDefined();
    expect(tab("Answered by you").getAttribute("href")).toBe("/answers");
    expect(current()).toEqual(["Inbox"]);
  });

  test("INB-22 a click on a tab opens its view, and Enter on a focused tab opens the other", async () => {
    drawAt("/");
    await userEvent.click(tab("Answered by you"));
    expect(screen.getByText("The answers")).toBeDefined();
    expect(current()).toEqual(["Answered by you"]);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    await userEvent.tab();
    expect(document.activeElement).toBe(tab("Inbox"));
    await userEvent.keyboard("{Enter}");
    expect(screen.getByText("The list")).toBeDefined();
    expect(current()).toEqual(["Inbox"]);
  });

  test("draws no tab list for a view without tabs", () => {
    mount(<ViewHeader title="Agents" />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
