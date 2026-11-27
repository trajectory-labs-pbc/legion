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
          ? `@${at.name} ${at.params}`.trim()
          : undefined;
    if (prelude !== undefined) context.unshift(prelude.replace(/\s+/g, " "));
  }
  return context;
}

/** Reads a stylesheet into its declarations and its at-rule statements, nesting included. */
export function parseCss(text: string): ParsedCss {
  const root = postcss.parse(text);
  const declarations: CssDeclaration[] = [];
  const statements: CssStatement[] = [];
  root.walkDecls((decl) => {
    declarations.push({
      property: decl.prop.toLowerCase(),
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
