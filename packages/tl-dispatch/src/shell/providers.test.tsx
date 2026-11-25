import { describe, expect, test } from "bun:test";
import { QueryClient, useQueryClient } from "@tanstack/react-query";

import { useAddress } from "@/navigation/hooks";
import { render } from "../../tests/react";
import { AppProviders } from "./providers";

describe("AppProviders", () => {
  test("gives every screen the query client and the browser's address", () => {
    const client = new QueryClient();
    let seen: { client: QueryClient; pathname: string } | undefined;
    function Screen() {
      seen = { client: useQueryClient(), pathname: useAddress().pathname };
      return null;
    }
    const view = render(
      <AppProviders client={client}>
        <Screen />
      </AppProviders>
    );
    expect(seen?.client).toBe(client);
    expect(seen?.pathname).toBe(window.location.pathname);
    view.unmount();
  });
});
