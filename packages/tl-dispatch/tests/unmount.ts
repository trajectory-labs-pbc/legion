// A preload ahead of upstream's setup (bunfig.toml), so its unmount runs before upstream's
// resets and its act and network check, and a check that throws cannot skip it.
import { afterEach } from "bun:test";
import { unmountAll } from "./mount";

afterEach(unmountAll);
