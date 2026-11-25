import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "#registry/legion/ui/tabs";

describe("Tabs", () => {
  it("moves between tabs with the arrows and shows the chosen panel", async () => {
    render(
      <Tabs defaultValue="spec">
        <TabsList variant="line">
          <TabsTrigger value="spec">Spec</TabsTrigger>
          <TabsTrigger value="plan">Plan</TabsTrigger>
        </TabsList>
        <TabsContent value="spec">The spec</TabsContent>
        <TabsContent value="plan">The plan</TabsContent>
      </Tabs>
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Spec" }));
    expect(screen.getByRole("tabpanel").textContent).toBe("The spec");
    await userEvent.keyboard("{ArrowRight}");
    const plan = screen.getByRole("tab", { name: "Plan" });
    expect(document.activeElement).toBe(plan);
    await userEvent.keyboard("{Enter}");
    expect(plan.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toBe("The plan");
  });
});
