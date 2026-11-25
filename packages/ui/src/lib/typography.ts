import { cva, type VariantProps } from "class-variance-authority";

// The one type scale: components take sizes from these recipes, not from raw text classes.

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
      display: "text-xl",
      title: "text-base",
      body: "text-sm",
      caption: "text-xs",
      inherit: "",
    },
    tone: TONE,
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
    },
  },
  defaultVariants: { size: "body" },
});

export type TextVariantProps = VariantProps<typeof textVariants>;
