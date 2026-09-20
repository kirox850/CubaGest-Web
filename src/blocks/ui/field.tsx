// Field primitives (shadcn v4) — composición de formularios de los bloques.
import * as React from "react";

import { cn } from "../lib/utils";

function Field({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field"
      className={cn("flex flex-col gap-5", className)}
      {...props}
    />
  );
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn("flex flex-col gap-7", className)}
      {...props}
    />
  );
}

function FieldLabel({
  className,
  children,
  ...props
}: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="field-label"
      className={cn(
        "text-sm font-medium leading-none text-ink select-none",
        className
      )}
      {...props}
    >
      {children}
    </label>
  );
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-sm leading-normal font-normal text-muted", className)}
      {...props}
    />
  );
}

function FieldSeparator({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-separator"
      className={cn("flex items-center gap-3", className)}
      {...props}
    >
      <div className="h-px flex-1 bg-line" />
      {children ? (
        <span className="text-xs whitespace-nowrap text-muted">{children}</span>
      ) : null}
      <div className="h-px flex-1 bg-line" />
    </div>
  );
}

export { Field, FieldGroup, FieldLabel, FieldDescription, FieldSeparator };
