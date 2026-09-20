// ToggleGroup (Radix, estilo shadcn) — selector de rango del chart.
import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";

import { cn } from "../lib/utils";

const ToggleGroupContext = React.createContext<{
  variant?: "default" | "outline";
}>({ variant: "default" });

function ToggleGroup({
  className,
  variant = "default",
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> & {
  variant?: "default" | "outline";
}) {
  return (
    <ToggleGroupContext.Provider value={{ variant }}>
      <ToggleGroupPrimitive.Root
        data-slot="toggle-group"
        className={cn(
          "flex w-fit items-center rounded-lg border border-line bg-card p-0.5",
          className
        )}
        {...props}
      >
        {children}
      </ToggleGroupPrimitive.Root>
    </ToggleGroupContext.Provider>
  );
}

function ToggleGroupItem({
  className,
  children,
  variant = "default",
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> & {
  variant?: "default" | "outline";
}) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex h-7 min-w-7 flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors outline-none hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand/50 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:text-brand",
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
}

export { ToggleGroup, ToggleGroupItem };
