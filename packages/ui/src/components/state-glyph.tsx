import { cn } from "cn";
import { type ComponentProps, type ReactNode, useId } from "react";

import { Glyph } from "#registry/legion/ui/glyph";

/** The share of the circle a pie fills: a quarter, a half, three quarters, nearly whole. */
type PieLevel = 1 | 2 | 3 | 4;

/** The glyph's shape: a disc with two arrows cut out; a dashed circle, plain or with a dot; an
 *  empty circle; a circle with a pie in it; a disc with a check or a cross cut out. */
type StateShape =
  | { kind: "arrows" | "dashed" | "dashed-dot" | "empty" | "check" | "cross" }
  | { kind: "pie"; level: PieLevel };

// Each pie: a wedge of radius 3.5 from twelve o'clock, clockwise, over 0.25, 0.5, 0.75 and 0.9.
const PIE: Record<PieLevel, string> = {
  1: "M8 8V4.5A3.5 3.5 0 0 1 11.5 8Z",
  2: "M8 8V4.5A3.5 3.5 0 0 1 8 11.5Z",
  3: "M8 8V4.5A3.5 3.5 0 1 1 4.5 8Z",
  4: "M8 8V4.5A3.5 3.5 0 1 1 5.943 5.168Z",
};

// What each disc has cut out of it, drawn as strokes in the mask.
const CUTS: Record<"arrows" | "check" | "cross", string> = {
  arrows: "M4.5 6h6.5M9 4l2 2-2 2M11.5 10H5M7 8l-2 2 2 2",
  check: "M5 8.25 7 10.25 11 6.25",
  cross: "M5.75 5.75l4.5 4.5M10.25 5.75l-4.5 4.5",
};

function Disc({ cut }: { cut: keyof typeof CUTS }) {
  const mask = useId();
  return (
    <>
      <mask id={mask}>
        <rect fill="white" height={16} width={16} />
        <path d={CUTS[cut]} fill="none" stroke="black" strokeLinecap="round" strokeWidth={1.5} />
      </mask>
      <circle className="fill-foreground" cx={8} cy={8} mask={`url(#${mask})`} r={7} />
    </>
  );
}

const Ring = ({ className, dashed }: { className: string; dashed?: boolean }) => (
  <circle
    className={cn("fill-none", className)}
    cx={8}
    cy={8}
    r={6}
    strokeDasharray={dashed ? "2.36 2.36" : undefined}
    strokeWidth={1.5}
  />
);

function shapeOf(shape: StateShape): ReactNode {
  switch (shape.kind) {
    case "arrows":
    case "check":
    case "cross":
      return <Disc cut={shape.kind} />;
    case "dashed":
      return <Ring className="stroke-muted-foreground" dashed />;
    case "dashed-dot":
      return (
        <>
          <Ring className="stroke-muted-foreground" dashed />
          <circle className="fill-muted-foreground" cx={8} cy={8} r={1.5} />
        </>
      );
    case "empty":
      return <Ring className="stroke-muted-foreground" />;
    case "pie":
      return (
        <>
          <Ring className="stroke-foreground" />
          <path className="fill-foreground" d={PIE[shape.level]} />
        </>
      );
  }
}

/** A state as one monochrome glyph whose shape follows a lifecycle. The caller gives the shape and
 *  the name a reader hears. */
function StateGlyph({
  shape,
  ...props
}: Omit<ComponentProps<typeof Glyph>, "children"> & { shape: StateShape }) {
  return (
    <Glyph data-kind={shape.kind} data-slot="state-glyph" {...props}>
      {shapeOf(shape)}
    </Glyph>
  );
}

export { type PieLevel, StateGlyph, type StateShape };
