/**
 * The files the design rules leave out, each with its reason. Only this list exempts a file:
 * nothing a file says about itself does. Every file here still breaks a rule, or the suite
 * fails, so the list only shrinks.
 */
export const EXEMPT: Readonly<Record<string, string>> = {
  "src/ui/theme.css":
    "the registry's theme item, written by `shadcn add`: it holds the colour values",
  "src/shell/AppShell.tsx": "copied from upstream; the shell phase rebuilds the layout",
  "src/shell/states.tsx":
    "copied from upstream; the shell phase rebuilds the loading and sign-in screens",
  "src/pages/inbox.tsx": "maps upstream's Inbox with its link colours; the Inbox phase rebuilds it",
  ...Object.fromEntries(
    [
      "src/ui/button.tsx",
      "src/ui/dialog.tsx",
      "src/ui/input.tsx",
      "src/ui/lib/typography.ts",
      "src/ui/overlay-layer.tsx",
      "src/ui/popover.tsx",
      "src/ui/sheet.tsx",
      "src/ui/spinner.tsx",
      "src/ui/tooltip.tsx",
    ].map((file) => [
      file,
      "a registry component, written by `shadcn add`: its shadows, motion and focus ring change in the registry",
    ])
  ),
};

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
