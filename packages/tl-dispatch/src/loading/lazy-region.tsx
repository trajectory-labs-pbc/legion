import { ErrorBoundary } from "@upstream-dispatch/features/shell/ErrorBoundary";
import { type ComponentType, Suspense, useState } from "react";

import { lazyNamed, type PropsOf } from "./lazy-named";

/**
 * A module's component whose code is its own chunk, drawn as nothing until it arrives. A chunk
 * that fails offline loads again when the network returns; one that fails online shows the
 * region's error in its place, and the rest of the app stays.
 */
export function lazyRegion<Module, Name extends keyof Module>(
  region: string,
  load: () => Promise<Module>,
  name: Name
): ComponentType<PropsOf<Module[Name]> & object> {
  // The lazy component takes the props its own component takes, which is what this one is given.
  const View = lazyNamed(load, name) as unknown as ComponentType<object>;
  return function LazyRegion(props) {
    return (
      <ErrorBoundary region={region}>
        <Suspense fallback={null}>
          <View {...props} />
        </Suspense>
      </ErrorBoundary>
    );
  };
}

/** A lazy region that loads the first time it opens and stays drawn for its close. */
export function lazyOverlay<Module, Name extends keyof Module>(
  region: string,
  load: () => Promise<Module>,
  name: Name
): ComponentType<PropsOf<Module[Name]> & { open: boolean }> {
  const View = lazyRegion(region, load, name);
  return function LazyOverlay(props) {
    const [opened, setOpened] = useState(false);
    if (props.open && !opened) setOpened(true);
    return opened ? <View {...props} /> : null;
  };
}
