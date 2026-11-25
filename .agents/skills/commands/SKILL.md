---
name: commands
description: "Use when you add, change or show a key binding, a palette row, a menu row or a button that runs an action in packages/tl-dispatch: the command catalog, CommandButton, HotkeyTooltip, scopes and overlays, and the shortcuts sheet."
---

# Commands in tl-dispatch

One catalog declares every action of the app once. Keys, buttons, tooltips, menus, the palette and the shortcuts sheet all read it. The code is in `packages/tl-dispatch/src/commands`.

## The rules

1. Declare a command once, in the catalog. Never bind a key in a component, and never write a key chip by hand.
2. A command takes callbacks named for what they do (`goTo`, `createIssue`). Code in `src/commands` never imports the router, `src/shell` or `src/pages`. `tests/layering.test.ts` refuses it.
3. One gate per command: `enabled`. Keys, buttons, the palette and the sheet all obey it. Never test a permission or a state at the call site.
4. Register one command for the record in view or the highlighted row. Never one command per record (`delete-${id}`).
5. Put all the keys of one action in one command: `keys: ["j", "ArrowDown"]`. A tooltip shows the first key; the sheet shows all.
6. A chord starts with `g` (go to a page), `o` (open a picker) or `n` (open a create form). The catalog refuses any other first step.
7. Do not bind a key the browser keeps (`$mod+r`, `$mod+t`, `$mod+w`, `$mod+n`, `$mod+l`, `$mod+d`, `$mod+Shift+r`, `$mod+Shift+c`). The catalog refuses them.
8. An action with no safe key has no key. It is a palette command: `keys` empty or absent.
9. A label follows TY8 in `.agents/skills/ui-design-system/references/surfaces-and-type.md`. The same label shows on every surface.

## The catalog

`src/commands/app-catalog.ts` holds `APP_CONTEXTS`. A context is a set of commands that are live together:

| Field | Meaning |
| --- | --- |
| `name` | Kebab-case. The command id is `<context>.<name>`. |
| `parent` | The context it extends. Every chain ends at `global`. |
| `scope` | The key engine's scope it registers in: `global`, or a page's. The catalog refuses `dialog`: an overlay has no commands of its own yet. |
| `commands` | Each `CommandDefinition`: `name`, `label`, `keys`, `icon`, `group`, `destructive`, `hideFrom`, `inEditable`, `overlays`. |

`CommandId` is typed from the catalog, so a wrong id fails `tsc`. `createCatalog` checks the whole catalog when the module loads, and throws one `CatalogError` that lists every problem: a name that is not kebab-case, two commands with one id, a broken or cyclic chain, two keys live together that one press sequence matches or where one starts the other, a bad chord prefix, a browser key, a key the engine cannot read, and `overlays` on a command outside `global`. Every test that imports the catalog fails on a clash.

`hideFrom` lists the catalogs that do not list the command (`"palette"`, `"sheet"`). Its keys still run. A button that names the command ignores `hideFrom`.

`COMMAND_GROUPS` in `groups.ts` holds the sheet's sections. Declare a group once there.

`NAV_DESTINATIONS` in `nav.ts` is the table of pages the sidebar lists and `g` chords open. One row gives the name, label, icon and the letter after `g`; its route is in `NAV_PAGES` (`src/shell/nav-pages.ts`). The sidebar and the chords read the same row. A row adds a `go-<name>` command to the global context.

## Add a command

1. Add the definition to its context in `app-catalog.ts`. Add a context with a `parent` if no context fits.
2. In the feature, declare its actions hook with `defineActions(appCatalog, "<context>", build)`. `build` returns a `CommandState` (`run`, and optional `enabled` and `label`) for each command of the context. The type check refuses a missing or an unknown name.
3. Call the hook once where the record is in view, and pass its result to `useRegisterCommands(appCatalog, "<context>", specs)`. 
4. Show it with `CommandButton`, or wrap a control in `HotkeyTooltip`. Read its key with `useCommandShortcut`.
5. Run `bun run test src/commands` and `bun run typecheck` in `packages/tl-dispatch`.

