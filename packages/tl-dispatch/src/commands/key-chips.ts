import type { KeySteps } from "@legion/ui/components/kbd";
import { MOD_KEY_LABEL } from "@upstream-dispatch/features/shell/keymap";

import { keySteps, splitStep } from "./keys";

/** The platform the key engine matches `$mod` for, so the chips and the engine agree. */
export const IS_MAC = MOD_KEY_LABEL === "⌘";

const MODIFIERS: Readonly<Record<string, { mac: string; other: string; aria: string }>> = {
  $mod: { mac: "⌘", other: "Ctrl", aria: "" },
  Meta: { mac: "⌘", other: "Meta", aria: "Meta" },
  Control: { mac: "⌃", other: "Ctrl", aria: "Control" },
  Ctrl: { mac: "⌃", other: "Ctrl", aria: "Control" },
  Alt: { mac: "⌥", other: "Alt", aria: "Alt" },
  Shift: { mac: "⇧", other: "Shift", aria: "Shift" },
};

const KEY_NAMES: Readonly<Record<string, string>> = {
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  Enter: "Enter",
  Escape: "Esc",
  " ": "Space",
};

function keyName(key: string): string {
  return KEY_NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}

function modifier(name: string): { mac: string; other: string; aria: string } {
  const found = MODIFIERS[name];
  if (found === undefined) throw new Error(`"${name}" is not a modifier the key engine reads`);
  return found;
}

/** The caps of a key in the engine's syntax, by step: `⌘` `K` on a Mac, `Ctrl` `K` elsewhere. */
export function chipsOf(keys: string, mac: boolean = IS_MAC): KeySteps {
  return keySteps(keys).map((step) => {
    const { modifiers, key } = splitStep(step);
    const names = modifiers.map((name) => (mac ? modifier(name).mac : modifier(name).other));
    return [...names, keyName(key)];
  });
}

/** A row's keys as chip sequences; a run of three or more consecutive digits is one chip, `1–9`. */
export function rowChips(keys: readonly string[], mac: boolean = IS_MAC): readonly KeySteps[] {
  const chips: KeySteps[] = [];
  let index = 0;
  while (index < keys.length) {
    const first = keys[index] ?? "";
    let last = index;
    while (/^[0-8]$/.test(keys[last] ?? "") && keys[last + 1] === String(Number(keys[last]) + 1)) {
      last += 1;
    }
    if (last - index >= 2) {
      chips.push([[`${first}–${keys[last] ?? ""}`]]);
    } else {
      chips.push(chipsOf(first, mac));
      last = index;
    }
    index = last + 1;
  }
  return chips;
}

/** The `aria-keyshortcuts` value of the single-press keys; a chord has no syntax there. */
export function ariaKeyShortcuts(
  keys: readonly string[],
  mac: boolean = IS_MAC
): string | undefined {
  const presses = keys.flatMap((key) => {
    const [step, ...rest] = keySteps(key);
    if (step === undefined || rest.length > 0) return [];
    const { modifiers, key: last } = splitStep(step);
    const names = modifiers.map((name) =>
      name === "$mod" ? (mac ? "Meta" : "Control") : modifier(name).aria
    );
    return [[...names, last.length === 1 ? last.toUpperCase() : last].join("+")];
  });
  return presses.length === 0 ? undefined : presses.join(" ");
}
