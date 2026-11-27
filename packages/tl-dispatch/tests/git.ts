import { REPO_ROOT } from "./source";

export interface GitRun {
  ok: boolean;
  out: string;
  err: string;
}

/** Runs git in the repository. */
export function git(args: readonly string[]): GitRun {
  const run = Bun.spawnSync(["git", ...args], { cwd: REPO_ROOT });
  return {
    ok: run.exitCode === 0,
    out: run.stdout.toString(),
    err: run.stderr.toString().trim(),
  };
}
