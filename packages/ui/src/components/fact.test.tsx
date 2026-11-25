import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { Fact, FactList } from "#registry/legion/ui/fact";

describe("FactList", () => {
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
