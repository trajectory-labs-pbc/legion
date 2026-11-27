// Loaded before every test file, after upstream's preloads (bunfig.toml).
import { afterEach } from "bun:test";
import { loadHotkeyTooltip } from "@/commands/hotkey-tooltip";
import { unmountAll } from "./mount";

// The app loads the key tooltips' code after its first paint. Here it is in place before any
// test, so its arrival is never an update outside `act` in whichever file mounts a tooltip first.
await loadHotkeyTooltip();

// Each test starts with nothing of an earlier test's still mounted.
afterEach(unmountAll);
