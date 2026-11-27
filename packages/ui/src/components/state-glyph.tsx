import { cn } from "cn";
import { type ComponentProps, type ReactNode, useId } from "react";

/** The share of the circle a pie fills: a quarter, a half, three quarters, nearly whole. */
type PieLevel = 1 | 2 | 3 | 4;

/** The glyph's shape: a disc with two arrows cut out; a dashed circle, plain or with a dot; an
 *  empty circle; a circle with a pie in it; a disc with a check or a cross cut out. */
type StateShape =
  | { kind: "arrows" | "dashed" | "dashed-dot" | "empty" | "check" | "cross" }
  | { kind: "pie"; level: PieLevel };

const PIE_SHARE: Record<PieLevel, number> = { 1: 0.25, 2: 0.5, 3: 0.75, 4: 0.9 };

const round = (value: number) => Math.round(value * 1000) / 1000;

/** A wedge of the disc of radius 3.5 at the centre, from twelve o'clock clockwise. */
function wedge(share: number): string {
  const angle = share * 2 * Math.PI;
  const x = round(8 + 3.5 * Math.sin(angle));
  const y = round(8 - 3.5 * Math.cos(angle));
  return `M8 8V4.5A3.5 3.5 0 ${share > 0.5 ? 1 : 0} 1 ${x} ${y}Z`;
}

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
          <path className="fill-foreground" d={wedge(PIE_SHARE[shape.level])} />
        </>
      );
  }
}

/** A state as one monochrome glyph whose shape follows a lifecycle. The caller gives the shape and
 *  the name a reader hears. */
function StateGlyph({
  className,
  label,
  shape,
  ...props
}: Omit<ComponentProps<"svg">, "aria-label" | "children" | "role"> & {
  shape: StateShape;
  label: string;
}) {
  return (
    <svg
      aria-label={label}
      data-kind={shape.kind}
      data-slot="state-glyph"
      role="img"
      viewBox="0 0 16 16"
      className={cn("size-3.5 shrink-0", className)}
      {...props}
    >
      {shapeOf(shape)}
    </svg>
  );
}

export { type PieLevel, StateGlyph, type StateShape };
