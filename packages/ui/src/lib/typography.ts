import { cva, type VariantProps } from "class-variance-authority";

// The one type scale: headings and running text take their sizes from these recipes, not from raw
// text classes. A control (a button, a field) sizes its own label.

const TONE = {
  default: "",
  muted: "text-muted-foreground",
} as const;

export type Tone = keyof typeof TONE;

export const headingVariants = cva("", {
  variants: {
    size: {
      // A record's title wraps, and breaks a long word rather than overflow.
      page: "text-xl font-semibold tracking-tight wrap-anywhere",
      section: "text-base font-semibold tracking-tight",
      group: "text-sm font-semibold tracking-tight",
      label: "text-xs font-medium",
    },
    tone: TONE,
  },
});

export type HeadingSize = NonNullable<VariantProps<typeof headingVariants>["size"]>;

export const textVariants = cva("", {
  variants: {
    size: {
      body: "text-sm",
      caption: "text-xs",
      // A large number, such as a metric's value: its weight and figures are part of its size.
      figure: "text-base font-semibold tabular-nums",
    },
    tone: TONE,
    weight: {
      medium: "font-medium",
    },
  },
  defaultVariants: { size: "body" },
});

export type TextVariantProps = VariantProps<typeof textVariants>;
