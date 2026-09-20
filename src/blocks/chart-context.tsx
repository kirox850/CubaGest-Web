// Puente entre el sandbox /blocks y components/ui/chart del proyecto.
// Re-exporta el tooltip real y envuelve ChartContainer para que `id` sea
// opcional (los bloques no lo pasan; se auto-genera y se sanea para CSS).
import * as React from "react";

import {
  ChartContainer as AppChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

function ChartContainer({
  config,
  id,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  id?: string;
}) {
  const autoId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <AppChartContainer
      config={config}
      id={id || `bk${autoId}`}
      className={className}
      {...props}
    >
      {children as React.ReactElement}
    </AppChartContainer>
  );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig };
