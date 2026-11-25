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