`src/shell/global-commands.ts` is the example: the shell passes its actions, and an absent action shuts its command's gate.

## Show a command

- `CommandButton commandId="global.create"`: label, icon, key, style and gate come from the catalog. A click runs what the key runs. A disabled command hides its button unless `showIfDisabled`: a greyed primary button looks broken. A destructive command draws as destructive. An icon-only button is ghost and gets its `aria-label` from the label.
- `HotkeyTooltip commandId=...`: wraps any control. It shows the label and the key chips on hover and focus, and sets `aria-keyshortcuts`. Its popup code loads after the first paint; until then the control carries `aria-keyshortcuts` alone.
- `useCommand(id)`: the mounted command (`label`, `enabled`), or `undefined` before its context mounts.
- `useCommandShortcut(id)`: the chips of the first key: `⌘K` on a Mac, `Ctrl+K` elsewhere. It returns no chips while the command is off or an open overlay stops its key. A chip for a dead key misleads.
- `commandStore.run(id)`: runs a mounted command through its gate, as its key does.

## Scopes and overlays

The app compiles the catalog to upstream's key engine (`@upstream-dispatch/features/shell/keymap`). `src/commands/engine-stack.ts` follows the engine's scope stack and the overlays over the page, and `bindings.ts` writes a context's commands as the engine's bindings.

- `src/commands/focused-overlay.ts` reads the overlays from the DOM, by the `data-slot` of a `packages/ui` popup, in the order the page stacks them: each open dialog, alert dialog and sheet, then each menu, popover or select the focus is inside. A tooltip or hover card is none. The page's keys and the global ones stop under them.
- An overlay is one of three kinds. A `passthrough` one lets the global commands run: a popup with the `data-global-keys` attribute, as the navigation drawer's has. An `alert-dialog` stops every command. Any other stops all but the `under-all` ones.
- `overlays: "under-all"` lets a global command run under every overlay but an alert dialog. No command of the catalog runs while one of upstream's own dialogs is open. `help` (`?`) uses it.
- Never turn a command off in a component by checking focus or DOM roles: the engine does it once, for every command. Never deactivate a scope when an overlay opens. Closing the overlay brings the scope back, and focus returns to where it was.
- A key that a focused text control takes (letters, `/`) does not fire there. `inEditable: true` is for the few commands that must, such as `$mod+k`.

## The shortcuts sheet

`?` opens `ShortcutsSheet` anywhere but under an alert dialog or one of upstream's own dialogs. It lists the keys that run where `?` was pressed: the catalog's commands by group, each once with all its keys, and upstream's bindings by scope. It hides `Escape` and disabled commands. While it is open, only `?` and Escape act: they close it. Its code loads on the first `?`.

`UPSTREAM_LABELS` in `upstream-labels.ts` relabels an upstream binding whose own label does not fit the sheet, by `scope:id`.

## Checks

- `src/commands/schema.test.ts`: the app's catalog and the catalog's load-time refusals. `upstream-keys.test.ts`: parity with the keys upstream's shell binds, and clashes with upstream's page keys. `catalog.test.ts`: the typed command ids.
- `src/commands/bindings.test.tsx`, `key-engine.test.tsx`, `engine-stack.test.ts`: registration, gates, chords and overlay reach.
- `command-button.test.tsx`, `hotkey-tooltip.test.tsx`, `shortcuts-sheet.test.tsx`: the surfaces.
- A reviewer checks that a new action has one catalog entry, one gate, and no key chip or `useKeymap` call in a component.

For the look of buttons, menus and key chips, read `.agents/skills/ui-design-system/SKILL.md`. For links and page moves, read `.agents/skills/navigation/SKILL.md`.
