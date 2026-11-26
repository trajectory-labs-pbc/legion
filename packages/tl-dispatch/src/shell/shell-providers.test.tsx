import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  type MarginDrawer,
  type MarginFill,
  useFillMarginSlot,
  useMarginDrawer,
  useMarginDrawsSlot,
  useMarginSlotFill,
} from "@upstream-dispatch/features/issue-page/margin-slot";
import {
  type ShellNavigation,
  useShellNavigation,
} from "@upstream-dispatch/features/issue-page/shell-navigation";
import { useShortcutHelpOpener } from "@upstream-dispatch/features/issue-page/shortcut-help-opener";
import { useMargin } from "@upstream-dispatch/features/margin/margin-context";
import {
  NOTHING_PUBLISHED,
  type PublishedReferences,
  useKnownReferences,
  usePublishReferenceNames,
} from "@upstream-dispatch/features/refs/reference-names";
import type { ReactNode } from "react";

import { render, settle } from "../../tests/react";
import { ShellProviders } from "./shell-providers";

const drawer: MarginDrawer = { open: false, setOpen: () => {}, setPage: () => {} };
const navigation: ShellNavigation = { open: false, onOpen: () => {} };

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

/** Draws `children` as a page under the shell's contexts. */
function mount(children: ReactNode, openShortcuts = () => {}): void {
  mounted.push(
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ShellProviders drawer={drawer} navigation={navigation} openShortcuts={openShortcuts}>
          {children}
        </ShellProviders>
      </QueryClientProvider>
    )
  );
}

describe("ShellProviders", () => {
  test("SHL-3 a block filter one part of the page sets, another part reads", () => {
    const seen: { filter?: (id: string) => void; filtered?: string } = {};
    function Setter() {
      seen.filter = useMargin().filterToBlock;
      return null;
    }
    function Reader() {
      seen.filtered = useMargin().blockFilterId;
      return null;
    }
    mount(
      <>
        <Setter />
        <Reader />
      </>
    );
    settle(() => seen.filter?.("block-7"));
    expect(seen.filtered).toBe("block-7");
  });

  test("SHL-4 the references one part of the page publishes, another part knows", () => {
    const published: PublishedReferences = { ...NOTHING_PUBLISHED, asked: new Set(["AB-1"]) };
    const seen: { asked?: ReadonlySet<string> } = {};
    function Publisher() {
      usePublishReferenceNames(published);
      return null;
    }
    function Reader() {
      seen.asked = useKnownReferences().asked;
      return null;
    }
    mount(
      <>
        <Publisher />
        <Reader />
      </>
    );
    expect(seen.asked?.has("AB-1")).toBe(true);
  });

  test("SHL-5 a page fills the margin's slot, and reads the drawer the shell gives it", () => {
    const fill: MarginFill = (content) => content;
    const seen: { fill?: MarginFill; drawer?: MarginDrawer; drawsSlot?: boolean } = {};
    function Page() {
      useFillMarginSlot(fill);
      seen.drawer = useMarginDrawer();
      seen.drawsSlot = useMarginDrawsSlot();
      return null;
    }
    function Margin() {
      seen.fill = useMarginSlotFill();
      return null;
    }
    mount(
      <>
        <Page />
        <Margin />
      </>
    );
    expect(seen.fill).toBe(fill);
    expect(seen.drawer).toBe(drawer);
    expect(seen.drawsSlot).toBe(true);
  });

  test("SHL-6 a page reads the shell's navigation", () => {
    const seen: { navigation?: ShellNavigation } = {};
    function Page() {
      seen.navigation = useShellNavigation();
      return null;
    }
    mount(<Page />);
    expect(seen.navigation).toBe(navigation);
  });

  test("SHL-7 a page opens the shell's shortcut help", () => {
    let opened = 0;
    const seen: { open?: () => void } = {};
    function Page() {
      seen.open = useShortcutHelpOpener();
      return null;
    }
    mount(<Page />, () => {
      opened += 1;
    });
    seen.open?.();
    expect(opened).toBe(1);
  });
});
