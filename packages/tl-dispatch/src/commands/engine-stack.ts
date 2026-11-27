import { appKeymap, DIALOG_SCOPE, type Keymap, type KeymapScope } from "@/upstream/keys";

import { focusedOverlays, type LayerSource, type OverlayLayer } from "./focused-overlay";
import type { Catalog, CatalogCommand, OverlayReach } from "./schema";

/** What is open over the page, as last read. */
export interface StackState {
  /**
   * Whether global commands of this reach run under what is open: overlays are open, each ours,
   * and each lets them through. `under-most` runs under a `passthrough` overlay alone;
   * `under-all` under every kind but an alert dialog, which waits for a decision.
   */
  passes(reach: OverlayReach): boolean;
  /** The scopes whose bindings can fire now, innermost last: `dialog` alone while one is open. */
  liveScopes(): readonly KeymapScope[];
}

export interface EngineStack {
  /** Reads the overlays once, for every question asked of the answer. */
  now(): StackState;
  subscribe(listener: () => void): () => void;
}

declare global {
  /** Each key engine's tracker, kept on the window so a hot reload of this module finds it. */
  var __tlDispatchEngineStacks: WeakMap<Keymap, EngineStack> | undefined;
}

globalThis.__tlDispatchEngineStacks ??= new WeakMap();
const trackers = globalThis.__tlDispatchEngineStacks;

/**
 * Follows the key engine's scope stack and the overlays over the page. While an overlay of ours
 * is open, one dialog scope is on the engine's stack, so the page's keys and the global ones
 * stop under it. Every other push is upstream's, seen by wrapping the engine's `pushScope`,
 * which upstream's hooks call. The wrap happens once per engine: a second call returns the
 * first tracker.
 */
export function trackEngineStack(keymap: Keymap, layers: LayerSource): EngineStack {
  const existing = trackers.get(keymap);
  // A tracker an older copy of this module built may lack a method; rebuild it.
  if (existing !== undefined && "now" in existing) return existing;
  const upstream: KeymapScope[] = [];
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const push = keymap.pushScope;
  keymap.pushScope = (scope) => {
    const pop = push(scope);
    upstream.push(scope);
    notify();
    let popped = false;
    return () => {
      // Upstream's pop removes the last entry of the scope, whoever pushed it.
      if (popped) return;
      popped = true;
      pop();
      upstream.splice(upstream.lastIndexOf(scope), 1);
      notify();
    };
  };

  let ours: readonly OverlayLayer[] = [];
  let popOurs: (() => void) | undefined;
  /**
   * Reads the overlays again and tells nobody: a read may run in a render. Removing an overlay
   * fires no event, so every read of the stack starts here.
   */
  const read = () => {
    const open = layers.get();
    if (open.length === ours.length && open.every((layer, index) => layer === ours[index])) return;
    ours = open;
    if (open.length > 0 && popOurs === undefined) popOurs = push(DIALOG_SCOPE);
    if (open.length === 0 && popOurs !== undefined) {
      popOurs();
      popOurs = undefined;
    }
  };
  read();
  /** The overlays the listeners last heard of: a render's read may have seen newer ones. */
  let told = ours;
  const sync = () => {
    read();
    if (told === ours) return;
    told = ours;
    notify();
  };
  layers.subscribe(sync);
  // Before the engine picks the scopes a key press consults.
  const handleKeyDown = keymap.handleKeyDown;
  keymap.handleKeyDown = (event) => {
    sync();
    return handleKeyDown(event);
  };

  const upstreamDialog = () => upstream.includes(DIALOG_SCOPE);
  const state: StackState = {
    passes: (reach) =>
      !upstreamDialog() &&
      ours.length > 0 &&
      ours.every(({ kind }) =>
        reach === "under-all" ? kind !== "alert-dialog" : kind === "passthrough"
      ),
    liveScopes() {
      if (upstreamDialog() || ours.length > 0) return [DIALOG_SCOPE];
      // The engine reads a scope pushed twice at its last place, so keep that one.
      const scopes: KeymapScope[] = ["global", ...upstream];
      return scopes.filter((scope, index) => scopes.lastIndexOf(scope) === index);
    },
  };
  const now = () => {
    read();
    return state;
  };
  const tracker: EngineStack = {
    now,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  trackers.set(keymap, tracker);
  return tracker;
}

/** The app's key engine, followed from the first import of the commands, before any dialog opens. */
export const appStack = trackEngineStack(appKeymap, focusedOverlays);

/**
 * Whether a command's keys run with the overlays open now: its scope is live, or it is a global
 * command whose copy reaches under them.
 */
export function keysReach(catalog: Catalog, command: CatalogCommand, stack: EngineStack): boolean {
  const { scope } = catalog.context(command.context);
  const now = stack.now();
  if (now.liveScopes().includes(scope)) return true;
  return scope === "global" && now.passes(command.overlays ?? "under-most");
}

/** The reaches that pass now, as one string, so a change re-renders and nothing else does. */
export function passing(stack: EngineStack): string {
  const now = stack.now();
  return (["under-most", "under-all"] as const).filter((reach) => now.passes(reach)).join(" ");
}
