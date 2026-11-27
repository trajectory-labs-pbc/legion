import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { MessagePage } from "#registry/legion/blocks/message-page";

describe("MessagePage", () => {
  it("is the page's main, titled by its one h1, with what to do next", () => {
    render(
      <MessagePage eyebrow="Dispatch" title="Couldn't reach Dispatch.">
        <button type="button">Retry</button>
      </MessagePage>
    );
    const main = screen.getByRole("main");
    expect(main.textContent).toContain("Dispatch");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Couldn't reach Dispatch.");
    expect(main.contains(screen.getByRole("button", { name: "Retry" }))).toBe(true);
  });
});
