import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "#registry/legion/ui/avatar";

describe("Avatar", () => {
  it("shows its fallback with no image and takes no focus", async () => {
    render(
      <>
        <AvatarGroup>
          <Avatar>
            <AvatarImage src="/missing.png" alt="Ada" />
            <AvatarFallback>AB</AvatarFallback>
          </Avatar>
          <AvatarGroupCount>+3</AvatarGroupCount>
        </AvatarGroup>
        <button type="button">After</button>
      </>
    );
    expect(screen.getByText("AB")).toBeDefined();
    expect(screen.getByText("+3")).toBeDefined();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
  });
});
