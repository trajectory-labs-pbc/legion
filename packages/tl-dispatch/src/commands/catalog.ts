import type { Keymap, KeymapScope } from "@upstream-dispatch/features/shell/keymap";

import { browserKeeps, chordStartsRight, clashes, keyChecker, malformed } from "./keys";

/** A command as declared once: the fields that never change while it is mounted. */
export interface CommandDefinition {
  /** Unique in its context; the id is `<context>.<name>`. */
  name: string;
  label: string;
  /** The key engine's syntax; the first is the one a menu row or a tooltip shows. None: palette only. */
  keys?: readonly string[];
  /** Fires while a control that takes typed text has focus. */
  inEditable?: boolean;
  /** Whether the palette offers it; unset, the key engine decides (`KeyBinding.palette`). */
  palette?: boolean;
}

/** A set of commands that is live together. Each context extends one parent, up to `global`. */
export interface CommandContext {
  name: string;
  parent: string | null;
  /** The key engine's scope these commands register in; an overlay's context uses `dialog`. */
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

interface CatalogKey {
  command: CatalogCommand;
  keys: string;
}

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

/** Each pair of a key of `held` and a key of `incoming` that clash, as the key engine compares them. */
function clashesBetween(
  held: readonly CatalogKey[],
  incoming: readonly CatalogKey[],
  checkers: Map<string, Keymap>
): [CatalogKey, CatalogKey][] {
  const found: [CatalogKey, CatalogKey][] = [];
  for (const other of held) {
    let checker = checkers.get(other.keys);
    if (checker === undefined) {
      checker = keyChecker([other.keys]);
      checkers.set(other.keys, checker);
    }
    for (const key of incoming) {
      if (other.command !== key.command && clashes(checker, key.keys)) found.push([other, key]);
    }
  }
  return found;
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
  const keysOf = new Map<string, CatalogKey[]>();
  for (const context of contexts.values()) {
    if (context.name !== ROOT && context.parent === null) {
      problems.push(`context "${context.name}" extends nothing`);
    }
    const own: CatalogKey[] = [];
    for (const definition of context.commands) {
      const id = `${context.name}.${definition.name}`;
      if (!NAME.test(definition.name)) problems.push(`command name "${id}" is not kebab-case`);
      if (commands.has(id)) problems.push(`two commands are named "${id}"`);
      const command: CatalogCommand = { ...definition, id, context: context.name };
      commands.set(id, command);
      for (const keys of definition.keys ?? []) {
        const unreadable = malformed(keys);
        if (unreadable !== undefined) problems.push(`"${id}": ${unreadable}`);
        else if (!chordStartsRight(keys))
          problems.push(`"${id}": the chord "${keys}" starts with neither G, O nor N`);
        else if (browserKeeps(keys)) problems.push(`"${id}": the browser keeps "${keys}"`);
        else own.push({ command, keys });
      }
    }
    keysOf.set(context.name, own);
  }

  const chains = new Map<string, readonly string[]>();
  for (const name of contexts.keys()) {
    const chain = chainOf(contexts, name);
    if (typeof chain === "string") problems.push(chain);
    else chains.set(name, chain);
  }

  // Two contexts are live together when one is on the other's chain, or both register in one
  // engine scope, where the first registered of two equal keys wins.
  const names = [...chains.keys()];
  const together = (a: string, b: string) =>
    a === b ||
    chains.get(a)?.includes(b) === true ||
    chains.get(b)?.includes(a) === true ||
    contexts.get(a)?.scope === contexts.get(b)?.scope;
  const reported = new Set<string>();
  const checkers = new Map<string, Keymap>();
  for (const [index, a] of names.entries()) {
    for (const b of names.slice(index)) {
      if (!together(a, b)) continue;
      const held = keysOf.get(a) ?? [];
      const pairs =
        a === b
          ? held.flatMap((key, at) => clashesBetween(held.slice(0, at), [key], checkers))
          : clashesBetween(held, keysOf.get(b) ?? [], checkers);
      for (const [first, second] of pairs) {
        const pair = [first.command.id, second.command.id].sort().join("|");
        if (reported.has(pair)) continue;
        reported.add(pair);
        problems.push(
          `"${first.command.id}" (${first.keys}) and "${second.command.id}" (${second.keys}) are live together and one press sequence matches both, or one starts the other`
        );
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
