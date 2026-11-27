import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

/**
 * The entry chunk's limit in bytes. Raise it in the change that needs it, saying why; a page
 * belongs in its own lazy chunk.
 */
export const ENTRY_BUDGET_BYTES =
  1_200_092 + // the package's first commit measured 1,142,944 on 2026-11-24, plus 5%
  24_196 + // upstream's search palette, eager so the key typed after $mod+k is the palette's
  140_000 - // the shared code the shell reads grew upstream (tool specs, write store, references)
  7_000; // the new-issue dialog left the entry for its own chunk

/** The entry chunk, read as the server reads it: the first script of `/assets/index-*.js`. */
export function entryChunk(indexHtml: string): string {
  for (const match of indexHtml.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) {
    const src = match[1] as string;
    if (/^\/assets\/index-[^/]+\.js$/.test(src)) return src;
  }
  throw new Error("the build's index.html names no /assets/index-*.js script");
}

/** The chunks the entry imports statically: the page preloads each beside it. */
function preloadedChunks(indexHtml: string): string[] {
  return [...indexHtml.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*>/g)].flatMap((link) => {
    const href = /\bhref="([^"]+)"/.exec(link[0])?.[1];
    return href === undefined ? [] : [href];
  });
}

export interface EntrySize {
  path: string;
  /** The entry chunk and the chunks preloaded with it, together. */
  bytes: number;
  /** For the log only: the budget holds `bytes`. */
  gzipBytes: number;
}

export function measureEntry(dist: string): EntrySize {
  const indexHtml = readFileSync(join(dist, "index.html"), "utf8");
  const path = entryChunk(indexHtml);
  const size = { path, bytes: 0, gzipBytes: 0 };
  // A chunk split out of the entry still loads before first paint, so it counts.
  for (const chunk of [path, ...preloadedChunks(indexHtml)]) {
    const file = join(dist, chunk);
    size.bytes += statSync(file).size;
    size.gzipBytes += gzipSync(readFileSync(file)).length;
  }
  return size;
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
