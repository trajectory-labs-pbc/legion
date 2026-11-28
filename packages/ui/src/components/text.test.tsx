import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { Text } from "#registry/legion/ui/text";

describe("Text", () => {
  it("is body text in a span by default", () => {
    render(<Text>Body</Text>);
    const text = screen.getByText("Body");
    expect(text.tagName).toBe("SPAN");
    expect(text.className).toBe("wrap-pretty text-sm");
  });

  it("takes its size, tone and weight from the type scale", () => {
    render(
      <Text size="caption" tone="muted" weight="medium">
        Meta
      </Text>
    );
    expect(screen.getByText("Meta").className.split(" ").sort()).toEqual([
      "font-medium",
      "text-muted-foreground",
      "text-xs",
      "wrap-pretty",
    ]);
  });

  it("draws as the element its caller renders", () => {
    render(<Text render={<p />}>A sentence.</Text>);
    expect(screen.getByText("A sentence.").tagName).toBe("P");
  });
});
