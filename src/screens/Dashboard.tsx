import { useState, useEffect } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { apiFetch } from "@/lib/api";
import { fmt } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useOnlineStatus } from "@/hooks/useOnline";
import { ROLES } from "@/config/constants";
import Icon from "@/components/shared/Icon";
import { Spinner } from "@/components/shared/primitives";

// ─── Gráfico de área interactivo (estilo shadcn) ─────────────────────────────
// Una serie por moneda (nunca se convierten entre sí). "Todas" suma las
// monedas por día SOLO para dibujar la curva — el detalle real por moneda
// está en las tarjetas de arriba y en el selector.
const RANGE_OPTIONS = [
  { value: "7d", label: "Últimos 7 días", days: 7 },
  { value: "30d", label: "Últimos 30 días", days: 30 },
  { value: "90d", label: "Últimos 3 meses", days: 90 },
  { value: "180d", label: "Últimos 6 meses", days: 180 },
];

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("es", { day: "numeric", month: "short" });

const curSymbol = (c: string) => (c === "EUR" ? "€" : "$" );

const SalesAreaChart = ({ analytics, fallback, range, onRange, cur, onCur }: {
  analytics: any;
  fallback: { date: string; total: number }[];
  range: string;
  onRange: (r: string) => void;
  cur: string;
  onCur: (c: string) => void;
}) => {
  const currencies: string[] = analytics?.currencies?.length
    ? analytics.currencies
    : Object.keys(analytics?.trend30ByCurrency || {});
  const byCur = analytics?.trend30ByCurrency || {};
  const series: { date: string; total: number }[] =
    cur === "all"
      ? (analytics?.trend30 || []).map((d: any) => ({ ...d }))
      : (byCur[cur] || []);
  const hasData = series.some((d) => d.total > 0);
  const rangeLabel = RANGE_OPTIONS.find((r) => r.value === range)?.label || "";

  const chartConfig: ChartConfig = {
    total: { label: cur === "all" ? "Todas las monedas" : cur, color: "#3B82F6" },
  };
  const chartId = `sales-${cur}`.replace(/[^a-zA-Z0-9-]/g, "");
  const gradId = `fill-${chartId}`;

  return (
    <div style={{ background:"var(--card)", borderRadius:16, border:"1px solid var(--line)", padding:20 }}>
      <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"flex-start", justifyContent:"space-between", marginBottom:12 }}>
        <div>
          <h3 style={{ margin:"0 0 2px", fontSize:15, fontWeight:800, color:"var(--ink)" }}>Ingresos por día</h3>
          <p style={{ margin:0, fontSize:12, color:"var(--muted)" }}>
            {rangeLabel}{cur !== "all" ? ` · solo ${cur}` : ""}
          </p>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {currencies.length > 1 && (
            <Select value={cur} onValueChange={onCur}>
              <SelectTrigger className="w-[160px]" aria-label="Moneda">
                <SelectValue placeholder="Moneda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las monedas</SelectItem>
                {currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={range} onValueChange={onRange}>
            <SelectTrigger className="w-[160px]" aria-label="Rango">
              <SelectValue placeholder={rangeLabel} />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {hasData ? (
        <ChartContainer config={chartConfig} id={chartId} className="h-[260px] w-full">
          <AreaChart data={series} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-total)" stopOpacity={1} />
                <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={28}
              tickFormatter={(v: string) => dayLabel(v)}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(l: any) => dayLabel(String(l))}
                  valueFormatter={(v: number) => `${cur === "all" ? "" : curSymbol(cur)}${fmt(v)}`}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="total"
              type="natural"
              stroke="var(--color-total)"
              strokeWidth={2}
              fill={`url(#${gradId})`}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ChartContainer>
      ) : analytics ? (
        <p style={{ padding:"40px 0", textAlign:"center", fontSize:13, color:"var(--muted)" }}>
          Aún no hay ventas registradas en este período.
        </p>
      ) : fallback.length > 0 ? (
        <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:90 }}>
          {fallback.map((d) => (
            <div key={d.date} style={{ flex:1, textAlign:"center" }} title={`${d.date}: ${fmt(d.total)}`}>
              <div style={{ height:Math.max(4, (d.total / Math.max(1, ...fallback.map((x) => x.total))) * 70), background:"#3B82F6", borderRadius:4, margin:"0 auto", width:"60%" }} />
              <div style={{ fontSize:9, color:"var(--muted)", marginTop:4 }}>{d.date.slice(5)}</div>
            </div>
          ))}
        </div>
      ) : null}

      {cur === "all" && hasData && (
        <p style={{ margin:"10px 0 0", fontSize:11, color:"var(--muted)" }}>
          La curva suma las monedas para la tendencia; selecciona una moneda para verla aislada (nunca se convierten entre sí).
        </p>
      )}
    </div>
  );
};

