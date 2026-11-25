import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "cn";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        "h-6 w-10",
        "data-checked:bg-primary data-unchecked:bg-input",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 rounded-full bg-background data-checked:translate-x-[calc(100%-2px)] data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
