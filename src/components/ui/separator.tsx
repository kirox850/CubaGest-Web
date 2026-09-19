import * as React from "react";

import { cn } from "@/lib/utils";

// Línea divisoria horizontal
const Separator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("h-px w-full shrink-0 bg-line", className)}
    {...props}
  />
));
Separator.displayName = "Separator";

export { Separator };
