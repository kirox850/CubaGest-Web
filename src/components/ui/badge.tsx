import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// shadcn/ui Badge
const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-brand/15 text-brand",
        secondary: "bg-slate-200 text-ink dark:bg-slate-700 dark:text-slate-100",
        success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
        warning: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
        destructive: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
        outline: "border border-line text-ink",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
