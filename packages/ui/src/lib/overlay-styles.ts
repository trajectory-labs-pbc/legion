// Class names the overlays share.

/** The open and close motion of a floating popup. */
export const popupMotion =
  "motion-safe:transition-opacity motion-safe:duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0";

/** The open and close motion of a dialog, a sheet or a drawer. */
export const modalPopupMotion =
  "motion-safe:transition-opacity motion-safe:duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0";

/** A modal backdrop. A nested modal renders none, so one scrim dims the page. */
export const scrimClass = `fixed inset-0 z-50 bg-scrim/50 ${modalPopupMotion}`;

/** A modal popup that dims while a modal nested in it is open. */
export const coveredClass =
  "after:pointer-events-none after:absolute after:inset-0 after:bg-scrim after:opacity-0 motion-safe:after:transition-opacity motion-safe:after:duration-200 data-nested-dialog-open:after:opacity-25 data-nested-drawer-open:after:opacity-25";

/** The close button in a dialog's or a sheet's corner, a 24px target. */
export const closeButtonClass =
  "absolute top-3 right-3 inline-flex size-6 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
