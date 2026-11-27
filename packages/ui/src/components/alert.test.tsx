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

  it("is a status unless it reports a failure", () => {
    render(
      <>
        <Alert>Saved.</Alert>
        <Alert variant="warning">Waiting on you.</Alert>
        <Alert variant="success">Merged.</Alert>
        <Alert variant="danger">Could not load the logins.</Alert>
      </>
    );
    expect(screen.getAllByRole("status").map((alert) => alert.textContent)).toEqual([
      "Saved.",
      "Waiting on you.",
      "Merged.",
    ]);
    expect(screen.getByRole("alert").textContent).toBe("Could not load the logins.");
  });

  it.each<"default" | "compact">([
    "default",
    "compact",
  ])("wraps a %s alert's title, which is never cut", (size) => {
    render(
      <Alert size={size} variant="danger">
        <AlertTitle>Could not approve: the request expired a minute ago.</AlertTitle>
      </Alert>
    );
    const alert = screen.getByRole("alert");
    expect(`${alert.className} ${alert.firstElementChild?.className}`).not.toContain("line-clamp");
  });
});
