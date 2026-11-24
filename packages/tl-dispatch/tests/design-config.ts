/**
 * The files the design rules leave out, each with its reason. Only this list exempts a file:
 * nothing a file says about itself does. Every file here still breaks a rule, or the suite
 * fails, so the list only shrinks.
 */
export const EXEMPT: Readonly<Record<string, string>> = {
  "src/shell/states.tsx":
    "copied from upstream; the shell phase rebuilds the loading and sign-in screens",
  "src/pages/inbox.tsx": "maps upstream's Inbox with its link colours; the Inbox phase rebuilds it",
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
