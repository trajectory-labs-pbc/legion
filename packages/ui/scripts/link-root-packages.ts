// Links each package the root install provides into a package's node_modules, with its commands,
// so that package's code and upstream's resolve one copy of each (its package.json `rootPackages`).
// Usage: bun scripts/link-root-packages.ts <package directory>
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/** Upstream's web app, which the root install's packages resolve from. */
const upstreamApp = join(import.meta.dir, "../../dispatch");

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === "object" &&
  value !== null &&
  Object.values(value).every((item) => typeof item === "string");

function readManifest(dir: string): object {
  const manifest: unknown = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  if (typeof manifest !== "object" || manifest === null) {
    throw new Error(`${dir}/package.json is not an object`);
  }
  return manifest;
}

/** The packages `pkg` takes from the root install. */
export function rootPackages(pkg: string): string[] {
  const manifest = readManifest(pkg);
  if (!("rootPackages" in manifest) || !isStrings(manifest.rootPackages)) {
    throw new Error(`${pkg}/package.json has no rootPackages list`);
  }
  return manifest.rootPackages;
}

/** The directory Node resolves `name` to from `from`: the first node_modules/<name> upward. */
export function resolvePackageDir(name: string, from: string): string {
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return realpathSync(candidate);
    if (dirname(dir) === dir) break;
  }
  throw new Error(
    `${name} is not installed where ${from} resolves it (no node_modules/${name} there or above): run \`bun install\` at the repository root; if upstream no longer depends on it, move it from rootPackages to the package's dependencies (\`bun add ${name}\`)`
  );
}

/** Each root package's directory, as the root install resolves it. */
export function rootTargets(names: string[], from = upstreamApp): Map<string, string> {
  return new Map(names.map((name) => [name, resolvePackageDir(name, from)]));
}

/** Each package's version, read from its directory. */
export function rootVersions(targets: ReadonlyMap<string, string>): Map<string, string> {
  return new Map(
    [...targets].map(([name, target]) => {
      const manifest = readManifest(target);
      if (!("version" in manifest) || typeof manifest.version !== "string") {
        throw new Error(`${name} has no version`);
      }
      return [name, manifest.version];
    })
  );
}

const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Each root package a lockfile records at another version. Peers are not installed in the package
 * (its bunfig.toml), so such an entry is a version nothing installs.
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

/** The commands a package's `bin` field names, by command. */
function commands(name: string, dir: string): [string, string][] {
  const manifest = readManifest(dir);
  if (!("bin" in manifest)) return [];
  const { bin } = manifest;
  if (typeof bin === "string") return [[name.split("/").at(-1) ?? name, bin]];
  if (isStringRecord(bin)) return Object.entries(bin);
  throw new Error(`${name} has a bin field that is neither a path nor a map of paths`);
}

function link(target: string, path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  rmSync(path, { recursive: true, force: true });
  symlinkSync(relative(dirname(path), target), path);
}

function main(argument: string | undefined): string {
  if (argument === undefined) throw new Error("usage: link-root-packages.ts <package directory>");
  const pkg = resolve(argument);
  const targets = rootTargets(rootPackages(pkg));
  const problems = lockVersionProblems(
    readFileSync(join(pkg, "bun.lock"), "utf8"),
    rootVersions(targets)
  );
  if (problems.length > 0) throw new Error(problems.join("\n"));
  for (const [name, target] of targets) {
    link(target, join(pkg, "node_modules", name));
    for (const [command, file] of commands(name, target)) {
      link(join(target, file), join(pkg, "node_modules/.bin", command));
    }
  }
  return `${targets.size} packages linked from the root install into ${relative(process.cwd(), pkg) || "."}`;
}

if (import.meta.main) {
  try {
    console.log(`link-root-packages: ${main(process.argv[2])}`);
  } catch (error) {
    console.error(`link-root-packages: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
