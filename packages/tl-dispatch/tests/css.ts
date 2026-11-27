import postcss, { AtRule, type Node, Rule } from "postcss";

/** A declaration, with the preludes of the blocks around it, outermost first. */
export interface CssDeclaration {
  property: string;
  value: string;
  context: readonly string[];
  line: number;
}

/** An at-rule that ends in `;` (`@import "x";`). */
export interface CssStatement {
  name: string;
  prelude: string;
  line: number;
}

export interface ParsedCss {
  declarations: CssDeclaration[];
  statements: CssStatement[];
}

/** The preludes of the blocks around a node, outermost first, with whitespace collapsed. */
function contextOf(node: Node): string[] {
  const context: string[] = [];
  for (let at = node.parent; at !== undefined; at = at.parent) {
    const prelude =
      at instanceof Rule
        ? at.selector
        : at instanceof AtRule
          ? `@${at.name.toLowerCase()} ${at.params}`.trim()
          : undefined;
    if (prelude !== undefined) context.unshift(prelude.replace(/\s+/g, " "));
  }
  return context;
}

/** A CSS identifier with its escapes read: `\6c ayer` gives `layer`. An escape that names no
 *  character (0, a surrogate, past U+10FFFF) gives U+FFFD, as CSS reads it. */
export function unescapeCss(name: string): string {
  return name
    .replace(/\\([0-9a-f]{1,6})\s?/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      const none = code === 0 || (code >= 0xd800 && code <= 0xdfff) || code > 0x10ffff;
      return String.fromCodePoint(none ? 0xfffd : code);
    })
    .replace(/\\(.)/g, "$1");
}

/** Reads a stylesheet into its declarations and its at-rule statements, nesting included. */
export function parseCss(text: string): ParsedCss {
  const root = postcss.parse(text);
  const declarations: CssDeclaration[] = [];
  const statements: CssStatement[] = [];
  root.walkDecls((decl) => {
    declarations.push({
      property: unescapeCss(decl.prop).toLowerCase(),
      value: decl.important ? `${decl.value} !important` : decl.value,
      context: contextOf(decl),
      line: decl.source?.start?.line ?? 0,
    });
  });
  root.walkAtRules((rule) => {
    if (rule.nodes !== undefined) return;
    statements.push({ name: rule.name, prelude: rule.params, line: rule.source?.start?.line ?? 0 });
  });
  return { declarations, statements };
}

/** The string a CSS `@import`-like prelude names: `"x"`, `'x'` or `url(x)`. */
export function importedPath(prelude: string): string | undefined {
  const match = /^(?:url\(\s*)?(["'])(.*?)\1|^url\(\s*([^)"'\s]+)\s*\)/.exec(prelude);
  return match === null ? undefined : (match[2] ?? match[3]);
}

/** The parts of `text` between top-level `separator`s. */
export function split(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let part = "";
  for (const char of text) {
    // A class in an attribute selector holds commas too: `[class~="shadow-[0_0_0_1px_x,0_2px_y]"]`.
    if (char === "(" || char === "[") depth += 1;
    if (char === ")" || char === "]") depth -= 1;
    if (char === separator && depth === 0) {
      parts.push(part.trim());
      part = "";
    } else part += char;
  }
  parts.push(part.trim());
  return parts;
}

/** A selector's specificity as one number: ids, then classes, then elements. `:where()` adds
 *  nothing, and `:is()`, `:not()` and `:has()` add their heaviest argument. */
export function specificity(selector: string): number {
  let rest = selector;
  let total = 0;
  for (let call = /:(where|is|not|has)\(/.exec(rest); call !== null; ) {
    const start = call.index + call[0].length;
    let end = start;
    for (let depth = 1; depth > 0; end += 1) {
      if (rest[end] === "(") depth += 1;
      if (rest[end] === ")") depth -= 1;
    }
    if (call[1] !== "where") {
      total += Math.max(...split(rest.slice(start, end - 1), ",").map(specificity));
    }
    rest = `${rest.slice(0, call.index)} ${rest.slice(end)}`;
    call = /:(where|is|not|has)\(/.exec(rest);
  }
  const take = (pattern: RegExp) => {
    const found = rest.match(pattern)?.length ?? 0;
    rest = rest.replace(pattern, " ");
    return found;
  };
  const attributes = take(/\[[^\]]*\]/g);
  const elements = take(/::[\w-]+/g);
  const ids = take(/#(?:\\.|[\w-])+/g);
  const marks = attributes + take(/[.:](?:\\.|[\w-])+/g);
  return total + ids * 1e6 + marks * 1e3 + elements + take(/[a-z][\w-]*/gi);
}
