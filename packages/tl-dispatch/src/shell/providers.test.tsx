import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { answerRequests } from "@upstream-dispatch/__tests__/network";
import { http } from "msw";

import { useAddress } from "@/navigation/hooks";
import { json, waitFor } from "../../tests/network";
import { render, settle } from "../../tests/react";
import { AppProviders } from "./providers";

const start = `${window.location.pathname}${window.location.search}`;
const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
  window.history.replaceState(null, "", start);
});

describe("AppProviders", () => {
  test("SHL-1 a page reads through the app's query client and on the browser's address", () => {
    window.history.replaceState(null, "", "/issues/AB-1?tab=plan");
    const client = new QueryClient();
    const seen: { client?: QueryClient; address?: string } = {};
    function Page() {
      seen.client = useQueryClient();
      const { pathname, search } = useAddress();
      seen.address = `${pathname}${search}`;
      return null;
    }
    mounted.push(
      render(
        <AppProviders client={client}>
          <Page />
        </AppProviders>
      )
    );
    expect(seen.client).toBe(client);
    expect(seen.address).toBe("/issues/AB-1?tab=plan");
  });

  test("SHL-37 once Dispatch serves only a newer build, the tab regaining focus offers a reload", async () => {
    // A script naming the page's entry chunk, as a built page's module script does; its type
    // keeps the browser from loading it.
    const entry = document.createElement("script");
    entry.type = "application/json";
    entry.src = "/assets/index-current.js";
    document.head.append(entry);
    const reload = spyOn(window.location, "reload").mockImplementation(() => undefined);
    mounted.push({
      unmount: () => {
        entry.remove();
        reload.mockRestore();
      },
    });
    answerRequests(
      http.get("/api/v1/dashboard/builds", () =>
        json({ serving: "/assets/index-new.js", live: ["/assets/index-new.js"] })
      )
    );
    mounted.push(render(<AppProviders client={new QueryClient()}>{null}</AppProviders>));
    settle(() => window.dispatchEvent(new Event("focus")));
    const notice = () => document.body.querySelector('[aria-label="A new version is available"]');
    await waitFor(() => notice() !== null);
    settle(() =>
      [...(notice()?.querySelectorAll("button") ?? [])]
        .find((button) => button.textContent === "Reload")
        ?.click()
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
