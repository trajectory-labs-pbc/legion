// Links each package the root install provides into this app's node_modules, with its commands,
// so this app's code and upstream's resolve one copy of each (package.json `rootPackages`).
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const app = join(import.meta.dir, "..");
const source = join(app, "../dispatch/node_modules");
const { rootPackages } = JSON.parse(readFileSync(join(app, "package.json"), "utf8")) as {
  rootPackages: string[];
};

const missing = rootPackages.filter((name) => !existsSync(join(source, name)));
if (missing.length > 0) {
  console.error(
    `link-root-packages: ${missing.join(", ")} not in ${source}: run \`bun install\` at the repository root first`
  );
  process.exit(1);
}

function link(target: string, path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  rmSync(path, { recursive: true, force: true });
  symlinkSync(relative(dirname(path), target), path);
}

for (const name of rootPackages) {
  const target = realpathSync(join(source, name));
  link(target, join(app, "node_modules", name));
  const { bin } = JSON.parse(readFileSync(join(target, "package.json"), "utf8")) as {
    bin?: string | Record<string, string>;
  };
  const commands =
    typeof bin === "string" ? { [name.split("/").at(-1) ?? name]: bin } : (bin ?? {});
  for (const [command, file] of Object.entries(commands)) {
    link(join(target, file), join(app, "node_modules/.bin", command));
  }
}
console.log(`link-root-packages: ${rootPackages.length} packages linked from the root install`);
