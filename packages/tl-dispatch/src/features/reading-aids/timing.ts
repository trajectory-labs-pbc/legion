// The timings of the change marks' main-thread work, each a `performance.measure` under one name.
import { useLayoutEffect } from "react";

/** The one name every timing of the marks' work is measured under; its detail names the work. */
export const MARKS_MEASURE = "reading-aids-marks";

/** The most timings the page's timeline holds at once: a long visit clears them as it goes. */
const MOST_KEPT = 1000;
let recorded = 0;

function record(detail: string, start: number): void {
  performance.measure(MARKS_MEASURE, { detail, start });
  recorded += 1;
  if (recorded % MOST_KEPT === 0) performance.clearMeasures(MARKS_MEASURE);
}

/** Does `work`, timed as `detail`. */
export function measured<T>(detail: string, work: () => T): T {
  const start = performance.now();
  try {
    return work();
  } finally {
    record(detail, start);
  }
}

/** Times each render of the calling component, up to its layout effect. */
export function useMeasuredRender(): void {
  const start = performance.now();
  useLayoutEffect(() => record("render", start));
}
