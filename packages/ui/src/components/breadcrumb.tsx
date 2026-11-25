import { useRender } from "@base-ui/react/use-render";
import { cn } from "cn";
import { ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import type { ComponentProps } from "react";

function Breadcrumb({ "aria-label": ariaLabel = "Breadcrumb", ...props }: ComponentProps<"nav">) {
  return <nav aria-label={ariaLabel} data-slot="breadcrumb" {...props} />;
}

function BreadcrumbList({ className, ...props }: ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-sm break-words text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    />
  );
}

function BreadcrumbLink({ render, className, ...props }: useRender.ComponentProps<"a">) {
  return useRender({
    defaultTagName: "a",
    render,
    props: {
      "data-slot": "breadcrumb-link",
      className: cn(
        "rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        className
      ),
      ...props,
    },
  });
}

function BreadcrumbPage({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      aria-current="page"
      className={cn("font-normal text-foreground", className)}
      {...props}
    />
  );
}

function BreadcrumbSeparator({ children, className, ...props }: ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5", className)}
      {...props}
    >
      {children ?? <ChevronRightIcon />}
    </li>
  );
}

function BreadcrumbEllipsis({
  className,
  label = "More",
  ...props
}: ComponentProps<"span"> & { label?: string }) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      className={cn("flex size-8 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontalIcon aria-hidden="true" className="size-4" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
