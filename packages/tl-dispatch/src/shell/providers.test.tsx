import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, useQueryClient } from "@tanstack/react-query";

import { useAddress } from "@/navigation/hooks";
import { render } from "../../tests/react";
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
});
