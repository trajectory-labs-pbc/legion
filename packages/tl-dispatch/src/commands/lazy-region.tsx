import { importWhenOnline } from "@upstream-dispatch/features/shell/DeploymentResilience";
import { ErrorBoundary } from "@upstream-dispatch/features/shell/ErrorBoundary";
import { type ComponentType, lazy, Suspense } from "react";

/**
 * A component whose code is its own chunk, drawn as nothing until it arrives. A chunk that fails
 * offline loads again when the network returns; one that fails online shows the region's error
 * in its place, and the rest of the app stays.
 */
export function lazyRegion<Props extends object>(
  region: string,
  load: () => Promise<ComponentType<Props>>
): ComponentType<Props> {
  const View = lazy(() => importWhenOnline(load).then((component) => ({ default: component })));
  return function LazyRegion(props: Props) {
    return (
      <ErrorBoundary region={region}>
        <Suspense fallback={null}>
          <View {...props} />
        </Suspense>
      </ErrorBoundary>
    );
  };
}
