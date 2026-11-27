import { afterEach, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes } from "react-router-dom";
import { useAddress } from "@/navigation/hooks";

import { MemoryNavigationProvider } from "../../tests/navigation";
import { render } from "../../tests/react";
import { inbox } from "./inbox";
import { PageRoutes } from "./index";

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

test("PageRoutes draws the page an address opens", () => {
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryNavigationProvider path="/nowhere">
        <PageRoutes />
      </MemoryNavigationProvider>
    </QueryClientProvider>
  );
  mounted.push(view);
  expect(view.container.textContent).toContain("not found");
});

function Address() {
  const { pathname, search } = useAddress();
  return <p>{pathname + search}</p>;
}

test("SHL-42 the old Replies address replaces itself with the Inbox's reply rows", () => {
  const view = render(
    <MemoryNavigationProvider path="/replies">
      <Routes>
        <Route element={inbox.routes.replies.element} path={inbox.routes.replies.path} />
        <Route element={<Address />} path={inbox.routes.home.path} />
      </Routes>
    </MemoryNavigationProvider>
  );
  mounted.push(view);
  expect(view.container.textContent).toBe("/?type=reply");
});
