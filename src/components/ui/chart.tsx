import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

// ─── Chart (estilo shadcn/ui) ────────────────────────────────────────────────
// Implementación propia inspirada en components/ui/chart de shadcn: resuelve
// los colores de cada serie vía variables CSS (--color-<key>) que todo el
// árbol del gráfico hereda, y da un tooltip accesible y responsive.
// Sin CSS-in-JS: los estilos del gráfico viven en index.css.

// Formato compacto para ejes: 1234 → "1,2k"
export const compact = (n: number) =>
  Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1).replace(".0", "").replace(".", ",")}k` : `${Math.round(n)}`;

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
    color?: string;
  };
};

type ChartContextProps = { config: ChartConfig };

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context;
}

// Inyecta las variables --color-<serie> para que recharts y el tooltip
// las hereden (mismo mecanismo que shadcn).
const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorMap = Object.entries(config).filter(([, v]) => v.color);
  if (!colorMap.length) return null;
  const cssVars = colorMap.map(([key, v]) => `--color-${key}:${v.color};`).join("");
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart=${id}] { ${cssVars} }`,
      }}
    />
  );
};

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { config: ChartConfig; id: string }
>(({ className, children, config, id, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-chart={id}
      className={cn(
        "flex justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted [&_.recharts-cartesian-grid-line]:stroke-line",
        className
      )}
      {...props}
    >
      <ChartContext.Provider value={{ config }}>
        <ChartStyle id={id} config={config} />
        <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </RechartsPrimitive.ResponsiveContainer>
      </ChartContext.Provider>
    </div>
  );
});
ChartContainer.displayName = "ChartContainer";

// ─── Tooltip ────────────────────────────────────────────────────────────────
type ChartTooltipContentProps = {
  active?: boolean;
  className?: string;
  payload?: any[];
  label?: any;
  labelFormatter?: (label: any, payload: any[]) => React.ReactNode;
  valueFormatter?: (value: number, name: string) => React.ReactNode;
  hideLabel?: boolean;
  indicator?: "dot" | "line";
};

const ChartTooltipContent = React.forwardRef<HTMLDivElement, ChartTooltipContentProps>(
  (
    { active, payload, className, label, labelFormatter, valueFormatter, indicator = "dot", hideLabel = false },
    ref
  ) => {
    const { config } = useChart();
    if (!active || !payload?.length) return null;
    const items = payload.filter((p: any) => p.value !== undefined && p.value !== null);
    if (!items.length) return null;

    const formattedLabel =
      !hideLabel && label !== undefined && label !== ""
        ? labelFormatter
          ? labelFormatter(label, payload)
          : String(label)
        : null;

    return (
      <div
        ref={ref}
        className={cn(
          "border-line/60 bg-card/95 text-ink grid min-w-[8rem] items-start gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs shadow-xl",
          className
        )}
      >
        {formattedLabel !== null && <div className="font-semibold">{formattedLabel}</div>}
        <div className="grid gap-1.5">
          {items.map((item: any, index: number) => {
            const key = String(item.dataKey || item.name || "");
            const cfg = config[key] || {};
            const color = item.color || item.stroke || cfg.color || "var(--color-brand)";
            const value = Number(item.value);
            return (
              <div
                key={`${key}-${index}`}
                className="flex w-full items-center justify-between gap-4 leading-none"
              >
                <div className="flex items-center gap-1.5">
                  {indicator === "dot" ? (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                      style={{ background: color, outline: `3px solid ${color}30` }}
                    />
                  ) : (
                    <span className="h-2.5 w-1 shrink-0 rounded-[2px]" style={{ background: color }} />
                  )}
                  <span className="text-muted">{cfg.label || key}</span>
                </div>
                <span className="font-mono font-bold tabular-nums">
                  {valueFormatter
                    ? valueFormatter(value, key)
                    : value.toLocaleString("es-CU", { maximumFractionDigits: 2 })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);
ChartTooltipContent.displayName = "ChartTooltipContent";

const ChartTooltip = RechartsPrimitive.Tooltip;

export { ChartContainer, ChartStyle, ChartTooltip, ChartTooltipContent, useChart, compact };
