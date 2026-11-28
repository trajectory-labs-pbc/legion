/** Refused storage keeps nothing, so what it would have given is nothing. */
export function quietly<T>(act: () => T): T | undefined {
  try {
    return act();
  } catch {
    return undefined;
  }
}

/** One key of upstream's, by its parameter; a browser that refuses storage keeps nothing. */
function storedKey<Param>(name: (param: Param) => string) {
  return {
    name,
    get: (param: Param) => quietly(() => window.localStorage.getItem(name(param))) ?? undefined,
    remove: (param: Param) => quietly(() => window.localStorage.removeItem(name(param))),
  };
}

/**
 * Upstream's keys, named and written as upstream's code does, so state moves between the apps.
 * The fork's own state is in `src/stores`.
 */
export const upstreamKeys = {
  /** The agents a person pinned in this browser before pins moved to Dispatch, by login. */
  legacyPinnedAgents: storedKey((login: string) => `dispatch.agents.pinned:${login}`),
} as const;
