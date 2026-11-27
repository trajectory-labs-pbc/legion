/** How a value is written as text and read back. */
interface Format<T> {
  read(text: string): T;
  write(value: T): string;
}

const text: Format<string> = { read: (stored) => stored, write: (value) => value };
const flag: Format<boolean> = { read: (stored) => stored === "true", write: String };

/** One key this browser keeps, by its parameter; a browser that refuses storage keeps nothing. */
export interface StoredKey<Param, Value> {
  /** The name the value is stored under. */
  readonly name: (param: Param) => string;
  get(param: Param): Value | undefined;
  set(param: Param, value: Value): void;
  remove(param: Param): void;
}

/** Refused storage keeps nothing, so what it would have given is nothing. */
function quietly<T>(act: () => T): T | undefined {
  try {
    return act();
  } catch {
    return undefined;
  }
}

function storedKey<Param, Value>(
  name: (param: Param) => string,
  format: Format<Value>
): StoredKey<Param, Value> {
  return {
    name,
    get(param) {
      const stored = quietly(() => window.localStorage.getItem(name(param)));
      return stored == null ? undefined : format.read(stored);
    },
    set(param, value) {
      quietly(() => window.localStorage.setItem(name(param), format.write(value)));
    },
    remove(param) {
      quietly(() => window.localStorage.removeItem(name(param)));
    },
  };
}

/** The prefix of each key of the fork's own, so none meets a key of upstream's. */
export const FORK_PREFIX = "tl-dispatch.";

const forkKey = <Param, Value>(name: (param: Param) => string, format: Format<Value>) =>
  storedKey((param: Param) => `${FORK_PREFIX}${name(param)}`, format);

/** Upstream's keys, named and written as upstream's code does, so state moves between the apps. */
export const upstreamKeys = {
  /** The agents a person pinned in this browser before pins moved to Dispatch, by login. */
  legacyPinnedAgents: storedKey((login: string) => `dispatch.agents.pinned:${login}`, text),
} as const;

/** The fork's own keys, each under the fork's prefix. */
export const forkKeys = {
  /** Whether a sidebar section is folded, by its heading. */
  sidebarFolded: forkKey((heading: string) => `sidebar.folded.${heading}`, flag),
} as const;
