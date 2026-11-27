import { cn } from "cn";
import type { ComponentProps } from "react";
import { textVariants } from "#registry/legion/lib/typography";

function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto overflow-y-hidden">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={className} {...props} />;
}

function TableFooter({ className, ...props }: ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t bg-muted/50 font-medium", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "group/row in-data-[slot=table-body]:not-in-aria-busy:hover:bg-secondary has-aria-expanded:bg-muted aria-selected:bg-muted",
        className
      )}
      {...props}
    />
  );
}

/** `numeric` right-aligns a column of numbers in tabular figures: set it on its head and its cells. */
type Numeric = { numeric?: boolean };

const NUMERIC = "text-right tabular-nums";

function TableHead({ className, numeric, ...props }: ComponentProps<"th"> & Numeric) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-row px-2.5 text-left align-middle font-medium whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0",
        numeric && NUMERIC,
        className
      )}
      {...props}
    />
  );
}

function TableCell({ className, numeric, ...props }: ComponentProps<"td"> & Numeric) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "h-row px-2.5 py-1.5 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        numeric && NUMERIC,
        className
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4", textVariants({ tone: "muted" }), className)}
      {...props}
    />
  );
}

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