// ─── DASHBOARD (con analítica de negocio) ─────────────────────────────────────
const Dashboard = ({ user }: { user: any }) => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const dashOnline = useOnlineStatus();

  useEffect(() => {
    if (dashOnline) {
      apiFetch("/dashboard/summary")
        .then(d => {
          setSummary(d);
          // Cache dashboard data
          localStorage.setItem('cubagest_dashboard', JSON.stringify({ data: d, cachedAt: Date.now() }));
          setLoading(false);
        })
        .catch(e => {
          // Try cache
          const cached = localStorage.getItem('cubagest_dashboard');
          if (cached) {
            const { data, cachedAt } = JSON.parse(cached);
            setSummary(data);
            setError(`Datos del ${new Date(cachedAt).toLocaleDateString("es-CU")}`);
          } else {
            setError(e.message);
          }
          setLoading(false);
        });
    } else {
      const cached = localStorage.getItem('cubagest_dashboard');
      if (cached) {
        const { data, cachedAt } = JSON.parse(cached);
        setSummary(data);
        setError(`Sin conexión · Datos del ${new Date(cachedAt).toLocaleDateString("es-CU")}`);
      } else {
        setError("Sin conexión y sin datos cacheados");
      }
      setLoading(false);
    }
  }, [dashOnline]);

  // Analítica (mes vs mes, top productos, tendencia, muertos) — hook ANTES de
  // cualquier return condicional para respetar las reglas de React.
  const [analytics, setAnalytics] = useState<any>(null);
  // Rango y moneda del gráfico interactivo — cambiar el rango recarga la
  // analítica pidiendo ?days=N al backend.
  const [range, setRange] = useState("30d");
  const [cur, setCur] = useState("all");
  useEffect(() => {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 180;
    apiFetch(`/dashboard/analytics?days=${days}`).then(setAnalytics).catch(() => {});
  }, [range]);

  if (loading) return <Spinner/>;
  if (!summary && error) return <div style={{ color:"#3B82F6", padding:24 }}>Error: {error}</div>;
  if (!summary) return null;

  const byCurrency: Record<string, { revenue: number; expenses: number }> = summary?.byCurrency || {};
  const salesCount: number = summary?.salesCount || 0;
  const lowStockProducts: any[] = summary?.lowStock || [];
  const todayCount: number = summary?.todaySalesCount || 0;
  const chartDays: { date: string; total: number }[] = summary?.chartDays || [];

  const StatCard = ({ label, value, sub, color, icon }: any) => (
    <div style={{ background:"var(--card)", borderRadius:16, padding:"22px 24px", border:"1px solid var(--line)", display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <p style={{ margin:0, fontSize:12, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.5px" }}>{label}</p>
          <p style={{ margin:"6px 0 0", fontSize:24, fontWeight:800, color:color||"var(--ink)", letterSpacing:"-0.5px" }}>{value}</p>
        </div>
        <div style={{ width:42, height:42, background:(color||"#3B82F6")+"15", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Icon name={icon} size={20} color={color||"#3B82F6"}/>
        </div>
      </div>
      {sub && <p style={{ margin:0, fontSize:12, color:"var(--muted)" }}>{sub}</p>}
    </div>
  );

  const rev = analytics?.revenueByCurrency || {};

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      <div>
        <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:800, color:"var(--ink)" }}>Panel Principal</h2>
        <p style={{ margin:0, fontSize:14, color:"var(--muted)" }}>Bienvenido, {user.name} · {ROLES[user.role]?.label}</p>
        {error && <p style={{ margin:"4px 0 0", fontSize:12, color:"#F97316" }}>⚡ {error}</p>}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:16 }}>
        <StatCard label="Ventas de Hoy" value={`${todayCount}`} sub={`${fmt(summary?.todaySalesTotal||0)} en el día`} color="#10B981" icon="pos"/>
        <StatCard label="Facturas Emitidas" value={`${salesCount}`} sub="Histórico total" color="#3B82F6" icon="facturacion"/>
        <StatCard label="Alertas de Stock" value={lowStockProducts.length} sub={lowStockProducts.length ? lowStockProducts.map((p:any)=>p.name).join(", ").slice(0,60) : "Todos los productos OK"} color={lowStockProducts.length?"#F97316":"#10B981"} icon="alert"/>
      </div>

      {/* Ingresos/gastos POR MONEDA — nunca se convierten entre sí */}
      {Object.keys(byCurrency).length > 0 && (
        <div>
          <h3 style={{ margin:"0 0 10px", fontSize:15, fontWeight:800, color:"var(--ink)" }}>Ingresos y gastos por moneda</h3>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12 }}>
            {Object.entries(byCurrency).map(([cur, v]) => (
              <div key={cur} style={{ background:"var(--card)", borderRadius:14, border:"1px solid var(--line)", padding:"14px 16px" }}>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--muted)", marginBottom:6 }}>{cur}</div>
                <div style={{ fontSize:20, fontWeight:800, color:"#10B981" }}>{cur==="EUR"?"€":"$"}{fmt(v.revenue)}</div>
                <div style={{ fontSize:12, color:"#3B82F6", marginTop:2 }}>Gastos: {cur==="EUR"?"€":"$"}{fmt(v.expenses)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráfico interactivo de área (estilo shadcn) con datos reales */}
      <SalesAreaChart analytics={analytics} fallback={chartDays} range={range} onRange={setRange} cur={cur} onCur={setCur} />

      {/* Analítica — inteligencia de negocio */}
      {analytics && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:16 }}>
          <div style={{ background:"var(--card)", borderRadius:16, border:"1px solid var(--line)", padding:20 }}>
            <h3 style={{ margin:"0 0 12px", fontSize:15, fontWeight:800, color:"var(--ink)" }}>Mes vs. mes anterior</h3>
            {Object.entries(rev).map(([cur, v]: any) => (
              <div key={cur} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:"1px solid var(--line)" }}>
                <div>
                  <strong style={{ fontSize:14 }}>{cur}</strong>
                  <div style={{ fontSize:11, color:"var(--muted)" }}>{fmt(v.thisMonth)} vs {fmt(v.prevMonth)} mes anterior</div>
                </div>
                {v.deltaPct !== null && (
                  <span style={{ fontSize:13, fontWeight:800, color:v.deltaPct>=0?"#10B981":"#DC2626" }}>
                    {v.deltaPct>=0?"▲":"▼"} {Math.abs(v.deltaPct)}%
                  </span>
                )}
              </div>
            ))}
            {Object.keys(rev).length===0 && <p style={{ fontSize:13, color:"var(--muted)", margin:0 }}>Sin ventas registradas todavía.</p>}
          </div>

          <div style={{ background:"var(--card)", borderRadius:16, border:"1px solid var(--line)", padding:20 }}>
            <h3 style={{ margin:"0 0 12px", fontSize:15, fontWeight:800, color:"var(--ink)" }}>Top productos (histórico)</h3>
            {(analytics.topProducts||[]).length===0 && <p style={{ fontSize:13, color:"var(--muted)", margin:0 }}>Sin datos aún.</p>}
            {(analytics.topProducts||[]).map((p:any, i:number) => (
              <div key={p.name} style={{ display:"flex", alignItems:"center", gap:10, padding:"5px 0" }}>
                <span style={{ width:22, height:22, borderRadius:"50%", background:i===0?"#3B82F6":"var(--input-bg)", color:i===0?"#fff":"var(--ink)", fontSize:11, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>{i+1}</span>
                <span style={{ flex:1, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</span>
                <span style={{ fontSize:12, color:"var(--muted)" }}>{p.qty} u · {fmt(p.revenue)}</span>
              </div>
            ))}
          </div>


          <div style={{ background:"var(--card)", borderRadius:16, border:"1px solid var(--line)", padding:20 }}>
            <h3 style={{ margin:"0 0 10px", fontSize:15, fontWeight:800, color:"var(--ink)" }}>Sin ventas hace 30 días</h3>
            {(analytics.deadProducts||[]).length===0 ? (
              <p style={{ fontSize:13, color:"#10B981", margin:0 }}>✅ Todo tu inventario se ha movido recientemente.</p>
            ) : (
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {analytics.deadProducts.slice(0,12).map((p:any) => (
                  <div key={p.id} style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.25)", borderRadius:10, padding:"6px 10px", fontSize:12 }}>
                    <strong>{p.name}</strong> <span style={{ color:"#DC2626" }}>stock: {p.stock} {p.unit}</span>
                  </div>
                ))}
              </div>
          )}
          </div>
        </div>
      )}

      {lowStockProducts.length > 0 && (
        <div style={{ background:"rgba(249,115,22,0.08)", border:"1px solid rgba(249,115,22,0.30)", borderRadius:16, padding:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <Icon name="alert" size={18} color="#F97316"/>
            <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:"#C2410C" }}>Productos con Stock Bajo</h3>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
            {lowStockProducts.map((p: any) => (
              <div key={p.id} style={{ background:"var(--card)", border:"1px solid rgba(249,115,22,0.35)", borderRadius:12, padding:"8px 14px", fontSize:13 }}>
                <strong style={{ color:"var(--ink)" }}>{p.name}</strong>
                <span style={{ color:"#F97316", marginLeft:8 }}>Stock: {p.stock} {p.unit} (mín: {p.minStock})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
