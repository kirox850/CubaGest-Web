import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Field, btn, inp } from "@/components/shared/primitives";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showConfirm, showAlert, DialogHost } from "@/components/shared/dialogs";
import Icon from "@/components/shared/Icon";
import { BrandLogo } from "@/screens/Landing";
import "./platform.css";

// ─── PANEL DE PLATAFORMA (super-admin) ───────────────────────────────────────
// En /panel. Login propio (platform_admins, bootstrap automático en el
// primer intento). Acciones con botones — cero SQL. Toda acción queda en
// platform_audit_logs en el backend.

const API = "/api/platform";
const TOKEN_KEY = "cubagest_platform_token";

const pf = async (path: string, opts: { method?: string; body?: any } = {}) => {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  return data?.data !== undefined ? data.data : data;
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  activa: { label: "Activa", color: "#10B981" },
  trial: { label: "En prueba", color: "var(--brand)" },
  vencida: { label: "Vencida", color: "#F97316" },
  "pago fallido": { label: "Pago fallido", color: "#DC2626" },
  suspendida: { label: "Suspendida", color: "#64748B" },
};

const statusBadge = (s: string) => {
  const m = STATUS_META[s] || { label: s, color: "#64748B" };
  return <Badge label={m.label} color={m.color} />;
};

const fmtDate = (v: any) => (v ? new Date(v).toLocaleDateString("es-CU") : "—");

const panelInput = {
  ...inp,
  background: "#F8FAFC",
  borderColor: "#E2E8F0",
  color: "#0F172A",
} as const;

// Etiquetas técnicas de auditoría → texto claro para humanos
const ACTION_LABELS: Record<string, string> = {
  company_plan_changed: "Cambió el plan de la empresa",
  company_payment_marked: "Registró un pago manual",
  company_status_changed: "Cambió el estado de la cuenta",
  company_notes_updated: "Actualizó las notas internas",
  company_impersonated: "Entró como admin de la empresa",
  platform_admin_created: "Se creó la cuenta del panel",
  platform_admin_login: "Inicio de sesión en el panel",
};

const describeAction = (r: any) => {
  const base = ACTION_LABELS[r.action] || r.action;
  let extra = "";
  try {
    const d = r.detail ? JSON.parse(r.detail) : null;
    if (d?.plan) extra = ` → plan "${d.plan}"`;
    else if (d?.months) extra = ` → ${d.months} mes(es)`;
    else if (d?.active === false) extra = " → suspendida";
    else if (d?.active === true) extra = " → reactivada";
  } catch { /* detail no era JSON */ }
  return base + extra;
};

