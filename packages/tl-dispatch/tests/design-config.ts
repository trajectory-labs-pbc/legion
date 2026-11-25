/**
 * The files the design rules leave out, each with its reason. Only this list exempts a file:
 * nothing a file says about itself does. Every file here still breaks a rule, or the suite
 * fails, so the list only shrinks.
 */
export const EXEMPT: Readonly<Record<string, string>> = {};
