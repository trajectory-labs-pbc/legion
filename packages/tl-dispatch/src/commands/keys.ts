import { createKeymap, type Keymap, MOD_KEY_LABEL } from "@upstream-dispatch/features/shell/keymap";

/** The first step of every chord: G jumps, O opens a picker, N opens a create form. */
export const CHORD_PREFIXES = ["g", "o", "n"] as const;

/** Keys the browser keeps. */
export const BROWSER_KEYS = [
  "$mod+r",
  "$mod+t",
  "$mod+w",
  "$mod+n",
  "$mod+l",
  "$mod+d",
  "$mod+Shift+r",
  "$mod+Shift+c",
] as const;

const NOTHING = () => {};

/** A key engine that only takes registrations, in strict mode, so a conflict throws. */
export function keyChecker(held: readonly string[] = []): Keymap {
  const keymap = createKeymap({
    strict: true,
    isMac: false,
    setTimeout: () => 0,
    clearTimeout: NOTHING,
  });
  for (const [index, keys] of held.entries()) {
    keymap.register("global", [{ id: `held-${index}`, keys, label: keys, run: NOTHING }]);
  }
  return keymap;
}

/** Why the engine cannot read `keys`, or undefined when it can. */
export function malformed(keys: string): string | undefined {
  try {
    keyChecker([keys]);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Whether the checker refuses `keys`: one of them starts the other. */
export function refuses(checker: Keymap, keys: string): boolean {
  try {
    checker.register("global", [{ id: "probe", keys, label: keys, run: NOTHING }])();
    return false;
  } catch {
    return true;
  }
}

/** Whether `keys` and a key the checker holds match one press sequence, or one starts the other. */
export function clashes(checker: Keymap, keys: string): boolean {
  // The engine refuses only a strict prefix, so `keys` equals a held key exactly when that key
  // is a strict prefix of `keys` followed by a key nothing binds.
  return refuses(checker, keys) || refuses(checker, `${keys} F24`);
}

function steps(keys: string): string[] {
  return keys.trim().split(/\s+/);
}

/** Whether a sequence of more than one press starts with a plain G, O or N. */
export function chordStartsRight(keys: string): boolean {
  const [first, ...rest] = steps(keys);
  return rest.length === 0 || CHORD_PREFIXES.some((prefix) => prefix === first?.toLowerCase());
}

const BROWSER = keyChecker(BROWSER_KEYS);

/** Whether `keys` is one press the browser keeps. */
export function browserKeeps(keys: string): boolean {
  return steps(keys).length === 1 && clashes(BROWSER, keys);
}

/** One display chip per step of a key: `["⌘K"]` for a press, `["G", "I"]` for a chord. */
export type ShortcutChips = readonly string[];

/** The platform the key engine matches `$mod` for, so the chips and the engine agree. */
export const IS_MAC = MOD_KEY_LABEL === "⌘";

const MODIFIERS: Readonly<Record<string, { mac: string; other: string; aria: string }>> = {
  $mod: { mac: "⌘", other: "Ctrl", aria: "" },
  Meta: { mac: "⌘", other: "Meta", aria: "Meta" },
  Control: { mac: "⌃", other: "Ctrl", aria: "Control" },
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

/** A step's modifiers and key: `"$mod+k"` is `$mod` and `k`; `"$mod++"` ends in the `+` key. */
function splitStep(step: string): { modifiers: string[]; key: string } {
  const plusKey = step.length > 1 && step.endsWith("++");
  const parts = (plusKey ? step.slice(0, -2) : step).split("+");
  const key = plusKey ? "+" : (parts.pop() ?? "");
  return { modifiers: plusKey ? parts.filter((part) => part !== "") : parts, key };
}

function keyName(key: string): string {
  return KEY_NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}

function modifier(name: string): { mac: string; other: string; aria: string } {
  const found = MODIFIERS[name];
  if (found === undefined) throw new Error(`"${name}" is not a modifier the key engine reads`);
  return found;
}

/** The chips of a key in the engine's syntax: `⌘K` on a Mac, `Ctrl+K` elsewhere. */
export function chipsOf(keys: string, mac: boolean = IS_MAC): ShortcutChips {
  return keys
    .trim()
    .split(/\s+/)
    .map((step) => {
      const { modifiers, key } = splitStep(step);
      const names = modifiers.map((name) => (mac ? modifier(name).mac : modifier(name).other));
      return mac ? [...names, keyName(key)].join("") : [...names, keyName(key)].join("+");
    });
}

/** A row's keys as chip sequences; a run of three or more consecutive digits is one chip, `1–9`. */
export function rowChips(keys: readonly string[], mac: boolean = IS_MAC): readonly ShortcutChips[] {
  const chips: ShortcutChips[] = [];
  let index = 0;
  while (index < keys.length) {
    const first = keys[index] ?? "";
    let last = index;
    while (/^[0-8]$/.test(keys[last] ?? "") && keys[last + 1] === String(Number(keys[last]) + 1)) {
      last += 1;
    }
    if (last - index >= 2) {
      chips.push([`${first}–${keys[last] ?? ""}`]);
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
  const presses = keys
    .filter((key) => !/\s/.test(key.trim()))
    .map((key) => {
      const { modifiers, key: last } = splitStep(key.trim());
      const names = modifiers.map((name) =>
        name === "$mod" ? (mac ? "Meta" : "Control") : modifier(name).aria
      );
      return [...names, last.length === 1 ? last.toUpperCase() : last].join("+");
    });
  return presses.length === 0 ? undefined : presses.join(" ");
}
