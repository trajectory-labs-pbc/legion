import {
  CHECK_SIZES,
  CONTROL_HEIGHTS,
  GLYPH_SIZES,
  TOUCH_MIN_HEIGHT,
} from "../src/ui/control-scale";
import { lineOf, type SourceFile, withoutComments } from "./source";

export interface DesignViolation {
  file: string;
  line: number;
  text: string;
  rule: string;
}

/** Files the rules leave out, each with its reason. */
export const NOT_CHECKED: Readonly<Record<string, string>> = {
  "src/ui/theme.css":
    "the registry's theme item, written by `shadcn add`: it holds the colour values",
};

/**
 * Files copied from upstream that still break a rule, each with the phase that rebuilds it. A
 * file here that breaks no rule fails the suite, so the list only shrinks.
 */
export const COPIED_FROM_UPSTREAM: Readonly<Record<string, string>> = {
  "src/shell/AppShell.tsx": "the shell phase rebuilds the layout",
  "src/shell/states.tsx": "the shell phase rebuilds the loading and sign-in screens",
};

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOUR_UTILITY =
  "bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|fill|stroke|from|via|to|divide|placeholder|caret|accent|decoration|shadow|inset-shadow|inset-ring|text-shadow";
const TAILWIND_COLOUR = new RegExp(
  `(?<![\\w-])(?:${COLOUR_UTILITY})-(?:(?:${PALETTE})-(?:50|[1-9]00|950)|black|white)(?:\\/\\d+)?(?![\\w-])`,
  "g"
);
const COLOUR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/g;
const CSS_HEX = /#[0-9a-fA-F]{3,8}\b/g;
const CODE_HEX = /(?:\[|["'`])#[0-9a-fA-F]{3,8}(?:\]|["'`])/g;
const RADIUS_CLASS =
  /(?<![\w-])rounded(?:-(?:t|r|b|l|s|e|tl|tr|br|bl|ss|se|es|ee))?(?:-([a-z0-9]+|\[[^\]\s]*\]))?(?![\w-])/g;
const CSS_RADIUS = /\bborder(?:-[a-z]+)?-radius\s*:\s*([^;}]+)/g;
const CHART_FOCUS =
  /(?<![\w-])(?:[a-z-]+:)*(?:outline|ring|ring-offset)-chart-\d(?![\w-])|\boutline(?:-color)?\s*:[^;}]*var\(--chart-\d/g;
const MOTION =
  /(?<![\w-])((?:[a-z0-9-]+:)*)(scale(?:-[xy])?-[\w.[\]-]+|animate-[\w[\]-]+|transition-transform)(?![\w-])/g;
const CSS_ANIMATION = /\banimation(?:-name)?\s*:/g;
const UPSTREAM_THEME =
  /["'](?:@upstream-dispatch|(?:\.\.\/)+dispatch\/web\/src)\/theme\/[^"']*["']/g;
const NATIVE_CONTROL = /<(button|input|select|textarea)\b/g;
const UI_CONTROL =
  /<(Button|Input|Textarea|SelectTrigger|Toggle|ToggleGroupItem|ComboboxInput|InputGroup)\b/g;
const HEIGHT =
  /(?<![\w-])(min-h|h|size)-(\d+(?:\.\d+)?|\[[^\]\s]*\]|px|full|auto|screen|fit|min|max)(?![\w-])/g;

/** The files in `src/ui` that draw a control, whose heights come from the scale. */
export const CONTROL_FILES = [
  "button",
  "checkbox",
  "combobox",
  "input",
  "input-group",
  "radio-group",
  "select",
  "switch",
  "textarea",
  "toggle",
  "toggle-group",
].map((name) => `src/ui/${name}.tsx`);

/** The text of a JSX opening tag from `start`, up to its closing `>` outside braces and quotes. */
function openingTag(code: string, start: number): string {
  let depth = 0;
  let quote: string | undefined;
  for (let index = start; index < code.length; index += 1) {
    const char = code[index] as string;
    if (quote !== undefined) {
      if (char === quote) quote = undefined;
    } else if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
    } else if (char === ">" && depth === 0) {
      return code.slice(start, index + 1);
    }
  }
  return code.slice(start);
}

function inMotionSafe(variants: string): boolean {
  return variants.split(":").includes("motion-safe");
}

