// Input (estilo shadcn) para el sandbox /blocks.
import * as React from "react";

import { cn } from "../lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border border-input-border bg-input-bg px-3 py-1 text-base text-ink shadow-sm transition-[color,box-shadow] outline-none placeholder:text-muted selection:bg-brand selection:text-white focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  );
}

export { Input };
