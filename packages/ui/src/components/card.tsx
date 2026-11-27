import { cn } from "cn";
import type { ComponentProps } from "react";
import { textVariants } from "#registry/legion/lib/typography";
import { Heading, type HeadingProps, HeadingSection } from "#registry/legion/ui/heading";

function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-4 rounded-lg border bg-card py-4 text-card-foreground",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-4 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-4",
        className
      )}
      {...props}
    />
  );
}

function CardTitle(props: Omit<HeadingProps, "size">) {
  return <Heading data-slot="card-title" size="section" {...props} />;
}

function CardDescription({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn(textVariants({ tone: "muted" }), className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

/** The content's headings rank one level under `CardTitle`. */
function CardContent({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="card-content" className={cn("px-4", className)} {...props}>
      <HeadingSection>{children}</HeadingSection>
    </div>
  );
}

function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-4 [.border-t]:pt-4", className)}
      {...props}
    />
  );
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
