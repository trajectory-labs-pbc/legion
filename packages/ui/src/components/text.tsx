import { useRender } from "@base-ui/react/use-render";
import { cn } from "cn";

import { type TextVariantProps, textVariants } from "#registry/legion/lib/typography";

/** Running text at one step of the type scale: a span, or the element `render` gives. */
function Text({
  className,
  size,
  tone,
  weight,
  render,
  ...props
}: useRender.ComponentProps<"span"> & TextVariantProps) {
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "text",
      className: cn(textVariants({ size, tone, weight }), className),
      ...props,
    },
  });
}

export { Text };
