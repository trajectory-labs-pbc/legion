import { act } from "react";

/**
 * Waits, inside `act`, for code that loads lazily, so it never arrives after the test, outside
 * `act`, in that test or the next file's.
 */
export function chunksArrive(...loads: (() => Promise<unknown>)[]): Promise<void> {
  return act(async () => {
    for (const load of loads) await load();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

/** The issue page's chunk, upstream's issue page inside the reading aids' host, and the aids
 *  the host starts loading as it mounts. */
export const issuePageArrives = () =>
  chunksArrive(
    () => import("@/features/issue/page"),
    () => import("@/parts/reading-aids/aided-editor").then(({ loadHostAids }) => loadHostAids())
  );

/** The chunks the shell itself draws lazily: upstream's margin and the account's menu. */
export const shellChunksArrive = () =>
  chunksArrive(
    () => import("@/upstream/widgets/margin"),
    () => import("@/shell/account-menu")
  );
