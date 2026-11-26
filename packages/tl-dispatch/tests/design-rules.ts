import { readFileSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import ts from "typescript";

import { CHECK_SIZES, CONTROL_HEIGHTS, TOUCH_MIN_HEIGHT } from "./control-scale";
import { type CssDeclaration, importedPath, lineAt, parseCss } from "./css";
import { EXEMPT } from "./design-config";
import { filesWith, importsOf, ownFiles, resolutionCache } from "./imports";
import { PACKAGE_ROOT, type SourceFile, UI_STYLESHEET, UPSTREAM_WEB } from "./source";
import { parseScript } from "./typescript";

export interface DesignViolation {
  file: string;
  line: number;
  text: string;
  rule: string;
}

export const RULES = {
  raw: "raw colour: use a theme token",
  outside: "colour outside the theme's tokens",
  focus: "focus is drawn in the focus token alone (`outline-focus`), at full strength",
  textOpacity: "text at reduced opacity loses its contrast; use a text token",
  radius:
    "radius outside the theme: 0, a corner token of the theme (`--radius`, a step of it or a role that names one), or `rounded-full` for a circle",
  round: "only a dot or an avatar is round: `rounded-full` goes with a numeric `size-N`",
  motion: "motion only under `motion-safe:`, inside `prefers-reduced-motion: no-preference`",
  scale: "nothing scales, on a press or otherwise: motion is an opacity fade",
  cursor:
    "a control keeps the default cursor: only a link that leaves the app shows the pointer, which the browser gives it",
  apply: "`@apply` hides classes from the compile check; put the classes in the markup",
  styleProp: "a style prop must be an object literal, so the rule can read it",
  style: "set in a style, out of the compile check's sight; use classes",
  styleTag: "an inline stylesheet is out of the compile check's sight; use a stylesheet under src/",
  height: "control height outside the scale",
  upstreamTheme: "raw colour: upstream's theme roles are Tailwind palette classes; use the tokens",
} as const;

// ---- Declarations, from the compiled classes and from the app's own stylesheets ----

/** The theme's custom properties: the colours and shadows, and the corners a rule may name or
 *  compile to. */
export interface ThemeTokens {
  colours: ReadonlySet<string>;
  /** Each corner token's name. */
  radii: ReadonlySet<string>;
  /** Each corner token's value: the theme's `rounded-*` classes compile to these. */
  radiusValues: ReadonlySet<string>;
}

/** The colours of the theme and of the app's own stylesheets, and the theme's corners. The UI
 *  package's own test holds each of the theme's corner tokens to a step of `--radius`, so this
 *  check takes them as they are; a corner token the app declares is no corner. */
export function themeTokens(theme: string, ...own: string[]): ThemeTokens {
  const colours = new Set<string>();
  const radii = new Set<string>();
  const radiusValues = new Set<string>();
  for (const css of [theme, ...own]) {
    for (const { property, value, context } of parseCss(css).declarations) {
      if (/^--radius(-|$)/.test(property)) {
        if (css !== theme) continue;
        radii.add(property);
        radiusValues.add(property === "--radius" ? "var(--radius)" : value);
      } else if (
        property.startsWith("--") &&
        (context.at(-1)?.startsWith(":root") || property.startsWith("--shadow-"))
      )
        // A shadow token lives in `@theme` and holds its colour, so a shadow may name it.
        colours.add(property);
    }
  }
  return { colours, radii, radiusValues };
}

const NAMED_COLOURS = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen accentcolor accentcolortext activetext buttonborder buttonface buttontext canvas canvastext field fieldtext graytext highlight highlighttext linktext mark marktext selecteditem selecteditemtext visitedtext`.split(
    " "
  )
);
/** Properties whose values are names, where a word like `red` is not a colour. */
const NAME_VALUES = new Set([
  "font-family",
  "font",
  "content",
  "quotes",
  "animation-name",
  "grid-template-areas",
  "grid-area",
  "transition-property",
  "will-change",
  "counter-reset",
  "counter-increment",
  "list-style-type",
]);
const SKIPPED = /^@(keyframes|property)\b|^@layer properties$/;
const MOTION_GUARD = /^@media.*prefers-reduced-motion:\s*no-preference/;
const COLOUR_PROPERTY =
  /(^|-)colou?r$|^(fill|stroke|background|background-image|outline|border|border-(top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end)|column-rule|text-decoration|filter|backdrop-filter)$|shadow|gradient/;
const FOCUS_PROPERTY = new Set([
  "outline-color",
  "--tw-outline-color",
  "--tw-ring-color",
  "--tw-ring-offset-color",
  "--tw-inset-ring-color",
]);
const TEXT_PROPERTY = new Set(["color", "-webkit-text-fill-color"]);
const MOTION_PROPERTY = /^(transition|animation)(-|$)|^(transform|translate|scale|rotate)$/;
/** A transition that names a scale, alone or inside a transform. */
const SCALES = /(^|[\s,])(scale|transform)([\s,]|$)/;

function rawColour(property: string, value: string): boolean {
  const code = value.replace(/(["'])(?:\\.|(?!\1).)*\1/g, '""').replace(/#0{4}(0{4})?\b/g, "");
  if (/#[0-9a-f]{3,8}\b/i.test(code)) return true;
  if (
    /(?<![\w-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|light-dark|device-cmyk)\(/i.test(code)
  ) {
    return true;
  }
  if (NAME_VALUES.has(property)) return false;
  return [...code.matchAll(/(?<![\w-])([a-z]+)(?![\w(-])/gi)].some((match) =>
    NAMED_COLOURS.has((match[1] as string).toLowerCase())
  );
}

function varNames(value: string): string[] {
  return [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1] as string);
}

function radiusAllowed(
  value: string,
  { radii, radiusValues }: ThemeTokens,
  circle: boolean
): boolean {
  if (value === "0" || value === "0px") return true;
  if (value === "calc(infinity * 1px)") return circle;
  // The theme's corners compile inline, to the value of their token.
  if (radiusValues.has(value)) return true;
  // Or it names one corner token, with no fallback and nothing around it.
  const name = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value)?.[1];
  return name !== undefined && radii.has(name);
}

/**
 * The rules one declaration breaks. `circle` is set for the CSS of `rounded-full` alone, whose
 * size the script rule checks; no other class or stylesheet sets an infinite radius.
 */
export function declarationProblems(
  declaration: Pick<CssDeclaration, "property" | "value" | "context">,
  tokens: ThemeTokens,
  { circle = false }: { circle?: boolean } = {}
): string[] {
  const { property, value, context } = declaration;
  if (context.some((prelude) => SKIPPED.test(prelude))) return [];
  const problems: string[] = [];
  if (rawColour(property, value)) problems.push(RULES.raw);
  if (COLOUR_PROPERTY.test(property) || TEXT_PROPERTY.has(property)) {
    const names = varNames(value);
    if (names.some((name) => !name.startsWith("--tw-") && !tokens.colours.has(name))) {
      problems.push(RULES.outside);
    }
    const focusShorthand =
      property === "outline" &&
      (value.includes("color-mix(") ||
        names.some((name) => name !== "--focus" && !name.startsWith("--tw-")));
    if ((FOCUS_PROPERTY.has(property) && value !== "var(--focus)") || focusShorthand) {
      problems.push(RULES.focus);
    }
    if (
      TEXT_PROPERTY.has(property) &&
      value.includes("color-mix(") &&
      /\btransparent\b/.test(value)
    ) {
      problems.push(RULES.textOpacity);
    }
  }
  if (/radius$/.test(property) && !radiusAllowed(value, tokens, circle)) {
    problems.push(RULES.radius);
  }
  if (MOTION_PROPERTY.test(property) && !context.some((prelude) => MOTION_GUARD.test(prelude))) {
    problems.push(RULES.motion);
  }
  if (property === "scale" || (/^transition(-property)?$/.test(property) && SCALES.test(value))) {
    problems.push(RULES.scale);
  }
  if (property === "cursor" && /\bpointer\b/.test(value)) problems.push(RULES.cursor);
  return problems;
}

const STYLES = join(PACKAGE_ROOT, "src/styles.css");

/**
 * What the app's entry stylesheet loads, as references: Tailwind, upstream's theme and plugins,
 * and ours, so a class compiles here exactly as in the build, with nothing else emitted.
 */
function compilerInput(): string {
  const imports = parseCss(readFileSync(STYLES, "utf8"))
    .statements.filter((statement) => statement.name === "import")
    .map((statement) => resolve(join(PACKAGE_ROOT, "src"), importedPath(statement.prelude) ?? ""));
  return [
    ...imports.map((path) => `@import ${JSON.stringify(path)} reference;`),
    "@tailwind utilities;",
  ].join("\n");
}

function unescapeClass(name: string): string {
  return name
    .replace(/\\([0-9a-f]{1,6})\s?/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/\\(.)/g, "$1");
}

/** The class a compiled declaration came from: the innermost selector naming a scanned class. */
function sourceClass(
  context: readonly string[],
  classes: ReadonlyMap<string, unknown>
): string | undefined {
  for (const prelude of [...context].reverse()) {
    for (const match of prelude.matchAll(/\.((?:\\[0-9a-f]{1,6}\s?|\\.|[\w-])+)/gi)) {
      const name = unescapeClass(match[1] as string);
      if (classes.has(name)) return name;
    }
  }
  return undefined;
}

type Where = { file: string; line: number };

/** Compiles every class the files hold, with Tailwind and the app's theme, and checks the CSS. */
async function classViolations(
  files: readonly SourceFile[],
  tokens: ThemeTokens
): Promise<DesignViolation[]> {
  const scanner = new Scanner({ sources: [] });
  const classes = new Map<string, Where[]>();
  for (const file of files) {
    const bytes = Buffer.from(file.text);
    const scanned = scanner.getCandidatesWithPositions({
      content: file.text,
      extension: extname(file.path).slice(1),
    });
    for (const { candidate, position } of scanned) {
      const line = bytes.subarray(0, position).toString().split("\n").length;
      classes.set(candidate, [...(classes.get(candidate) ?? []), { file: file.path, line }]);
    }
  }
  const compiler = await compile(compilerInput(), { base: PACKAGE_ROOT, onDependency: () => {} });
  const violations: DesignViolation[] = [];
  for (const declaration of parseCss(compiler.build([...classes.keys()])).declarations) {
    const name = sourceClass(declaration.context, classes);
    const circle = name !== undefined && utilityOf(name) === "rounded-full";
    const problems = declarationProblems(declaration, tokens, { circle });
    if (problems.length === 0) continue;
    const where =
      name === undefined ? [{ file: "(compiled CSS)", line: 0 }] : (classes.get(name) ?? []);
    for (const { file, line } of where) {
      for (const rule of problems) {
        violations.push({
          file,
          line,
          text: name ?? `${declaration.property}: ${declaration.value}`,
          rule,
        });
      }
    }
  }
  return violations;
}

function stylesheetViolations(file: SourceFile, tokens: ThemeTokens): DesignViolation[] {
  const parsed = parseCss(file.text);
  const violations: DesignViolation[] = [];
  for (const declaration of parsed.declarations) {
    for (const rule of declarationProblems(declaration, tokens)) {
      violations.push({
        file: file.path,
        line: lineAt(file.text, declaration.offset),
        text: `${declaration.property}: ${declaration.value}`,
        rule,
      });
    }
  }
  for (const statement of parsed.statements.filter((entry) => entry.name === "apply")) {
    violations.push({
      file: file.path,
      line: lineAt(file.text, statement.offset),
      text: `@apply ${statement.prelude}`,
      rule: RULES.apply,
    });
  }
  return violations;
}

// ---- Scripts: style props and objects, inline stylesheets, control heights, upstream's theme ----

const STYLE_COLOUR_KEYS = new Set([
  "background",
  "backgroundImage",
  "fill",
  "stroke",
  "outline",
  "border",
  "borderTop",
  "borderRight",
  "borderBottom",
  "borderLeft",
  "borderBlock",
  "borderInline",
  "boxShadow",
  "textShadow",
  "filter",
]);

/** What a style key sets that the rules govern, or undefined. */
function styleKeyKind(key: string): string | undefined {
  if (key.startsWith("--")) return "a custom property, which can override a theme token";
  const camel = key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
  if (/colou?r$/i.test(camel) || STYLE_COLOUR_KEYS.has(camel)) return "a colour";
  if (/radius$/i.test(camel)) return "a radius";
  if (/^(min|max)?(height|blockSize)$/i.test(camel)) return "a height";
  if (/^(animation|transition)/i.test(camel)) return "motion";
  if (camel === "scale") return "a scale";
  if (camel === "cursor") return "a cursor";
  return undefined;
}

const STYLE_NAME = /(^|[a-z_])(style|styles|css|sx)$/i;
const NATIVE_CONTROL = new Set(["button", "input", "select", "textarea"]);
const UI_CONTROL = new Set([
  "Button",
  "Input",
  "Textarea",
  "SelectTrigger",
  "Toggle",
  "ToggleGroupItem",
  "ComboboxInput",
  "InputGroup",
]);

function isStyleObject(node: ts.ObjectLiteralExpression): boolean {
  const parent = node.parent;
  if (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent)) {
    return parent.parent.name.getText() === "style";
  }
  if (ts.isVariableDeclaration(parent)) {
    return (
      STYLE_NAME.test(parent.name.getText()) ||
      (parent.type?.getText().includes("CSSProperties") ?? false)
    );
  }
  if (ts.isPropertyAssignment(parent))
    return /^(style|styles|css|sx)$/i.test(parent.name.getText());
  if (ts.isSatisfiesExpression(parent) || ts.isAsExpression(parent)) {
    return parent.type.getText().includes("CSSProperties");
  }
  if (ts.isCallExpression(parent)) {
    return (
      parent.expression.getText() === "Object.assign" &&
      /\.style$/.test(parent.arguments[0]?.getText() ?? "")
    );
  }
  return false;
}

/** The words of every string literal under `node`, with the node that holds each. */
function classWords(node: ts.Node): { word: string; at: ts.Node }[] {
  const words: { word: string; at: ts.Node }[] = [];
  const visit = (child: ts.Node) => {
    if (ts.isStringLiteralLike(child) || ts.isTemplateLiteralToken(child)) {
      for (const word of child.text.split(/\s+/)) if (word !== "") words.push({ word, at: child });
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return words;
}

/** A class without its variants and its important mark: `md:!h-10` gives `h-10`. */
function utilityOf(word: string): string {
  let depth = 0;
  let start = 0;
  for (let at = 0; at < word.length; at += 1) {
    if (word[at] === "[" || word[at] === "(") depth += 1;
    if (word[at] === "]" || word[at] === ")") depth -= 1;
    if (word[at] === ":" && depth === 0) start = at + 1;
  }
  return word.slice(start).replace(/^!|!$/g, "");
}

const HEIGHT = /^(min-h|h|size)-(.+)$/;
const SCALE: readonly number[] = Object.values(CONTROL_HEIGHTS);
const inScale = (kind: string, value: string) =>
  (kind !== "min-h" && SCALE.includes(Number(value))) ||
  (kind === "min-h" && Number(value) === TOUCH_MIN_HEIGHT);

function scriptViolations(
  file: SourceFile,
  upstreamThemeLines: readonly number[]
): DesignViolation[] {
  const source = parseScript(file.path, file.text);
  const violations: DesignViolation[] = upstreamThemeLines.map((line) => ({
    file: file.path,
    line,
    text: "import from upstream's theme",
    rule: RULES.upstreamTheme,
  }));
  const refuse = (node: ts.Node, text: string, rule: string) =>
    violations.push({
      file: file.path,
      line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      text,
      rule,
    });
  const styleKey = (node: ts.Node, key: string) => {
    const what = styleKeyKind(key);
    if (what !== undefined) refuse(node, key, `${what} ${RULES.style}`);
  };
  const heights = (
    words: readonly { word: string; at: ts.Node }[],
    allowed: (k: string, v: string) => boolean
  ) => {
    for (const { word, at } of words) {
      const match = HEIGHT.exec(utilityOf(word));
      if (match !== null && !allowed(match[1] as string, match[2] as string))
        refuse(at, word, RULES.height);
    }
  };

  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)) {
      const utilities = node.text.split(/\s+/).map(utilityOf);
      if (
        utilities.includes("rounded-full") &&
        !utilities.some((utility) => /^size-\d+(\.\d+)?$/.test(utility))
      ) {
        refuse(node, node.text, RULES.round);
      }
    }
    if (ts.isObjectLiteralExpression(node) && isStyleObject(node)) {
      for (const member of node.properties) {
        if (
          ts.isSpreadAssignment(member) ||
          (member.name !== undefined && ts.isComputedPropertyName(member.name))
        ) {
          const key = ts.isSpreadAssignment(member)
            ? undefined
            : (member.name as ts.ComputedPropertyName).expression;
          if (key !== undefined && ts.isStringLiteralLike(key)) styleKey(member, key.text);
          else refuse(member, member.getText(), RULES.styleProp);
        } else if (member.name !== undefined) {
          styleKey(
            member,
            ts.isStringLiteralLike(member.name) ? member.name.text : member.name.getText()
          );
        }
      }
    }
    if (ts.isJsxAttribute(node) && node.name.getText() === "style") {
      const value = node.initializer;
      const expression =
        value !== undefined && ts.isJsxExpression(value) ? value.expression : undefined;
      if (expression === undefined || !ts.isObjectLiteralExpression(expression)) {
        refuse(node, node.getText(), RULES.styleProp);
      }
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const target = node.left;
      if (ts.isPropertyAccessExpression(target) && /\.style$/.test(target.expression.getText())) {
        if (target.name.text === "cssText") refuse(node, target.getText(), RULES.styleProp);
        else styleKey(node, target.name.text);
      }
      if (ts.isElementAccessExpression(target) && /\.style$/.test(target.expression.getText())) {
        const key = target.argumentExpression;
        if (ts.isStringLiteralLike(key)) styleKey(node, key.text);
        else refuse(node, target.getText(), RULES.styleProp);
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "setProperty" &&
      /\.style$/.test(node.expression.expression.getText())
    ) {
      const key = node.arguments[0];
      if (key !== undefined && ts.isStringLiteralLike(key)) styleKey(node, key.text);
      else refuse(node, node.getText(), RULES.styleProp);
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText();
      if (tag === "style") refuse(node, "<style>", RULES.styleTag);
      const className = node.attributes.properties.find(
        (attribute): attribute is ts.JsxAttribute =>
          ts.isJsxAttribute(attribute) && attribute.name.getText() === "className"
      );
      if (
        className?.initializer !== undefined &&
        (NATIVE_CONTROL.has(tag) || UI_CONTROL.has(tag))
      ) {
        const words = classWords(className.initializer);
        const type = node.attributes.properties.find(
          (attribute): attribute is ts.JsxAttribute =>
            ts.isJsxAttribute(attribute) && attribute.name.getText() === "type"
        );
        const check =
          type?.initializer !== undefined &&
          ts.isStringLiteral(type.initializer) &&
          /^(checkbox|radio)$/.test(type.initializer.text);
        heights(words, (heightKind, value) =>
          UI_CONTROL.has(tag)
            ? false
            : check
              ? heightKind === "size" && (CHECK_SIZES as readonly number[]).includes(Number(value))
              : inScale(heightKind, value)
        );
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return violations;
}

const UPSTREAM_THEME = join(UPSTREAM_WEB, "theme") + sep;

export interface DesignOptions {
  /** The files left out, by path; the config's list unless a test passes another. */
  exempt?: Readonly<Record<string, string>>;
}

/** Every design rule the files break: classes compiled, stylesheets read, scripts parsed. */
export async function designViolations(
  files: readonly SourceFile[],
  { exempt = EXEMPT }: DesignOptions = {}
): Promise<DesignViolation[]> {
  const tokens = themeTokens(
    readFileSync(UI_STYLESHEET, "utf8"),
    readFileSync(join(PACKAGE_ROOT, "src/tokens.css"), "utf8")
  );
  const checked = files.filter((file) => exempt[file.path] === undefined);
  const stylesheets = checked.filter((file) => file.path.endsWith(".css"));
  const scripts = checked.filter((file) => /\.(tsx?|[cm]?jsx?|html)$/.test(file.path));
  const disk = filesWith(ownFiles(files));
  const cache = resolutionCache();
  const violations = [
    ...(await classViolations(scripts, tokens)),
    ...stylesheets.flatMap((file) => stylesheetViolations(file, tokens)),
    ...scripts
      .filter((file) => !file.path.endsWith(".html"))
      .flatMap((file) => {
        const lines = importsOf(join(PACKAGE_ROOT, file.path), disk, cache)
          .filter((entry) => entry.file?.startsWith(UPSTREAM_THEME) === true)
          .map((entry) => entry.line);
        return scriptViolations(file, lines);
      }),
  ];
  const seen = new Set<string>();
  return violations.filter((violation) => {
    const key = JSON.stringify(violation);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
