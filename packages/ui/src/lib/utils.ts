import type { ReactNode } from "react";

export { cn } from "cn";

/** Whether a slot holds something to draw: React draws nothing for null, undefined or false. */
export const isDrawn = (node: ReactNode): boolean =>
  node !== null && node !== undefined && node !== false;
