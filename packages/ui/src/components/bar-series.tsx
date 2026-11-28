import { cn } from "cn";
import { useId } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "#registry/legion/ui/tooltip";

type BarKind = "neutral" | "met" | "missed";

/** One bar. `empty` has nothing to measure and draws a stub along the floor. */
type BarPoint = {
  /** The bar's text, which also says when the point is partial; the series adds its verdict. */
  label: string;
  /** The point covers only part of its span: drawn faint. */
  partial?: boolean;
} & (
  | { kind: "empty" }
  | {
      kind: BarKind;
      value: number;
      /** A second value drawn faint behind the bar, judged on its own. */
      behind?: { value: number; kind: BarKind };
    }
);

// A neutral bar is the quietest grey that keeps 3:1 on the card, so the status colours lead.
const FILL = {
  neutral: "fill-faint-foreground",
  met: "fill-success",
  missed: "fill-danger",
} as const satisfies Record<BarKind, string>;

const FAINT = {
  neutral: "fill-track",
  met: "fill-success-faint",
  missed: "fill-danger-faint",
} as const satisfies Record<BarKind, string>;

// Upstream's two charts: Sparkbars 28 high with 10-wide bars and a 40 % partial fade, SpreadBars
// 36 high with 12-wide bars and 55 %.
const SIZES = {
  default: { height: 28, barWidth: 10, heightClass: "h-7", partial: "opacity-40" },
  lg: { height: 36, barWidth: 12, heightClass: "h-9", partial: "opacity-55" },
} as const;

const VERDICT = {
  neutral: undefined,
  met: "met",
  missed: "missed",
} as const satisfies Record<BarKind, string | undefined>;

/** A point's text with its verdict in words, so no verdict shows by colour alone. */
function pointText(point: BarPoint): string {
  if (point.kind === "empty") return point.label;
  const bar = VERDICT[point.kind];
  const behind = point.behind === undefined ? undefined : VERDICT[point.behind.kind];
  if (behind !== undefined)
    return `${point.label} (bar ${bar ?? "not judged"}, faint bar ${behind})`;
  return bar === undefined ? point.label : `${point.label} (${bar})`;
}

/** A y coordinate for a value, measured down from the top of a chart `height` tall, on a scale
 *  whose top reaches the floor, a quarter above the target (so its line never sits at the top
 *  edge) and the tallest value. A copy of upstream's features/delivery/lib/barScale.ts. */
function barScale(
  floor: number,
  target: number | undefined,
  values: readonly number[],
  height: number
): (value: number) => number {
  // A scale whose top is 0 has nothing to divide by; its bars all sit on the floor.
  const top = Math.max(floor, target === undefined ? 0 : target * 1.25, ...values) || 1;
  return (value) => height - (value / top) * height;
}

/** Bars from a list of points, one a point, with an optional dashed target line. Monochrome but
 *  for meaning: a bar meets or misses its target in the passed and failed colours. The series is
 *  one image named by `label` and described by its points' texts with their verdicts, which each
 *  bar's tooltip also shows. */
function BarSeries({
  points,
  floor,
  target,
  size = "default",
  label,
  className,
}: {
  points: readonly BarPoint[];
  /** The lowest the scale's top may be; it grows to the tallest value and a quarter above the
   *  target. */
  floor: number;
  /** Where the dashed line is drawn. */
  target?: number;
  size?: keyof typeof SIZES;
  /** The name a reader hears. */
  label: string;
  className?: string;
}) {
  const labelsId = useId();
  const texts = points.map(pointText);
  const { height, barWidth, heightClass, partial } = SIZES[size];
  const width = points.length * barWidth;
  const y = barScale(
    floor,
    target,
    points.flatMap((p) => (p.kind === "empty" ? [] : [p.value, p.behind?.value ?? 0])),
    height
  );
  // A bar reaches from its value to the floor, and is never less than one unit high.
  const bar = (x: number, value: number, fill: string) => {
    const top = Math.min(y(value), height - 1);
    return <rect className={fill} height={height - top} width={barWidth - 2} x={x + 1} y={top} />;
  };
  return (
    <>
      <svg
        aria-describedby={labelsId}
        aria-label={label}
        className={cn("block w-full", heightClass, className)}
        data-slot="bar-series"
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        {points.map((point, index) => {
          const x = index * barWidth;
          // A partial point fades its main mark only: a faded faint bar would fall under 1.8:1.
          const fade = point.partial ? partial : undefined;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: a point is its column, so a live update to its label keeps its open tooltip.
            <Tooltip key={index}>
              <TooltipTrigger render={<g data-kind={point.kind} data-slot="bar-series-point" />}>
                {/* The whole column takes the pointer, so a short bar is as easy to hover. */}
                <rect className="fill-transparent" height={height} width={barWidth} x={x} y={0} />
                {point.kind === "empty" ? (
                  bar(x, 0, cn("fill-muted-foreground", fade))
                ) : (
                  <>
                    {point.behind === undefined
                      ? null
                      : bar(x, point.behind.value, FAINT[point.behind.kind])}
                    {bar(x, point.value, cn(FILL[point.kind], fade))}
                  </>
                )}
              </TooltipTrigger>
              <TooltipContent>{texts[index]}</TooltipContent>
            </Tooltip>
          );
        })}
        {target === undefined ? null : (
          <line
            className="stroke-muted-foreground"
            data-slot="bar-series-target"
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
            x1={0}
            x2={width}
            y1={y(target)}
            y2={y(target)}
          />
        )}
      </svg>
      <ul className="sr-only" data-slot="bar-series-labels" id={labelsId}>
        {texts.map((text, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a point is its column, as in the chart.
          <li key={index}>{text}</li>
        ))}
      </ul>
    </>
  );
}

export { type BarKind, type BarPoint, BarSeries };
