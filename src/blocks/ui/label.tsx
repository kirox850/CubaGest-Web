// Label (estilo shadcn) para el sandbox /blocks — sin mayúsculas forzadas
// (la versión de la app va en uppercase; los bloques la usan normal).
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "../lib/utils";

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex select-none items-center gap-2 text-sm font-medium leading-none text-ink peer-disabled:pointer-events-none peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Label };
