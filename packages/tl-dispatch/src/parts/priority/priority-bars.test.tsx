import { describe, expect, test } from "bun:test";
import { screen } from "@testing-library/react";

import { mount } from "../../../tests/mount";
import { barsLevel, PriorityBars } from "./priority-bars";

describe("the bars of a priority or an urgency", () => {
  test("P0 and Blocking are the top level, and no priority is the dashes", () => {
    expect(([0, 1, 2, 3, null] as const).map((priority) => barsLevel({ priority }))).toEqual([
      4, 3, 2, 1, 0,
    ]);
    expect(
      (["blocking", "high", "med", "low"] as const).map((urgency) => barsLevel({ urgency }))
    ).toEqual([4, 3, 2, 1]);
  });

  test("draws the level of its rank, named by its label", () => {
    mount(<PriorityBars label="Urgency: High" rank={{ urgency: "high" }} />);
    expect(screen.getByRole("img", { name: "Urgency: High" }).getAttribute("data-level")).toBe("3");
  });
});
