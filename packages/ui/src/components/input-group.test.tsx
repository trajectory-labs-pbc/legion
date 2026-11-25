import { describe, expect, it, vi } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "#registry/legion/ui/input-group";

describe("InputGroup", () => {
  it("types into its field and tabs on to its button", async () => {
    const onClick = vi.fn();
    render(
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>https://</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput aria-label="Address" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton aria-label="Go" onClick={onClick} />
        </InputGroupAddon>
      </InputGroup>
    );
    const input = screen.getByRole("textbox", { name: "Address" });
    await userEvent.tab();
    expect(document.activeElement).toBe(input);
    await userEvent.keyboard("example.com");
    expect((input as HTMLInputElement).value).toBe("example.com");
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Go" }));
    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("focuses its field when its addon text is pressed", async () => {
    render(
      <InputGroup>
        <InputGroupTextarea aria-label="Note" />
        <InputGroupAddon align="block-end">
          <InputGroupText>Markdown</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    );
    await userEvent.click(screen.getByText("Markdown"));
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Note" }));
  });
});
