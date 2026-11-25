import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button } from "#registry/legion/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "#registry/legion/ui/card";

describe("Card", () => {
  it("titles itself one level under the page and passes the keyboard to its controls", async () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Runs</CardTitle>
          <CardDescription>The last seven days.</CardDescription>
          <CardAction>
            <Button>Refresh</Button>
          </CardAction>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>
          <Button>More</Button>
        </CardFooter>
      </Card>
    );
    expect(screen.getByRole("heading", { name: "Runs", level: 2 })).toBeDefined();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Refresh" }));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "More" }));
  });
});
