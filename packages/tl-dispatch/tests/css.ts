/** A declaration, with the preludes of the blocks around it, outermost first. */
export interface CssDeclaration {
  property: string;
  value: string;
  context: readonly string[];
  offset: number;
}

/** An at-rule that ends in `;` (`@import "x";`). */
export interface CssStatement {
  name: string;
  prelude: string;
  context: readonly string[];
  offset: number;
}

export interface ParsedCss {
  declarations: CssDeclaration[];
  statements: CssStatement[];
}

/**
 * Reads a stylesheet into its declarations and at-rule statements, nesting included. Comments
 * are skipped, and strings and escapes kept whole, so neither a `/*` inside a string, a `;` inside
 * a comment nor an escaped `\(` in a selector moves a boundary.
 */
export function parseCss(text: string): ParsedCss {
  const declarations: CssDeclaration[] = [];
  const statements: CssStatement[] = [];
  const context: string[] = [];
  let item = "";
  let start = -1;
  let parens = 0;
  const flush = () => {
    const trimmed = item.trim();
    if (trimmed !== "") {
      if (trimmed.startsWith("@")) {
        const name = /^@([\w-]+)/.exec(trimmed)?.[1] ?? "";
        statements.push({
          name,
          prelude: trimmed.slice(name.length + 1).trim(),
          context: [...context],
          offset: start,
        });
      } else {
        const colon = trimmed.indexOf(":");
        declarations.push({
          property: trimmed.slice(0, colon).trim().toLowerCase(),
          value: trimmed.slice(colon + 1).trim(),
          context: [...context],
          offset: start,
        });
      }
    }
    item = "";
    start = -1;
  };
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at] as string;
    if (char === "/" && text[at + 1] === "*") {
      const end = text.indexOf("*/", at + 2);
      at = end === -1 ? text.length : end + 1;
      item += " ";
      continue;
    }
    if (start === -1 && !/\s/.test(char)) start = at;
    if (char === "\\") {
      item += text.slice(at, at + 2);
      at += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      let end = at + 1;
      while (end < text.length && text[end] !== char) end += text[end] === "\\" ? 2 : 1;
      item += text.slice(at, end + 1);
      at = end;
      continue;
    }
    if (char === "(") parens += 1;
    if (char === ")") parens -= 1;
    if (parens > 0) {
      item += char;
      continue;
    }
    if (char === ";") flush();
    else if (char === "{") {
      context.push(item.trim().replace(/\s+/g, " "));
      item = "";
      start = -1;
    } else if (char === "}") {
      flush();
      context.pop();
    } else item += char;
  }
  flush();
  return { declarations, statements };
}

/** The string a CSS `@import`-like prelude names: `"x"`, `'x'` or `url(x)`. */
export function importedPath(prelude: string): string | undefined {
  const match = /^(?:url\(\s*)?(["'])(.*?)\1|^url\(\s*([^)"'\s]+)\s*\)/.exec(prelude);
  return match === null ? undefined : (match[2] ?? match[3]);
}

export function lineAt(text: string, offset: number): number {
  return text.slice(0, Math.max(0, offset)).split("\n").length;
}
