// Links each package the root install provides into this package's node_modules, with its commands,
// so this package's code and upstream's resolve one copy of each (package.json `rootPackages`).
import { mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import {
  lockVersionProblems,
  resolvePackageDir,
  rootPackages,
  rootVersions,
  upstreamApp,
} from "./root-packages";

const pkg = join(import.meta.dir, "..");

function fail(message: string): never {
  console.error(`link-root-packages: ${message}`);
  process.exit(1);
}

function link(target: string, path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  rmSync(path, { recursive: true, force: true });
  symlinkSync(relative(dirname(path), target), path);
}

const names = rootPackages();
let targets: string[];
try {
  targets = names.map((name) => resolvePackageDir(name, upstreamApp));
} catch (error) {
  fail((error as Error).message);
}
const problems = lockVersionProblems(readFileSync(join(pkg, "bun.lock"), "utf8"), rootVersions());
if (problems.length > 0) fail(problems.join("\n"));

names.forEach((name, index) => {
  const target = targets[index] as string;
  link(target, join(pkg, "node_modules", name));
  const { bin } = JSON.parse(readFileSync(join(target, "package.json"), "utf8")) as {
    bin?: string | Record<string, string>;
  };
  const commands =
    typeof bin === "string" ? { [name.split("/").at(-1) ?? name]: bin } : (bin ?? {});
  for (const [command, file] of Object.entries(commands)) {
    link(join(target, file), join(pkg, "node_modules/.bin", command));
  }
});
console.log(`link-root-packages: ${names.length} packages linked from the root install`);
