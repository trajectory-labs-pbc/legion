import { createKeymap, type Keymap } from "@upstream-dispatch/features/shell/keymap";

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

/**
 * Whether a held key and `keys` clash, checked one held key at a time, so held keys that clash
 * among themselves never throw. Each held key's checker is made once.
 */
export function clashChecker(): (held: string, keys: string) => boolean {
  const checkers = new Map<string, Keymap>();
  return (held, keys) => {
    let checker = checkers.get(held);
    if (checker === undefined) {
      checker = keyChecker([held]);
      checkers.set(held, checker);
    }
    return clashes(checker, keys);
  };
}

/** The presses of a key in the engine's syntax: `"g i"` is `g`, then `i`. */
export function keySteps(keys: string): string[] {
  return keys.trim().split(/\s+/);
}

/** Whether a sequence of more than one press starts with a plain G, O or N. */
export function chordStartsRight(keys: string): boolean {
  const [first, ...rest] = keySteps(keys);
  return rest.length === 0 || CHORD_PREFIXES.some((prefix) => prefix === first?.toLowerCase());
}

const BROWSER = keyChecker(BROWSER_KEYS);

/** Whether `keys` is one press the browser keeps. */
export function browserKeeps(keys: string): boolean {
  return keySteps(keys).length === 1 && clashes(BROWSER, keys);
}