/** Whether a CSS offset sits inside a `prefers-reduced-motion: no-preference` block. */
function inReducedMotionGuard(code: string, index: number): boolean {
  const guard = code.lastIndexOf("prefers-reduced-motion: no-preference", index);
  if (guard === -1) return false;
  let depth = 0;
  for (let at = code.indexOf("{", guard); at !== -1 && at < index; at += 1) {
    if (code[at] === "{") depth += 1;
    if (code[at] === "}") depth -= 1;
    if (depth === 0) return false;
  }
  return depth > 0;
}

/** The radius names the theme declares (`--radius-md` gives `md`). */
export function radiusNames(themeCss: string): Set<string> {
  return new Set(
    [...themeCss.matchAll(/--radius-([a-z0-9]+)\s*:/g)].map((match) => match[1] as string)
  );
}

export function designViolations(
  files: readonly SourceFile[],
  radii: ReadonlySet<string>
): DesignViolation[] {
  const violations: DesignViolation[] = [];
  for (const file of files) {
    if (NOT_CHECKED[file.path] !== undefined || /server:\s*"upstream"/.test(file.text)) continue;
    const code = withoutComments(file.text);
    const css = file.path.endsWith(".css");
    const refuse = (index: number, text: string, rule: string) =>
      violations.push({ file: file.path, line: lineOf(code, index), text, rule });
    const each = (
      pattern: RegExp,
      rule: string,
      keep: (match: RegExpMatchArray) => boolean = () => true
    ) => {
      for (const match of code.matchAll(pattern)) {
        if (keep(match)) refuse(match.index ?? 0, match[0], rule);
      }
    };

    each(TAILWIND_COLOUR, "raw colour: use a theme token");
    each(COLOUR_FUNCTION, "raw colour: use a theme token");
    each(css ? CSS_HEX : CODE_HEX, "raw colour: use a theme token");
    each(RADIUS_CLASS, "radius outside the theme", (match) => {
      const size = match[1];
      return size === undefined || !(size === "none" || size === "full" || radii.has(size));
    });
    each(CSS_RADIUS, "radius outside the theme", (match) => {
      const value = (match[1] as string).trim();
      return !/^(0|50%|9999px|calc\(var\(--radius[\w-]*\)[^)]*\)|var\(--radius[\w-]*\))$/.test(
        value
      );
    });
    each(
      UPSTREAM_THEME,
      "raw colour: upstream's theme roles are Tailwind palette classes; use the tokens"
    );
    each(CHART_FOCUS, "focus is drawn with the focus token (`outline-focus`), never a chart token");
    each(MOTION, "motion only under `motion-safe:`", (match) => !inMotionSafe(match[1] as string));
    if (css) {
      each(
        CSS_ANIMATION,
        "motion only inside `@media (prefers-reduced-motion: no-preference)`",
        (match) => !inReducedMotionGuard(code, match.index ?? 0)
      );
    }

    const heightRule = (
      text: string,
      index: number,
      allowed: (kind: string, value: string) => boolean
    ) => {
      for (const match of text.matchAll(HEIGHT)) {
        const kind = match[1] as string;
        const value = match[2] as string;
        if (!allowed(kind, value)) {
          refuse(index + (match.index ?? 0), match[0], "control height outside the scale");
        }
      }
    };
    const scale: readonly number[] = Object.values(CONTROL_HEIGHTS);
    const inScale = (kind: string, value: string) =>
      (kind !== "min-h" && scale.includes(Number(value))) ||
      (kind === "min-h" && Number(value) === TOUCH_MIN_HEIGHT);
    for (const match of code.matchAll(NATIVE_CONTROL)) {
      const tag = openingTag(code, match.index ?? 0);
      const check = /type=["'](checkbox|radio)["']/.test(tag);
      heightRule(tag, match.index ?? 0, (kind, value) =>
        check
          ? kind === "size" && (CHECK_SIZES as readonly number[]).includes(Number(value))
          : inScale(kind, value)
      );
    }
    for (const match of code.matchAll(UI_CONTROL)) {
      heightRule(openingTag(code, match.index ?? 0), match.index ?? 0, () => false);
    }
    if (CONTROL_FILES.includes(file.path)) {
      const multiLine = file.path === "src/ui/textarea.tsx";
      heightRule(
        code,
        0,
        (kind, value) =>
          inScale(kind, value) ||
          (multiLine && kind === "min-h") ||
          (kind === "size" &&
            [...(GLYPH_SIZES as readonly number[]), ...(CHECK_SIZES as readonly number[])].includes(
              Number(value)
            ))
      );
    }
  }
  return violations;
}
