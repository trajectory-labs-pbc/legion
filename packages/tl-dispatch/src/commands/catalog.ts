import type { KeymapScope } from "@upstream-dispatch/features/shell/keymap";

import {
  BROWSER_KEYS,
  CHORD_PREFIXES,
  type Combo,
  isStrictPrefix,
  parseSequence,
  sameSequence,
} from "./keys";

/** A record menu's sections, in order, with a separator between two. */
export const MENU_SECTIONS = ["open", "change", "create", "other", "copy", "destructive"] as const;
export type MenuSection = (typeof MENU_SECTIONS)[number];

/** A catalog that can leave a command out: the palette, the shortcuts sheet, or a menu. */
export type Listing = "palette" | "sheet" | "menu";

/** A command as declared once: the fields that never change while it is mounted. */
export interface CommandDefinition {
  /** Unique in its context; the id is `<context>.<name>`. */
  name: string;
  label: string;
  /** Tinykeys syntax; the first is the one a menu row or a tooltip shows. `[]` has no shortcut. */
  keys?: readonly string[];
  icon?: string;
  group: MenuSection;
  destructive?: boolean;
  hideFrom?: readonly Listing[];
  /** Never runs while any overlay is open (undo). */
  onlyWithoutOverlay?: boolean;
  /** Words a reader types that the label lacks. */
  keywords?: readonly string[];
  /** Fires while a text control has focus: every key, or the keys listed (`$mod+k`, not `/`). */
  inEditable?: boolean | readonly string[];
  /** Each key does something different (the arrows, 1-9), so the palette offers no row. */
  perKey?: boolean;
  /** Asks for a value: a picker page in the palette, a submenu in a menu. */
  picker?: boolean;
}

/** A set of commands that is live together. Each context extends one parent, up to `global`. */
export interface CommandContext {
  name: string;
  parent: string | null;
  /** The key engine's scope these commands register in. */
  scope: KeymapScope;
  commands: readonly CommandDefinition[];
}

export interface CatalogCommand extends CommandDefinition {
  id: string;
  context: string;
}

export interface Catalog {
  context(name: string): CommandContext;
  /** The context and its ancestors, nearest first. */
  chain(name: string): readonly string[];
  command(id: string): CatalogCommand | undefined;
  commandsOf(context: string): readonly CatalogCommand[];
}

export class CatalogError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`The command catalog is invalid:\n- ${problems.join("\n- ")}`);
  }
}

const NAME = /^[a-z][a-z0-9-]*$/;
const ROOT = "global";

function chainOf(contexts: ReadonlyMap<string, CommandContext>, name: string): string[] | string {
  const chain: string[] = [];
  let current: string | null = name;
  while (current !== null) {
    if (chain.includes(current))
      return `context "${name}" has a cycle: ${chain.join(" > ")} > ${current}`;
    const context = contexts.get(current);
    if (context === undefined)
      return `context "${chain.at(-1)}" extends "${current}", which does not exist`;
    chain.push(current);
    current = context.parent;
  }
  if (chain.at(-1) !== ROOT) return `context "${name}" does not reach "${ROOT}"`;
  return chain;
}

/** Builds the catalog, or throws one error that names every problem. */
export function createCatalog(declared: readonly CommandContext[]): Catalog {
  const problems: string[] = [];
  const contexts = new Map<string, CommandContext>();
  for (const context of declared) {
    if (!NAME.test(context.name)) problems.push(`context name "${context.name}" is not kebab-case`);
    if (contexts.has(context.name)) problems.push(`context "${context.name}" is declared twice`);
    contexts.set(context.name, context);
  }
  const root = contexts.get(ROOT);
  if (root === undefined) problems.push(`no "${ROOT}" context`);
  else if (root.parent !== null) problems.push(`"${ROOT}" extends "${root.parent}"`);

  const commands = new Map<string, CatalogCommand>();
  const sequences = new Map<string, { command: CatalogCommand; key: string; combos: Combo[] }[]>();
  for (const context of contexts.values()) {
    if (context.name !== ROOT && context.parent === null) {
      problems.push(`context "${context.name}" extends nothing`);
    }
    const own: { command: CatalogCommand; key: string; combos: Combo[] }[] = [];
    for (const definition of context.commands) {
      const id = `${context.name}.${definition.name}`;
      if (!NAME.test(definition.name)) problems.push(`command name "${id}" is not kebab-case`);
      if (commands.has(id)) problems.push(`two commands are named "${id}"`);
      const command: CatalogCommand = { ...definition, id, context: context.name };
      commands.set(id, command);
      if (definition.destructive === true && definition.group !== "destructive") {
        problems.push(`"${id}" is destructive but sits in the "${definition.group}" section`);
      }
      if (Array.isArray(definition.inEditable)) {
        for (const key of definition.inEditable as readonly string[]) {
          if (!(definition.keys ?? []).includes(key)) {
            problems.push(`"${id}": inEditable names "${key}", which is not one of its keys`);
          }
        }
      }
      for (const key of definition.keys ?? []) {
        let combos: Combo[];
        try {
          combos = parseSequence(key);
        } catch (error) {
          problems.push(`"${id}": ${(error as Error).message}`);
          continue;
        }
        const first = combos[0] as Combo;
        const prefixed = CHORD_PREFIXES.some((prefix) => prefix === first.key.toLowerCase());
        if (
          combos.length > 1 &&
          (!prefixed || first.mod || first.control || first.meta || first.alt || first.shift)
        ) {
          problems.push(`"${id}": the chord "${key}" starts with neither G, O nor N`);
        }
        if (BROWSER_KEYS.some((reserved) => sameSequence(reserved, combos))) {
          problems.push(`"${id}": the browser keeps "${key}"`);
        }
        own.push({ command, key, combos });
      }
    }
    sequences.set(context.name, own);
  }

  const chains = new Map<string, readonly string[]>();
  for (const name of contexts.keys()) {
    const chain = chainOf(contexts, name);
    if (typeof chain === "string") problems.push(chain);
    else chains.set(name, chain);
  }

  // Two commands live together clash when one press sequence matches both, or one is a prefix.
  const reported = new Set<string>();
  for (const [name, chain] of chains) {
    const live = chain.flatMap((context) => sequences.get(context) ?? []);
    for (let i = 0; i < live.length; i += 1) {
      for (let j = i + 1; j < live.length; j += 1) {
        const a = live[i] as (typeof live)[number];
        const b = live[j] as (typeof live)[number];
        if (a.command === b.command) continue;
        const clash = sameSequence(a.combos, b.combos)
          ? "the same key"
          : isStrictPrefix(a.combos, b.combos) || isStrictPrefix(b.combos, a.combos)
            ? "a key that starts the other's chord"
            : undefined;
        const report = `"${a.command.id}" (${a.key}) and "${b.command.id}" (${b.key}) on the chain of "${name}" have ${clash}`;
        if (clash !== undefined && !reported.has(`${a.command.id}|${b.command.id}`)) {
          reported.add(`${a.command.id}|${b.command.id}`);
          problems.push(report);
        }
      }
    }
  }
  if (problems.length > 0) throw new CatalogError(problems);

  return {
    context(name) {
      const context = contexts.get(name);
      if (context === undefined) throw new Error(`no context "${name}"`);
      return context;
    },
    chain(name) {
      const chain = chains.get(name);
      if (chain === undefined) throw new Error(`no context "${name}"`);
      return chain;
    },
    command: (id) => commands.get(id),
    commandsOf: (context) =>
      [...commands.values()].filter((command) => command.context === context),
  };
}
