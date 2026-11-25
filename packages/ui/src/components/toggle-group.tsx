import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { createContext, useContext, useMemo } from "react";
import { toggleVariants } from "#registry/legion/ui/toggle";

type ToggleGroupVariants = VariantProps<typeof toggleVariants>;

const ToggleGroupContext = createContext<ToggleGroupVariants>({
  size: "default",
  variant: "default",
});

function ToggleGroup({
  className,
  variant,
  size,
  children,
  ...props
}: ToggleGroupPrimitive.Props & ToggleGroupVariants) {
  const context = useMemo(() => ({ variant, size }), [variant, size]);
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn("group/toggle-group flex w-fit items-center rounded-md", className)}
      {...props}
    >
      <ToggleGroupContext.Provider value={context}>{children}</ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  );
}

function ToggleGroupItem({
  className,
  variant,
  size,
  ...props
}: TogglePrimitive.Props & ToggleGroupVariants) {
  const context = useContext(ToggleGroupContext);
  const itemVariant = context.variant ?? variant;
  const itemSize = context.size ?? size;
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={itemVariant}
      data-size={itemSize}
      className={cn(
        toggleVariants({ variant: itemVariant, size: itemSize }),
        "min-w-0 shrink-0 rounded-none px-3 focus:z-10 focus-visible:z-10",
        "first:rounded-l-md last:rounded-r-md data-[variant=outline]:border-l-0 data-[variant=outline]:first:border-l",
        className
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
