// Throwaway (not for merge): the priority glyph on each surface it sits on, before and after the track.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import type { CSSProperties } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BarsGlyph, type BarsLevel } from "../src/components/bars-glyph";

const src = join(import.meta.dirname, "../src");
const globals = join(src, "styles/globals.css");
const css = readFileSync(globals, "utf8").replace(
  '@import "./theme.css";',
  readFileSync(join(src, "styles/theme.css"), "utf8")
);

const SURFACES = [
  ["bg-background", "background (page)"],
  ["bg-card", "card (content panel)"],
  ["bg-popover", "popover"],
  ["bg-secondary", "secondary (highlighted row)"],
  ["bg-muted", "muted (selected row)"],
  ["bg-accent", "accent (selected + highlighted)"],
] as const;
const LEVELS: BarsLevel[] = [0, 3, 2, 1, 4];
const PAGE = [
  "flex", "flex-col", "gap-4", "p-6", "font-sans", "text-sm", "text-foreground", "text-muted-foreground",
  "grid", "grid-cols-[220px_repeat(2,auto)]", "items-center", "gap-x-8", "gap-y-0", "gap-3", "gap-2",
  "h-9", "px-3", "w-fit", "rounded-md", "border", "border-border", "font-medium", "size-10", "size-3.5",
  ...SURFACES.map(([bg]) => bg),
];

const before = { "--track": "var(--muted-foreground)" } as CSSProperties;

function Row({ big }: { big?: boolean }) {
  return (
    <div className="flex gap-3">
      {LEVELS.map((level) => (
        <BarsGlyph className={big ? "size-10" : undefined} key={level} label={`Level ${level}`} level={level} />
      ))}
    </div>
  );
}

function Page({ scheme }: { scheme: string }) {
  return (
    <div className="flex flex-col gap-4 p-6 bg-background text-foreground font-sans text-sm w-fit">
      <div className="font-medium">
        {scheme}: levels none, 3, 2, 1, top — before (muted-foreground) and after (track)
      </div>
      <div className="grid grid-cols-[220px_repeat(2,auto)] items-center gap-x-8 rounded-md border border-border">
        <div className="h-9 px-3 flex items-center text-muted-foreground">Surface</div>
        <div className="h-9 px-3 flex items-center text-muted-foreground">Before</div>
        <div className="h-9 px-3 flex items-center text-muted-foreground">After</div>
        {SURFACES.map(([bg, name]) => [
          <div className={`h-9 px-3 flex items-center ${bg}`} key={`${bg}n`}>{name}</div>,
          <div className={`h-9 px-3 flex items-center ${bg}`} key={`${bg}b`} style={before}><Row /></div>,
          <div className={`h-9 px-3 flex items-center ${bg}`} key={`${bg}a`}><Row /></div>,
        ])}
      </div>
      <div className="flex gap-8 bg-card p-6 rounded-md border border-border w-fit">
        <div className="flex flex-col gap-2" style={before}><span className="text-muted-foreground">Before, 40 px</span><Row big /></div>
        <div className="flex flex-col gap-2"><span className="text-muted-foreground">After, 40 px</span><Row big /></div>
      </div>
    </div>
  );
}

const compiler = await compile(css, { base: dirname(globals), from: globals, onDependency: () => {} });
const candidates = new Scanner({ sources: compiler.sources }).scan();
const styles = compiler.build([...candidates, ...PAGE]);
const out = process.argv[2] ?? "shots";
mkdirSync(out, { recursive: true });
for (const scheme of ["light", "dark"]) {
  const body = renderToStaticMarkup(<Page scheme={scheme === "light" ? "Light" : "Dark"} />);
  writeFileSync(
    join(out, `${scheme}.html`),
    `<!doctype html><html class="${scheme}"><head><meta charset="utf-8"><style>${styles}</style></head><body class="bg-background m-0">${body}</body></html>`
  );
}
