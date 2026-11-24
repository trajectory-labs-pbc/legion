// The packages this app takes from the root install (package.json `rootPackages`): where Node
// resolves each from upstream's web app, and whether this app's lockfile agrees with them.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";

const app = join(import.meta.dir, "..");
export const upstreamApp = join(app, "../dispatch");

export function rootPackages(): string[] {
  return (JSON.parse(readFileSync(join(app, "package.json"), "utf8")) as { rootPackages: string[] })
    .rootPackages;
}

/** The directory Node resolves `name` to from `from`: the first node_modules/<name> upward. */
export function resolvePackageDir(name: string, from: string): string {
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return realpathSync(candidate);
    if (dirname(dir) === dir) break;
  }
  throw new Error(
    `${name} is not installed where ${from} resolves it (no node_modules/${name} there or above): run \`bun install\` at the repository root; if upstream no longer depends on it, move it from rootPackages to this app's dependencies (\`bun add ${name}\`)`
  );
}

/** Each root package's version, as the root install has it. */
export function rootVersions(names = rootPackages(), from = upstreamApp): Map<string, string> {
  return new Map(
    names.map((name) => {
      const dir = resolvePackageDir(name, from);
      const { version } = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
        version: string;
      };
      return [name, version];
    })
  );
}

const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Each root package this app's lockfile records at another version. Peers are not installed here
 * (bunfig.toml), so such an entry is a version nothing installs.
 */
export function lockVersionProblems(lock: string, versions: ReadonlyMap<string, string>): string[] {
  const problems: string[] = [];
  for (const [name, version] of versions) {
    const recorded = new RegExp(`^\\s+"${literal(name)}": \\["${literal(name)}@([^"]+)"`, "m").exec(
      lock
    )?.[1];
    if (recorded !== undefined && recorded !== version) {
      problems.push(
        `bun.lock records ${name}@${recorded}, which nothing installs, and the root install has ${version}: set "overrides": {"${name}": "${version}"} in package.json and run \`bun install\``
      );
    }
  }
  return problems;
}
