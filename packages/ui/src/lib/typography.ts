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
      page: "text-xl font-semibold tracking-tight",
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
    },
    tone: TONE,
    weight: {
      medium: "font-medium",
    },
  },
  defaultVariants: { size: "body" },
});

export type TextVariantProps = VariantProps<typeof textVariants>;
