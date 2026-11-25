/**
 * The files the design rules leave out, each with its reason. Only this list exempts a file:
 * nothing a file says about itself does. Every file here still breaks a rule, or the suite
 * fails, so the list only shrinks.
 */
export const EXEMPT: Readonly<Record<string, string>> = {
  "src/shell/connection-error-page.tsx":
    "copied from upstream; the shell phase rebuilds the loading and sign-in screens",
  "src/shell/page-fallbacks.tsx":
    "copied from upstream; the shell phase rebuilds the loading and sign-in screens",
  "src/shell/shell-message-page.tsx":
    "copied from upstream; the shell phase rebuilds the loading and sign-in screens",
  "src/shell/shell-skeleton.tsx":
    "copied from upstream; the shell phase rebuilds the loading and sign-in screens",
  "src/shell/sign-in-page.tsx":
    "copied from upstream; the shell phase rebuilds the loading and sign-in screens",
  "src/pages/inbox.tsx": "maps upstream's Inbox with its link colours; the Inbox phase rebuilds it",
};

/**
 * Every file in `src/ui`, each written by `shadcn add` from the registry. The design rules and
 * biome leave that folder to the registry's own lint and tests, so a file joins it only here.
 */
export const REGISTRY_FILES: readonly string[] = [
  "button.tsx",
  "dialog.tsx",
  "heading.tsx",
  "input.tsx",
  "kbd.tsx",
  "lib/typography.ts",
  "lib/utils.ts",
  "modal-surface-context.tsx",
  "overlay-layer.tsx",
  "popover.tsx",
  "sheet.tsx",
  "spinner.tsx",
  "theme.css",
  "tooltip.tsx",
].map((name) => `src/ui/${name}`);

/** The files in `src/ui` that draw a control, whose heights come from the scale. */
export const CONTROL_FILES: readonly string[] = [
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
