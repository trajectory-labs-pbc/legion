// Loaded before every test file, after upstream's preloads (bunfig.toml).
import { afterEach, beforeEach } from "bun:test";
import { loadHotkeyTooltip } from "@/commands/hotkey-tooltip";
import { useUiPreferences } from "@/stores/ui-preferences";
import { resetWidth } from "./viewport";

// The app loads the key tooltips' code after its first paint. Here it is in place before any
// test, so its arrival is never an update outside `act` in whichever file mounts a tooltip first.
await loadHotkeyTooltip();

// The live views' snapshot is a window global every store writes; each test starts without one.
afterEach(() => {
  window.__dispatchLiveViews = undefined;
});

// Before, not after: a file's own afterEach that throws would skip a later reset.
beforeEach(resetWidth);

// Each test starts with empty storage, and a store from its first state: it keeps its state in
// memory between tests. The reset writes the store's key, so the clear comes after it.
beforeEach(() => {
  useUiPreferences.setState(useUiPreferences.getInitialState(), true);
  window.localStorage.clear();
});
