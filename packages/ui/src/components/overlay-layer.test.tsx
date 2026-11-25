import { afterEach, describe, expect, it, vi } from "bun:test";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";

import { Button } from "#registry/legion/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "#registry/legion/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#registry/legion/ui/dropdown-menu";
import {
  type ModalKind,
  OverlayLayerProvider,
  OverlayOpenProvider,
  overlayStack,
  useModalLayer,
  useOverlayBelow,
  useOverlayLayer,
} from "#registry/legion/ui/overlay-layer";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "#registry/legion/ui/sheet";

const kinds = () => overlayStack.get().map((layer) => layer.kind);

function Probe({ name }: { name: string }) {
  const own = useOverlayLayer();
  const below = useOverlayBelow();
  return <span data-testid={name}>{`${own?.kind ?? "page"}>${below?.kind ?? "none"}`}</span>;
}

function Modal({ kind, name }: { kind: ModalKind; name: string }) {
  const modal = useModalLayer(kind);
  return <span data-testid={name} {...modal.backdropProps} {...modal.popupProps} />;
}

function Siblings({ bottomOpen }: { bottomOpen: boolean }) {
  return (
    <>
      <OverlayOpenProvider open={bottomOpen}>
        <Modal kind="sheet" name="bottom" />
      </OverlayOpenProvider>
      <OverlayOpenProvider open>
        <Modal kind="dialog" name="top" />
      </OverlayOpenProvider>
    </>
  );
}

describe("the overlay stack", () => {
  afterEach(() => {
    act(() => overlayStack.set(() => []));
  });

  it("stacks a dialog over a sheet, shows one scrim and dims the covered sheet", async () => {
    render(
      <Sheet>
        <SheetTrigger render={<Button />}>Open sheet</SheetTrigger>
        <SheetContent>
          <SheetTitle>Sheet</SheetTitle>
          <Dialog>
            <DialogTrigger render={<Button />}>Open dialog</DialogTrigger>
            <DialogContent>
              <DialogTitle>Dialog</DialogTitle>
              <Probe name="in-dialog" />
            </DialogContent>
          </Dialog>
        </SheetContent>
      </Sheet>
    );
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    const sheet = await screen.findByRole("dialog", { name: "Sheet" });
    expect(kinds()).toEqual(["sheet"]);

    const openDialog = await screen.findByRole("button", { name: "Open dialog" });
    openDialog.focus();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("dialog", { name: "Dialog" });
    expect(kinds()).toEqual(["sheet", "dialog"]);
    expect(screen.getByTestId("in-dialog").textContent).toBe("dialog>sheet");
    await waitFor(() => expect(sheet.hasAttribute("data-covered")).toBe(true));
    const scrims = document.querySelectorAll(
      "[data-slot=dialog-overlay], [data-slot=sheet-overlay]"
    );
    expect([...scrims].filter((scrim) => !scrim.hasAttribute("data-stacked")).length).toBe(1);

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(kinds()).toEqual(["sheet"]));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(kinds()).toEqual([]));
  });

  it("puts a menu on the stack while it is open", async () => {
    render(
      <>
        <Probe name="page" />
        <DropdownMenu>
          <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>One</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
    expect(screen.getByTestId("page").textContent).toBe("page>none");
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("menu");
    expect(kinds()).toEqual(["menu"]);
    expect(screen.getByTestId("page").textContent).toBe("page>menu");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(kinds()).toEqual([]));
  });

  it("puts an outer overlay under the inner one when both mount together", () => {
    render(
      <OverlayOpenProvider open>
        <OverlayLayerProvider kind="popover">
          <OverlayOpenProvider open>
            <OverlayLayerProvider kind="menu">
              <Probe name="inner" />
            </OverlayLayerProvider>
          </OverlayOpenProvider>
        </OverlayLayerProvider>
      </OverlayOpenProvider>
    );
    expect(kinds()).toEqual(["popover", "menu"]);
    expect(screen.getByTestId("inner").textContent).toBe("menu>popover");
  });

  it("renders on the server with no overlay open", () => {
    expect(renderToString(<Probe name="server" />)).toContain("page&gt;none");
  });

  it("refuses overlay content outside an open provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OverlayLayerProvider kind="menu">Loose</OverlayLayerProvider>)).toThrow(
      "An overlay's content must be inside OverlayOpenProvider"
    );
    consoleError.mockRestore();
  });

  it("leaves a controlled root open, and on the stack, until its owner closes it", async () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Pinned</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    await screen.findByRole("dialog", { name: "Pinned" });
    expect(kinds()).toEqual(["dialog"]);
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
    expect(screen.getByRole("dialog", { name: "Pinned" })).toBeDefined();
    expect(kinds()).toEqual(["dialog"]);
  });

  it("keeps a closing layer's look while it animates out, though it has left the stack", () => {
    const { rerender } = render(<Siblings bottomOpen />);
    const bottom = screen.getByTestId("bottom");
    expect(kinds()).toEqual(["sheet", "dialog"]);
    expect(bottom.hasAttribute("data-covered")).toBe(true);
    expect(bottom.hasAttribute("data-stacked")).toBe(false);

    rerender(<Siblings bottomOpen={false} />);
    expect(kinds()).toEqual(["dialog"]);
    expect(bottom.hasAttribute("data-covered")).toBe(true);
    expect(bottom.hasAttribute("data-stacked")).toBe(false);
  });

  it("gives a command layer the open overlays, the one around a node and the one under it", () => {
    const seen: string[][] = [];
    const unsubscribe = overlayStack.subscribe(() => seen.push(kinds()));
    render(
      <OverlayOpenProvider open>
        <OverlayLayerProvider kind="popover">
          <Probe name="inside" />
        </OverlayLayerProvider>
      </OverlayOpenProvider>
    );
    render(<Probe name="outside" />);
    unsubscribe();
    expect(seen.at(-1)).toEqual(["popover"]);
    expect(screen.getByTestId("inside").textContent).toBe("popover>none");
    expect(screen.getByTestId("outside").textContent).toBe("page>popover");
  });
});
