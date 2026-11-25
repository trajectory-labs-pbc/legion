import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import {
  ModalSurfaceProvider,
  useIsInsideModalSurface,
} from "#registry/legion/ui/modal-surface-context";

function Probe() {
  return <span>{useIsInsideModalSurface() ? "inside" : "outside"}</span>;
}

describe("the modal surface", () => {
  it("is known inside its provider only", () => {
    render(
      <>
        <Probe />
        <ModalSurfaceProvider>
          <Probe />
        </ModalSurfaceProvider>
      </>
    );
    expect(screen.getAllByText(/side/).map((node) => node.textContent)).toEqual([
      "outside",
      "inside",
    ]);
  });
});