export default function PlatformApp() {
  const [admin, setAdmin] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"companies" | "detail" | "audit">("companies");
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("cubagest_theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("cubagest_theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const login = async () => {
    setError(""); setLoading(true);
    try {
      const res = await pf("/auth/login", { method: "POST", body: { email, password } });
      localStorage.setItem(TOKEN_KEY, res.accessToken);
      setAdmin(res.admin);
      if (res.bootstrapped) {
        showAlert("Cuenta de panel creada: esta era la primera entrada al panel y tu cuenta quedó creada con este correo y contraseña. Guárdalos bien — el bootstrap ya no volverá a estar disponible.");
      }
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  if (!admin) {
    return (
      <div className="platform-login">
        <div className="platform-login__card">
          <div className="platform-login__content">
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 }}>
              <BrandLogo size={32}/>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>CubaGest</span>
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.3px" }}>Panel de Plataforma</h1>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748B" }}>Acceso exclusivo del operador</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Field label="Correo electrónico" required>
              <input style={panelInput} type="email" placeholder="admin@cubagest.cu" value={email} onChange={(e: any) => setEmail(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && login()} autoComplete="email"/>
            </Field>
            <Field label="Contraseña" required>
              <input style={panelInput} type="password" placeholder="••••••••" value={password} onChange={(e: any) => setPassword(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && login()} autoComplete="current-password"/>
            </Field>
            {error && <div style={{ background: "rgba(220,38,38,0.10)", border: "1px solid rgba(220,38,38,0.30)", color: "#DC2626", padding: "10px 14px", borderRadius: 12, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}><Icon name="alert" size={15} color="#DC2626"/><span>{error}</span></div>}
            <button style={{ ...btn("primary"), width: "100%", justifyContent: "center", padding: "12px", fontSize: 15, opacity: loading ? 0.7 : 1 }} onClick={login} disabled={loading}>{loading ? "Verificando..." : "Entrar"}</button>
          </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="platform-shell">
      <header className="platform-header">
        <div className="platform-header__left">
          <div className="platform-header__brand">
            <BrandLogo size={32}/>
            <strong style={{ fontSize: 15 }}>CubaGest · Panel</strong>
          </div>
          <nav className="platform-header__nav" aria-label="Navegación del panel">
            <button onClick={() => { setView("companies"); setCurrentCompanyId(null); }} className={`platform-header__nav-button${view === "companies" ? " is-active" : ""}`}>
              <Icon name="usuarios" size={16}/><span>Empresas</span>
            </button>
            <button onClick={() => { setView("audit"); setCurrentCompanyId(null); }} className={`platform-header__nav-button${view === "audit" ? " is-active" : ""}`}>
              <Icon name="auditoria" size={16}/><span>Auditoría</span>
            </button>
          </nav>
        </div>
        <div className="platform-header__actions">
          <span className="platform-header__email">{admin.email}</span>
          <button className="platform-header__action-button" onClick={() => setDarkMode(v => !v)} aria-label={darkMode ? "Usar tema claro" : "Usar tema oscuro"} title={darkMode ? "Tema claro" : "Tema oscuro"}>
            <Icon name={darkMode ? "sun" : "moon"} size={15}/>
          </button>
          <button className="platform-header__action-button" onClick={() => { localStorage.removeItem(TOKEN_KEY); setAdmin(null); }}>
            <Icon name="logout" size={15}/><span>Salir</span>
          </button>
        </div>
      </header>

      <div className="platform-content">
        {view === "companies" && (
          <CompaniesList
            stats={stats}
            onStats={setStats}
            onOpen={(id) => { setCurrentCompanyId(id); setView("detail"); }}
          />
        )}
        {view === "detail" && currentCompanyId && (
          <CompanyDetail id={currentCompanyId} onBack={() => setView("companies")} />
        )}
        {view === "audit" && <AuditView />}
      </div>

      {/* Host de los diálogos showAlert/showConfirm (obligatorio montarlo) */}
      <DialogHost/>
    </div>
  );
}

// ─── Lista de empresas + métricas ────────────────────────────────────────────
function CompaniesList({ stats, onStats, onOpen }: { stats: any; onStats: (s: any) => void; onOpen: (id: string) => void }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  const load = () => pf("/companies").then((d: any[]) => setItems(d || [])).catch((e) => setError(e.message));
  useEffect(() => { load(); pf("/stats").then(onStats).catch(() => {}); }, []);

  const filtered = (items || []).filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || (c.nit || "").includes(q));

  return (
    <div className="platform-stack">
      {error && <div style={{ color: "#DC2626", fontSize: 13 }}>{error}</div>}

      {stats && (
        <div className="platform-stat-grid">
          {[
            { l: "Empresas", v: stats.total },
            { l: "Pagan", v: stats.paying },
            { l: "En prueba", v: stats.trials },
            { l: "Vencen <7d", v: stats.expiringSoon },
            { l: "Pago fallido", v: stats.failed },
            { l: "Suspendidas", v: stats.suspended },
            { l: "MRR est.", v: `$${stats.mrrUsd}` },
          ].map((s) => (
            <div key={s.l} className="platform-stat-card">
              <div className="platform-stat-card__label">{s.l}</div>
              <div className="platform-stat-card__value">{s.v}</div>
            </div>
          ))}
        </div>
      )}

      <Input className="platform-search" placeholder="Buscar por nombre o NIT..." value={q} onChange={(e: any) => setQ(e.target.value)} />

      <div className="platform-company-list">
        {(filtered).map((c, i) => (
          <button key={c.id} onClick={() => onOpen(c.id)} className="platform-company-row">
            <div className="platform-company-row__main">
              <div className="platform-company-row__name">{c.name}</div>
              <div className="platform-company-row__meta">
                {c.users} usuarios · {c.salesTotal} ventas · alta {fmtDate(c.createdAt)} · última venta {fmtDate(c.lastSaleDate)}
              </div>
            </div>
            <Badge label={c.plan} color="var(--brand)" />
            {statusBadge(c.effectiveStatus)}
          </button>
        ))}
        {items && filtered.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Sin resultados</div>}
        {!items && !error && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Cargando...</div>}
      </div>
    </div>
  );
}

// ─── Detalle + acciones ──────────────────────────────────────────────────────
function CompanyDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [savedNotes, setSavedNotes] = useState(false);

  const load = () => pf(`/companies/${id}`).then((d: any) => { setData(d); setNotes(d.company?.internalNotes || ""); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);

  const act = async (fn: () => Promise<any>, okMsg: string) => {
    try { await fn(); showAlert(okMsg); load(); } catch (e: any) { showAlert(`Error: ${e.message}`); }
  };

  if (error) return <div style={{ color: "#DC2626" }}>{error}</div>;
  if (!data) return <div style={{ color: "var(--muted)" }}>Cargando...</div>;

  const co = data.company;
  const status = !co.active ? "suspendida" : co.subscriptionStatus === "trial" ? "trial" : co.subscriptionStatus;

  return (
    <div className="platform-stack">
      <button onClick={onBack} style={{ ...btn("ghost"), padding: "2px 0", fontSize: 13, width: "fit-content" }}><Icon name="arrow_left" size={15}/>Volver a empresas</button>

      <Card>
        <CardHeader>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <CardTitle style={{ fontSize: 20 }}>{co.name}</CardTitle>
            <Badge label={co.plan} color="var(--brand)" />
            {statusBadge(status)}
          </div>
          <CardDescription>
            Alta {fmtDate(co.createdAt)} · {data.users.length} usuarios · {data.salesTotal} ventas · última venta {fmtDate(data.lastSaleDate)}
            {co.qvapayAuthorized ? " · QvaPay autorizado" : " · QvaPay NO autorizado"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="platform-detail-meta">
            Plan vence: <strong style={{ color: "var(--ink)" }}>{fmtDate(co.planExpiry)}</strong> · Último pago: {fmtDate(co.lastPaymentDate)} · Próximo: {fmtDate(co.nextPaymentDate)} · Intentos fallidos: {co.failedAttempts}
          </div>
        </CardContent>
      </Card>

      <div className="platform-action-grid">
        {/* ── Planes ── */}
        <Card className="platform-action-card">
          <CardHeader>
            <CardTitle style={{ fontSize: 15 }}>Plan y extensión</CardTitle>
            <CardDescription>Actualiza el plan o regala meses adicionales.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="platform-button-group">
              {(["free", "pro", "empresarial"] as const).map((p) => (
                <Button key={p} className="platform-control-button" variant={co.plan === p ? "default" : "outline"} size="sm"
                  onClick={async () => {
                    if (await showConfirm(`¿Poner ${co.name} en plan ${p}?`)) {
                      act(() => pf(`/companies/${id}/plan`, { method: "POST", body: { plan: p } }), `Plan cambiado a ${p}.`);
                    }
                  }}>
                  {p}
                </Button>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <Select onValueChange={async (months: string) => {
                if (await showConfirm(`¿Añadir ${months} meses al plan actual de ${co.name}?`)) {
                  act(() => pf(`/companies/${id}/plan`, { method: "POST", body: { plan: co.plan, months: Number(months) } }), "Extensión aplicada.");
                }
              }}>
                <SelectTrigger style={{ width: "100%" }}><SelectValue placeholder="Regalar +meses" /></SelectTrigger>
                <SelectContent>
                  {["1", "3", "6", "12"].map((m) => <SelectItem key={m} value={m}>+{m} meses</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ── Pago manual ── */}
        <Card className="platform-action-card">
          <CardHeader>
            <CardTitle style={{ fontSize: 15 }}>Pago manual</CardTitle>
            <CardDescription>Registra meses pagados cuando QvaPay no pudo completar el cobro.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="platform-button-group">
              {[1, 3, 6, 12].map((m) => (
                <Button key={m} className="platform-control-button" variant="outline" size="sm"
                  onClick={async () => {
                    if (await showConfirm(`¿Registrar ${m} mes(es) pagado(s) para ${co.name}? Extiende desde la fecha de vencimiento actual.`)) {
                      act(() => pf(`/companies/${id}/payment`, { method: "POST", body: { months: m } }), "Pago registrado y plan activado.");
                    }
                  }}>
                  +{m} mes{m > 1 ? "es" : ""}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Suspensión ── */}
        <Card className="platform-action-card">
          <CardHeader>
            <CardTitle style={{ fontSize: 15 }}>Estado de la cuenta</CardTitle>
            <CardDescription>Controla si la empresa puede acceder al sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="platform-button-group">
            {co.active ? (
              <Button className="platform-control-button" variant="destructive" size="sm" onClick={async () => {
                if (await showConfirm(`¿SUSPENDER ${co.name}? Todos sus usuarios perderán acceso al iniciar sesión o renovar. Se puede revertir.`)) {
                  act(() => pf(`/companies/${id}/status`, { method: "POST", body: { active: false } }), "Empresa suspendida.");
                }
              }}>
                Suspender empresa
              </Button>
            ) : (
              <Button className="platform-control-button" variant="default" size="sm" onClick={async () => {
                if (await showConfirm(`¿Reactivar ${co.name}?`)) {
                  act(() => pf(`/companies/${id}/status`, { method: "POST", body: { active: true } }), "Empresa reactivada.");
                }
              }}>
                Reactivar empresa
              </Button>
            )}
            </div>
          </CardContent>
        </Card>

        {/* ── Impersonar ── */}
        <Card className="platform-action-card">
          <CardHeader>
            <CardTitle style={{ fontSize: 15 }}>Soporte</CardTitle>
            <CardDescription>Abre una sesión auditada como administrador de esta empresa.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="platform-control-button" variant="outline" size="sm" onClick={async () => {
              if (!(await showConfirm(`Vas a entrar a la app como administrador de ${co.name}. Esta acción queda registrada en la auditoría. ¿Continuar?`))) return;
              try {
                const r = await pf(`/companies/${id}/impersonate`, { method: "POST" });
                // Abre la app en otra pestaña ya autenticado como ese admin.
                const w = window.open(`${window.location.origin}/?app=1`, "_blank");
                if (w) {
                  // Misma origem → podemos escribir su localStorage.
                  w.localStorage.setItem("cubagest_token", r.accessToken);
                  w.localStorage.setItem("cubagest_user", JSON.stringify(r.user));
                  w.location.reload();
                }
              } catch (e: any) { showAlert(`Error: ${e.message}`); }
            }}>
              <Icon name="usuarios" size={14}/>Entrar como su admin
            </Button>
            <span className="platform-support-note">Sesión de soporte de 2 horas, auditada.</span>
          </CardContent>
        </Card>

        {/* ── Notas internas ── */}
        <Card className="platform-action-card">
          <CardHeader>
            <CardTitle style={{ fontSize: 15 }}>Notas internas</CardTitle>
            <CardDescription>Información privada que nunca verá el cliente.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea value={notes} onChange={(e: any) => { setNotes(e.target.value); setSavedNotes(false); }} placeholder="Ej: cliente conflictivo, pidió factura especial..." rows={3} />
            <div className="platform-note-actions">
              <Button className="platform-control-button" size="sm" onClick={async () => {
                if (await showConfirm("¿Guardar las notas internas?")) {
                  await act(() => pf(`/companies/${id}/notes`, { method: "PUT", body: { notes } }), "Notas guardadas.");
                  setSavedNotes(true);
                }
              }}>Guardar notas</Button>
              {savedNotes && <span style={{ fontSize: 12, color: "#10B981" }}>Guardado</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Usuarios ── */}
      <Card>
        <CardHeader><CardTitle style={{ fontSize: 15 }}>Usuarios</CardTitle></CardHeader>
        <CardContent style={{ paddingTop: 0 }}>
          {data.users.map((u: any) => (
            <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{u.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {u.role}</span></div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{u.email} · último login {fmtDate(u.lastLoginAt)}</div>
              </div>
              <Badge label={u.active ? "Activo" : "Inactivo"} color={u.active ? "#10B981" : "#DC2626"} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Auditoría del panel ─────────────────────────────────────────────────────
function AuditView() {
  const [rows, setRows] = useState<any[] | null>(null);
  // Registro legible primero (qué pasó, quién, cuándo); el detalle técnico
  // (JSON crudo del backend) queda plegado tras "Detalles".
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  useEffect(() => { pf("/audit").then((d: any[]) => setRows(d || [])).catch(() => setRows([])); }, []);

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
      <div className="platform-audit-list">
        {(rows || []).map((r, i) => {
        const key = r.id || String(i);
        const isOpen = expanded.has(key);
        const hasDetail = !!r.detail;
        return (
          <div key={key} className="platform-audit-row">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as any }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{describeAction(r)}</span>
              {hasDetail && (
                <button onClick={() => toggle(key)} style={{ background: "var(--brand-tint, #EAF4FE)", color: "var(--brand-dark, #026ACE)", border: "none", borderRadius: 8, padding: "3px 10px", cursor: "pointer", fontSize: 11.5, fontWeight: 700 }}>
                  {isOpen ? "Ocultar detalles" : "Detalles"}
                </button>
              )}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              {r.adminEmail || "sistema"} · {r.entityType}{r.entityId ? ` (${r.entityId.slice(0, 8)})` : ""} · {new Date((r.created_at || 0) * 1000).toLocaleString("es-CU")}
            </div>
            {isOpen && hasDetail && (
              <pre style={{ margin: "8px 0 0", padding: "10px 12px", background: "var(--input-bg, #F1F5F9)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 11.5, color: "var(--muted)", fontFamily: "monospace", whiteSpace: "pre-wrap" as any, wordBreak: "break-all" as any }}>{r.detail}</pre>
            )}
          </div>
        );
      })}
      {rows && rows.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>Sin acciones registradas aún</div>}
      {!rows && <div style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>Cargando...</div>}
    </div>
  );
}
