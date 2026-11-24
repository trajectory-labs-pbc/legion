/** One press of a key sequence, as the key engine reads tinykeys syntax (`$mod+k`, `Shift+P`, `?`). */
export interface Combo {
  alt: boolean;
  control: boolean;
  key: string;
  meta: boolean;
  mod: boolean;
  shift: boolean;
}

const MODIFIERS = new Set(["$mod", "Control", "Ctrl", "Meta", "Alt", "Shift"]);

export function parseCombo(text: string): Combo {
  const parts = text.split("+");
  const key = parts.pop();
  if (key === undefined || key === "") throw new Error(`"${text}" has no key`);
  const combo: Combo = { alt: false, control: false, key, meta: false, mod: false, shift: false };
  for (const part of parts) {
    if (!MODIFIERS.has(part)) throw new Error(`"${text}" has an unknown modifier "${part}"`);
    if (part === "$mod") combo.mod = true;
    else if (part === "Control" || part === "Ctrl") combo.control = true;
    else if (part === "Meta") combo.meta = true;
    else if (part === "Alt") combo.alt = true;
    else combo.shift = true;
  }
  return combo;
}

export function parseSequence(keys: string): Combo[] {
  return keys.trim().split(/\s+/).map(parseCombo);
}

/** Whether one key press can match both combos, as the engine matches them. */
export function sameCombo(a: Combo, b: Combo): boolean {
  if (a.key.toLowerCase() !== b.key.toLowerCase() || a.alt !== b.alt) return false;
  // A non-letter character already says whether Shift was held.
  const shiftInKey = a.key.length === 1 && a.key.toLowerCase() === a.key.toUpperCase();
  if (!shiftInKey && a.shift !== b.shift) return false;
  if (a.mod || b.mod) return (a.mod || a.control || a.meta) && (b.mod || b.control || b.meta);
  return a.control === b.control && a.meta === b.meta;
}

export function sameSequence(a: readonly Combo[], b: readonly Combo[]): boolean {
  return a.length === b.length && a.every((combo, index) => sameCombo(combo, b[index] as Combo));
}

export function isStrictPrefix(shorter: readonly Combo[], longer: readonly Combo[]): boolean {
  return (
    shorter.length < longer.length &&
    shorter.every((combo, index) => sameCombo(combo, longer[index] as Combo))
  );
}

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
].map(parseSequence);

/** Keys the palette takes for itself, so no palette row shows them. */
export const PALETTE_KEYS = ["$mod+k", "/", "j", "k", "Escape"].map(parseSequence);

/** Keys every reader knows, so neither the palette nor the shortcuts sheet lists them. */
export const KNOWN_KEYS = ["Escape"].map(parseSequence);

export function holdsAny(keys: readonly string[], set: readonly (readonly Combo[])[]): boolean {
  return keys.some((key) => set.some((known) => sameSequence(parseSequence(key), known)));
}
