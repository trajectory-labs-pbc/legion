import { afterEach, describe, expect, test } from "bun:test";
import { legacyPinnedAgentsKey } from "@upstream-dispatch/features/shell/userPreference";

import { render } from "../../tests/react";
import { type PinWrite, usePinsMigration } from "./use-agent-pins";

function Probe({ login, write }: { login: string; write: PinWrite }) {
  usePinsMigration(login, write);
  return null;
}

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
  window.localStorage.clear();
});

const settleWrites = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("usePinsMigration", () => {
  test("writes each kept pin, in order, then forgets the browser's list", async () => {
    const key = legacyPinnedAgentsKey("reader");
    window.localStorage.setItem(key, JSON.stringify(["s1", "s2"]));
    const written: string[] = [];
    const write: PinWrite = async (sessionId) => {
      written.push(sessionId);
      return true;
    };
    mounted.push(render(<Probe login="reader" write={write} />));
    await settleWrites();
    expect(written).toEqual(["s1", "s2"]);
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  test("control: a refused write stops the move and keeps the list", async () => {
    const key = legacyPinnedAgentsKey("reader");
    window.localStorage.setItem(key, JSON.stringify(["s1", "s2"]));
    const written: string[] = [];
    const write: PinWrite = async (sessionId) => {
      written.push(sessionId);
      return false;
    };
    mounted.push(render(<Probe login="reader" write={write} />));
    await settleWrites();
    expect(written).toEqual(["s1"]);
    expect(window.localStorage.getItem(key)).not.toBeNull();
  });
});
