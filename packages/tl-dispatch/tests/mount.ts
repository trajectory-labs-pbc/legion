import type { ReactNode } from "react";

import { render } from "./react";

type View = ReturnType<typeof render>;

const mounted = new Set<View>();

/** `render`, with the view unmounted after the test; `unmount` may also run before, once or twice. */
export function mount(element: ReactNode): View {
  const view = render(element);
  const tracked: View = {
    ...view,
    unmount() {
      if (!mounted.delete(tracked)) return;
      view.unmount();
    },
  };
  mounted.add(tracked);
  return tracked;
}

/** Unmounts every view a test left mounted, the last mounted first. */
export function unmountAll(): void {
  for (const view of [...mounted].reverse()) view.unmount();
}
