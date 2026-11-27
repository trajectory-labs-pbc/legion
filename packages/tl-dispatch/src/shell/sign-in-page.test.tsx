import { afterEach, describe, expect, test } from "bun:test";
import { QueryClientProvider } from "@tanstack/react-query";

import { render } from "../../tests/react";
import { pressWrite, signedInClient } from "../../tests/writes";
import { SignInPage } from "./sign-in-page";

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

describe("SignInPage", () => {
  test("SHL-17 the sign-in page names the changes it keeps for the person last signed in", async () => {
    const client = signedInClient();
    const view = render(
      <QueryClientProvider client={client}>
        <SignInPage />
      </QueryClientProvider>
    );
    mounted.push(view);
    await pressWrite(client);
    const kept = view.container.querySelector('[aria-label="Kept changes"]');
    expect(kept?.textContent).toBe("Kept until you sign in again as reader:AB-1 set to done");
  });
});
