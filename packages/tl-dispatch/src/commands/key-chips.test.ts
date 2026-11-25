import { describe, expect, test } from "bun:test";

import { ariaKeyShortcuts, chipsOf, rowChips } from "./key-chips";

describe("chips", () => {
  test.each([
    ["$mod+k", true, ["⌘K"]],
    ["$mod+k", false, ["Ctrl+K"]],
    ["Shift+S", true, ["⇧S"]],
    ["Shift+S", false, ["Shift+S"]],
    ["g i", false, ["G", "I"]],
    ["?", true, ["?"]],
    ["ArrowDown", false, ["↓"]],
    ["Escape", false, ["Esc"]],
    ["$mod+Alt+m", true, ["⌘⌥M"]],
    ["$mod++", false, ["Ctrl++"]],
  ] as const)("%s on a Mac: %p", (keys, mac, chips) => {
    expect(chipsOf(keys, mac)).toEqual(chips);
  });

  test("a modifier the engine does not read fails loudly", () => {
    expect(() => chipsOf("Hyper+x", false)).toThrow('"Hyper" is not a modifier');
  });

  test("aria-keyshortcuts names each single press and leaves chords out", () => {
    expect(ariaKeyShortcuts(["$mod+k", "g i", "Shift+S"], true)).toBe("Meta+K Shift+S");
    expect(ariaKeyShortcuts(["$mod+k"], false)).toBe("Control+K");
    expect(ariaKeyShortcuts(["g i"], false)).toBeUndefined();
  });
});

describe("a row's chips", () => {
  test.each([
    [["1", "2", "3", "4", "5", "6", "7", "8", "9"], [["1–9"]]],
    [
      ["1", "2", "3", "5"],
      [["1–3"], ["5"]],
    ],
    [
      ["1", "2"],
      [["1"], ["2"]],
    ],
    [
      ["j", "ArrowDown", "g i"],
      [["J"], ["↓"], ["G", "I"]],
    ],
  ] as const)("%p: %p", (keys, chips) => {
    expect(rowChips(keys, false)).toEqual(chips);
  });
});
