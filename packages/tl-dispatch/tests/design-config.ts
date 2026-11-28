/**
 * The files the design rules leave out, each with its reason. Only this list exempts a file:
 * nothing a file says about itself does. Every file here still breaks a rule, or the suite
 * fails, so the list only shrinks.
 */
export const EXEMPT: Readonly<Record<string, string>> = {
  "src/parts/reading-aids/parts-height.ts":
    "writes the editable's minimum height from the parts' measured height: a class cannot hold a " +
    "height read at run time, and a transaction that carries it in the editable's attributes " +
    "makes ProseMirror write its selection over a caret move it has not read yet",
};
