import { describe, expect, test } from "bun:test";

import { render } from "../../tests/react";
import { useStaleChunkReload } from "./use-stale-chunk-reload";

describe("useStaleChunkReload", () => {
  test("installs the recovery while mounted and removes it after", () => {
    const log: string[] = [];
    const install = () => {
      log.push("install");
      return () => log.push("remove");
    };
    function Probe() {
      useStaleChunkReload(install);
      return null;
    }
    const view = render(<Probe />);
    expect(log).toEqual(["install"]);
    view.unmount();
    expect(log).toEqual(["install", "remove"]);
  });
});
