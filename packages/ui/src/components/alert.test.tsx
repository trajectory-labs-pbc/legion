import { describe, expect, it, vi } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "#registry/legion/ui/alert";
import { Button } from "#registry/legion/ui/button";

describe("Alert", () => {
  it("is an alert whose action takes the keyboard", async () => {
    const onClick = vi.fn();
    render(
      <Alert variant="danger">
        <AlertTitle>Upload failed</AlertTitle>
        <AlertDescription>The file is too large.</AlertDescription>
        <AlertAction>
          <Button onClick={onClick}>Retry</Button>
        </AlertAction>
      </Alert>
    );
    expect(screen.getByRole("alert").textContent).toContain("Upload failed");
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Retry" }));
    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
