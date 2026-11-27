import type { ComponentProps } from "react";

import { Glyph } from "#registry/legion/ui/glyph";

/** 0: no level, as three dashes; 1 to 3: that many of three bars; 4: the top level, as a filled
 *  square with an exclamation mark. */
type BarsLevel = 0 | 1 | 2 | 3 | 4;

const BARS = [
  { x: 2, y: 9, height: 5 },
  { x: 6.5, y: 6, height: 8 },
  { x: 11, y: 3, height: 11 },
] as const;

// A square with an exclamation mark cut out of it.
const TOP_LEVEL =
  "M4 1h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V4a3 3 0 0 1 3-3ZM7.25 4v5h1.5V4ZM7.25 10.5V12h1.5v-1.5Z";

/** A level as bars: monochrome, its filled bars in the foreground and the rest a faint track, so
 *  each level reads apart. The caller gives the name a reader hears. */
function BarsGlyph({
  level,
  ...props
}: Omit<ComponentProps<typeof Glyph>, "children"> & { level: BarsLevel }) {
  const dash = level === 0;
  return (
    <Glyph data-level={level} data-slot="bars-glyph" {...props}>
      {level === 4 ? (
        <path className="fill-foreground" d={TOP_LEVEL} fillRule="evenodd" />
      ) : (
        BARS.map((bar, index) => (
          <rect
            className={dash ? "fill-muted-foreground" : index < level ? "fill-foreground" : "fill-track"}
            height={dash ? 1.5 : bar.height}
            key={bar.x}
            rx={dash ? 0.75 : 1}
            width={3}
            x={bar.x}
            y={dash ? 7.25 : bar.y}
          />
        ))
      )}
    </Glyph>
  );
}

export { BarsGlyph, type BarsLevel };
