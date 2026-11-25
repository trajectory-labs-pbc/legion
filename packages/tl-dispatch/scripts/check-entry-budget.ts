import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

/**
 * The entry chunk's limit in bytes. Raise it in the change that needs it, saying why; a page
 * belongs in its own lazy chunk. The entry measured 1,208,769 bytes on 2026-11-25.
 */
export const ENTRY_BUDGET_BYTES =
  1_200_092 + // the package's first commit measured 1,142,944 on 2026-11-24, plus 5%
  24_196; // upstream's search palette, eager so the key typed after $mod+k is the palette's

/** The entry chunk, read as the server reads it: the first script of `/assets/index-*.js`. */
export function entryChunk(indexHtml: string): string {
  for (const match of indexHtml.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) {
    const src = match[1] as string;
    if (/^\/assets\/index-[^/]+\.js$/.test(src)) return src;
  }
  throw new Error("the build's index.html names no /assets/index-*.js script");
}

export interface EntrySize {
  path: string;
  bytes: number;
  gzipBytes: number;
}

export function measureEntry(dist: string): EntrySize {
  const path = entryChunk(readFileSync(join(dist, "index.html"), "utf8"));
  const file = join(dist, path);
  return { path, bytes: statSync(file).size, gzipBytes: gzipSync(readFileSync(file)).length };
}

if (import.meta.main) {
  const dist = join(import.meta.dir, "..", "dist");
  const entry = measureEntry(dist);
  const line = `${entry.path}: ${entry.bytes} bytes (${entry.gzipBytes} gzip); budget ${ENTRY_BUDGET_BYTES}`;
  if (entry.bytes > ENTRY_BUDGET_BYTES) {
    console.error(`over budget: ${line}`);
    process.exit(1);
  }
  console.log(line);
}
