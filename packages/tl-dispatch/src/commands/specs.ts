import { type Catalog, type CatalogCommand, MENU_SECTIONS, type MenuSection } from "./catalog";

/** What a feature gives for one command, read afresh on every render. */
export interface CommandState {
  /** The one gate, honoured by keys, menus, the palette and buttons. Default `true`. */
  enabled?: boolean;
  /** The record the command acts on, by name; the palette lists it under that name. */
  subject?: string;
  run: () => void;
}

/** A command with its live state: what keys, menus and the palette all read. */
export interface CommandSpec {
  command: CatalogCommand;
  enabled: boolean;
  subject?: string;
  run: () => void;
}

export type CommandSpecs<Name extends string = string> = Readonly<Record<Name, CommandSpec>>;

/**
 * Declares a feature's actions hook for one context, `useXActions(record, opts)`. `build` returns
 * a state for every command of the context, so every surface gets the same list, of one length.
 */
export function defineActions<Record_, Options, Name extends string = string>(
  catalog: Catalog,
  context: string,
  build: (record: Record_, options: Options) => { readonly [N in Name]: CommandState }
): (record: Record_, options: Options) => CommandSpecs<Name> {
  const commands = catalog.commandsOf(context);
  return (record, options) => {
    const states = build(record, options) as Readonly<Record<string, CommandState>>;
    const names = new Set(Object.keys(states));
    const missing = commands.filter((command) => !names.has(command.name)).map((c) => c.name);
    const extra = [...names].filter((name) => !commands.some((command) => command.name === name));
    if (missing.length > 0 || extra.length > 0) {
      throw new Error(
        `actions of "${context}": missing [${missing.join(", ")}], not in the catalog [${extra.join(", ")}]`
      );
    }
    const specs: Record<string, CommandSpec> = {};
    for (const command of commands) {
      const state = states[command.name] as CommandState;
      specs[command.name] = {
        command,
        enabled: state.enabled ?? true,
        ...(state.subject === undefined ? {} : { subject: state.subject }),
        run: state.run,
      };
    }
    return specs as CommandSpecs<Name>;
  };
}

/** Runs the command unless its gate is shut. Every surface runs a command through this. */
export function runCommand(spec: CommandSpec): boolean {
  if (!spec.enabled) return false;
  spec.run();
  return true;
}

export type Surface = "primary-button" | "key-hint" | "menu-row";
export type Visibility = "show" | "greyed" | "hide";

/**
 * How a surface shows a command whose gate is shut: a primary button hides (greyed, it looks
 * broken), a key hint hides (it would offer a dead key), a menu row shows greyed (it helps a
 * reader find it), and a destructive row hides.
 */
export function visibility(spec: CommandSpec, surface: Surface): Visibility {
  if (spec.enabled) return "show";
  if (surface === "menu-row") return spec.command.destructive === true ? "hide" : "greyed";
  return "hide";
}

export interface MenuItem {
  spec: CommandSpec;
  greyed: boolean;
  /** A value picker opens a submenu; nothing else does. */
  submenu: boolean;
  /** The key a menu row shows: the first. */
  hint?: string;
}

export interface MenuGroup {
  section: MenuSection;
  items: readonly MenuItem[];
}

/**
 * A record menu's sections in their fixed order, empty ones left out. A separator goes between
 * two groups, so none sits at an edge or beside another. No groups: the menu hides its trigger.
 */
export function menuGroups(specs: CommandSpecs): MenuGroup[] {
  const groups: MenuGroup[] = [];
  for (const section of MENU_SECTIONS) {
    const items: MenuItem[] = [];
    for (const spec of Object.values(specs)) {
      if (spec.command.group !== section || spec.command.hideFrom?.includes("menu") === true) {
        continue;
      }
      const shown = visibility(spec, "menu-row");
      if (shown === "hide") continue;
      const hint = spec.command.keys?.[0];
      items.push({
        spec,
        greyed: shown === "greyed",
        submenu: spec.command.picker === true,
        ...(hint === undefined || !spec.enabled ? {} : { hint }),
      });
    }
    if (items.length > 0) groups.push({ section, items });
  }
  return groups;
}
