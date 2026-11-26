import { REPO_ROOT } from "./source";

export interface GitRun {
  ok: boolean;
  code: number;
  out: string;
  err: string;
}

/** Runs git in `cwd`, the repository by default. */
export function git(args: readonly string[], cwd = REPO_ROOT): GitRun {
  const run = Bun.spawnSync(["git", ...args], { cwd });
  return {
    ok: run.exitCode === 0,
    code: run.exitCode,
    out: run.stdout.toString(),
    err: run.stderr.toString().trim(),
  };
}
