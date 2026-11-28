import { afterEach, describe, expect, test } from "bun:test";
import { act, screen } from "@testing-library/react";

import { useInboxPreview } from "@/stores/inbox-preview";
import { renderApp } from "../../../tests/app";
import { INBOX_READS, inboxReads } from "../../../tests/inbox";
import { answerReads } from "../../../tests/network";
import { signedInClient } from "../../../tests/writes";
import { InboxPage } from "./page";

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

describe("the Inbox page", () => {
  test("draws upstream's Inbox until the preview is on, then the new one at once", async () => {
    answerReads(INBOX_READS, inboxReads());
    mounted.push(renderApp(<InboxPage />, { client: signedInClient() }));
    expect(document.querySelector("[data-upstream-view]")).not.toBeNull();
    expect(screen.queryByRole("navigation", { name: "Inbox views" })).toBeNull();
    act(() => useInboxPreview.getState().turn(true));
    // Each read of the new list has landed once it says what an empty list says.
    expect(await screen.findByText("Nothing needs you")).toBeDefined();
    expect(screen.getByRole("navigation", { name: "Inbox views" })).toBeDefined();
    expect(document.querySelector("[data-upstream-view]")).toBeNull();
  });
});
