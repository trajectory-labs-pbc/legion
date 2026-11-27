import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { Fact, FactList } from "#registry/legion/ui/fact";

describe("FactList", () => {
  it("takes a class and its other props on each fact, beside its own", () => {
    render(
      <FactList>
        <Fact className="sm:col-span-2" data-testid="reason" label="Reason">
          A rotation
        </Fact>
      </FactList>
    );
    const fact = screen.getByTestId("reason");
    expect(fact.className.split(" ")).toEqual(expect.arrayContaining(["min-w-0", "sm:col-span-2"]));
    expect(fact.getAttribute("data-slot")).toBe("fact");
  });

  it("names each value by its label, as a description list", () => {
    render(
      <FactList>
        <Fact label="Kind">Machine login</Fact>
        <Fact label="Lifetime">15 minutes</Fact>
      </FactList>
    );
    const terms = screen.getAllByRole("term").map((term) => term.textContent);
    const values = screen.getAllByRole("definition").map((value) => value.textContent);
    expect(terms).toEqual(["Kind", "Lifetime"]);
    expect(values).toEqual(["Machine login", "15 minutes"]);
  });
});
