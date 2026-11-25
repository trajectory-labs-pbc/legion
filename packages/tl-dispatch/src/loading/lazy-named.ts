import { importWhenOnline } from "@upstream-dispatch/features/shell/DeploymentResilience";
import { type ComponentType, type LazyExoticComponent, lazy } from "react";

/** The props of a component; `never` for an export that is not one, which no JSX can then draw. */
export type PropsOf<Export> = Export extends ComponentType<infer Props> ? Props : never;

/**
 * One export of a module whose code is its own chunk. A chunk that fails offline loads again
 * when the network returns; one that fails online rejects.
 */
export function loadNamed<Module, Name extends keyof Module>(
  load: () => Promise<Module>,
  name: Name
): Promise<Module[Name]> {
  return importWhenOnline(load).then((module) => module[name]);
}

/** A module's component, by its export's name, drawn once its chunk arrives. */
export function lazyNamed<Module, Name extends keyof Module>(
  load: () => Promise<Module>,
  name: Name
): LazyExoticComponent<ComponentType<PropsOf<Module[Name]>>> {
  return lazy(() =>
    loadNamed(load, name).then((component) => ({
      default: component as ComponentType<PropsOf<Module[Name]>>,
    }))
  );
}
