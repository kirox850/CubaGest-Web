//v2
import { useState, useEffect, useCallback, useRef } from "react";
import {
  cacheProducts, getOfflineProducts, saveSaleOffline, getPendingSales,
  getAllOfflineSales, updateSaleStatus, getPendingCount, saveSyncLog,
  getLastSync, restoreLocalStock, type OfflineSale, type OfflineProduct,
} from "./offlineDB";

// ─── API CLIENT ───────────────────────────────────────────────────────────────
const API_URL = "https://cubagest-backend-production.up.railway.app/api";

let _token: string | null = null;

// ─── OFFLINE HOOKS ────────────────────────────────────────────────────────────
function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

function usePendingCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => getPendingCount().then(setCount);
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, []);
  return { count, refresh: () => getPendingCount().then(setCount) };
}

const getToken = () => _token || localStorage.getItem("cubagest_token");
const saveToken = (t: string | null) => {
  _token = t;
  t ? localStorage.setItem("cubagest_token", t) : localStorage.removeItem("cubagest_token");
};

async function apiFetch(path: string, opts: { method?: string; body?: object; auth?: boolean } = {}) {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (!token) throw new Error("No autenticado");
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Timeout de 8 segundos para no dejar al usuario esperando
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.status === 204) return null;

    // Token expirado o inválido — limpiar sesión y redirigir a login
    if (res.status === 401) {
      setToken(null);
      localStorage.removeItem("cubagest_user");
      window.location.reload();
      throw new Error("Sesión expirada");
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
    return data;
  } catch(e: any) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') throw new Error('Sin conexión');
    throw e;
  }
}
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
    return data;
  } catch(e: any) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') throw new Error('Sin conexión');
    throw e;
  }
}

// ─── ROLES (igual que backend) ────────────────────────────────────────────────
const ROLES: Record<string, { label: string; color: string; perms: string[] }> = {
  admin:       { label: "Administrador", color: "#3B82F6", perms: ["dashboard","inventario","pos","facturacion","contabilidad","cierre","usuarios","config"] },
  cajero:      { label: "Cajero",        color: "#3B82F6", perms: ["dashboard","pos","facturacion","cierre"] },
  contador:    { label: "Contador",      color: "#10B981", perms: ["dashboard","contabilidad","cierre"] },
  almacenista: { label: "Almacenista",   color: "#7A5C1A", perms: ["dashboard","inventario","cierre"] },
};

const PAY_METHODS = [
  { id: "efectivo",      label: "Efectivo CUP" },
  { id: "transferencia", label: "Transferencia (Zun/Enzona)" },
];

const CATEGORIES = ["Alimentos","Higiene","Bebidas","Limpieza","Electrónica","Ropa","Otros"];
const UNITS       = ["ud","kg","g","L","ml","paq","lata","caja","docena"];
const EXPENSE_CATS = ["Compras","Nómina","Servicios","Operaciones","Impuestos","Otros"];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt   = (n: number) => new Intl.NumberFormat("es-CU", { minimumFractionDigits: 2 }).format(n || 0);
const today = () => new Date().toISOString().split("T")[0];

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 18, color = "currentColor" }: { name: string; size?: number; color?: string }) => {
  const icons: Record<string, JSX.Element> = {
    dashboard:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    inventario:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    pos:          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="3"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 8h4"/><path d="M7 11h2"/></svg>,
    facturacion:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><polyline points="9 15 11 17 15 13"/></svg>,
    contabilidad: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    usuarios:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    plus:         <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    trash:        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
    edit:         <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    search:       <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    logout:       <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    alert:        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    check:        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg>,
    print:        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
    eye:          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    close:        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    trend_up:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/></svg>,
    cart:         <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
    minus:        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    x:            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    refresh:      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
    cierre:       <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 8h4m-4 4h2"/><circle cx="17" cy="10" r="2"/><path d="M17 8v-1m0 5v1m-2-3H14m6 0h-1"/></svg>,
  };
  return icons[name] || null;
};

// ─── TOAST ────────────────────────────────────────────────────────────────────
const Toast = ({ msg, type, onClose }: { msg: string; type: string; onClose: () => void }) => {
  useEffect(() => { const t = setTimeout(onClose, 3200); return () => clearTimeout(t); }, []);
  const colors: Record<string, string> = { success:"#10B981", error:"#3B82F6", info:"#3B82F6", warning:"#7A5C1A" };
  return (
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, background:colors[type]||colors.info, color:"#ffffff", padding:"12px 20px", borderRadius:12, maxWidth:340, boxShadow:"0 4px 20px rgba(0,0,0,0.25)", display:"flex", alignItems:"center", gap:10, fontSize:14, fontWeight:500 }}>
      {msg}
      <button onClick={onClose} style={{ background:"none", border:"none", color:"#ffffff", cursor:"pointer", marginLeft:"auto", opacity:0.8 }}><Icon name="close" size={14}/></button>
    </div>
  );
};

// ─── MODAL ────────────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children, width = 560 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) => (
  <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={e => e.target===e.currentTarget && onClose()}>
    <div style={{ background:"#ffffff", borderRadius:16, width:"100%", maxWidth:width, maxHeight:"90vh", overflow:"auto", boxShadow:"0 20px 60px rgba(15,23,42,0.2)" }}>
      <div style={{ padding:"20px 24px", borderBottom:"1px solid #e8e0d8", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, background:"#ffffff", zIndex:1 }}>
        <h3 style={{ margin:0, fontSize:17, fontWeight:700, color:"#1E293B" }}>{title}</h3>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#666", padding:4 }}><Icon name="close" size={18}/></button>
      </div>
      <div style={{ padding:24 }}>{children}</div>
    </div>
  </div>
);

// ─── OFFLINE BANNER ──────────────────────────────────────────────────────────
const OfflineBanner = ({ online, syncing, pending, conflicts }: { online: boolean; syncing: boolean; pending: number; conflicts: number }) => {
  if (online && !syncing && pending === 0 && conflicts === 0) return null;

  const bg = !online ? '#8B1A1A' : syncing ? '#1A5C8B' : conflicts > 0 ? '#c17a00' : '#1A7A3C';
  const msg = !online
    ? `Sin conexión — modo offline${pending > 0 ? ` · ${pending} ventas en cola` : ''}`
    : syncing
    ? 'Sincronizando ventas...'
    : conflicts > 0
    ? `${conflicts} venta(s) con conflicto — revisa en Facturas`
    : `✓ ${pending === 0 ? 'Todo sincronizado' : `${pending} pendientes`}`;

  return (
    <div style={{ background: bg, color: '#fff', padding: '8px 16px', fontSize: 12, fontWeight: 600, textAlign: 'center' as any, flexShrink: 0 }}>
      {msg}
    </div>
  );
};

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────
const Badge = ({ label, color = "#3B82F6", bg }: { label: string; color?: string; bg?: string }) => (
  <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 10px", borderRadius:20, fontSize:12, fontWeight:600, color, background:bg||color+"20", letterSpacing:"0.3px" }}>{label}</span>
);

const Field = ({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
    <label style={{ fontSize:12, fontWeight:600, color:"#475569", letterSpacing:"0.5px", textTransform:"uppercase" }}>{label}{required && <span style={{ color:"#3B82F6" }}> *</span>}</label>
    {children}
  </div>
);

const Spinner = () => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:48 }}>
    <div style={{ width:32, height:32, border:"3px solid #e8e0d8", borderTopColor:"#3B82F6", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

const inp = { width:"100%", padding:"9px 12px", border:"1px solid #d8cfc4", borderRadius:12, fontSize:14, color:"#1E293B", background:"#F1F5F9", boxSizing:"border-box" as const, outline:"none", fontFamily:"inherit" };
const sel = { ...inp };
const btn = (variant = "primary") => ({
  display:"inline-flex", alignItems:"center", gap:7, padding:"9px 18px", borderRadius:12, fontSize:14, fontWeight:600, cursor:"pointer", border:"none", transition:"all 0.15s",
  ...(variant==="primary"   ? { background:"#3B82F6", color:"#ffffff" } :
      variant==="secondary" ? { background:"#E2E8F0", color:"#1E293B", border:"1px solid #d8cfc4" } :
      variant==="ghost"     ? { background:"none", color:"#3B82F6" } :
      variant==="danger"    ? { background:"#fdf0f0", color:"#3B82F6", border:"1px solid #f0c0c0" } : {}),
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
const LoginScreen = ({ onLogin }: { onLogin: (user: any) => void }) => {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) { setError("Ingrese su correo y contraseña."); return; }
    setError(""); setLoading(true);
    try {
      const { token, user } = await apiFetch("/auth/login", { method:"POST", body:{ email, password }, auth:false });
      saveToken(token);
      onLogin(user);
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0F172A 0%,#1E3A5F 50%,#1E293B 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#ffffff", borderRadius:16, padding:"48px 40px", width:"100%", maxWidth:400, boxShadow:"0 30px 80px rgba(0,0,0,0.4)" }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ width:60, height:60, background:"linear-gradient(135deg,#3B82F6,#60A5FA)", borderRadius:16, margin:"0 auto 16px", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M20 12a8 8 0 0 1-8 8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/><path d="M12 4a8 8 0 0 0 0 16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/><circle cx="16" cy="12" r="2" fill="white"/><circle cx="19.5" cy="12" r="2" fill="white"/></svg>
          </div>
          <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:"#1E293B", letterSpacing:"-0.5px" }}>CubaGest</h1>
          <p style={{ margin:"6px 0 0", fontSize:13, color:"#64748B" }}>Sistema de Gestión Empresarial</p>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
          <Field label="Correo electrónico" required>
            <input style={inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="usuario@empresa.cu" onKeyDown={e=>e.key==="Enter"&&handleSubmit()} autoComplete="email"/>
          </Field>
          <Field label="Contraseña" required>
            <input style={inp} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handleSubmit()} autoComplete="current-password"/>
          </Field>
          {error && <div style={{ background:"#fdf0f0", color:"#3B82F6", padding:"10px 14px", borderRadius:12, fontSize:13, display:"flex", gap:8, alignItems:"center" }}><Icon name="alert" size={15} color="#3B82F6"/>{error}</div>}
          <button style={{ ...btn("primary"), justifyContent:"center", padding:"12px", fontSize:15, marginTop:4, opacity:loading?0.7:1 }} onClick={handleSubmit} disabled={loading}>
            {loading ? "Verificando..." : "Iniciar sesión"}
          </button>
        </div>
        <button style={{ ...btn("ghost"), width:"100%", justifyContent:"center", marginTop:8, fontSize:13 }} onClick={()=>alert("Para registrar su negocio en CubaGest contacte a: soporte@cubagest.cu")}>
            Crear mi negocio (primera vez)
          </button>
        <p style={{ textAlign:"center", marginTop:16, fontSize:11, color:"#b0a090" }}>Sistema de gestión empresarial · CubaGest</p>
      </div>
    </div>
  );
};

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
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

  if (loading) return <Spinner/>;
  if (!summary && error) return <div style={{ color:"#3B82F6", padding:24 }}>Error: {error}</div>;
  if (!summary) return null;

  const { totalRevenue=0, totalExpenses=0, netProfit=0, salesCount=0, lowStockProducts=[] } = summary;

  const StatCard = ({ label, value, sub, color, icon }: any) => (
    <div style={{ background:"#ffffff", borderRadius:16, padding:"22px 24px", border:"1px solid #e8e0d8", display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <p style={{ margin:0, fontSize:12, fontWeight:600, color:"#64748B", textTransform:"uppercase", letterSpacing:"0.5px" }}>{label}</p>
          <p style={{ margin:"6px 0 0", fontSize:24, fontWeight:800, color:color||"#1E293B", letterSpacing:"-0.5px" }}>{value}</p>
        </div>
        <div style={{ width:42, height:42, background:(color||"#3B82F6")+"15", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Icon name={icon} size={20} color={color||"#3B82F6"}/>
        </div>
      </div>
      {sub && <p style={{ margin:0, fontSize:12, color:"#64748B" }}>{sub}</p>}
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      <div>
        <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:800, color:"#1E293B" }}>Panel Principal</h2>
        <p style={{ margin:0, fontSize:14, color:"#64748B" }}>Bienvenido, {user.name} · {ROLES[user.role]?.label}</p>
        {error && <p style={{ margin:"4px 0 0", fontSize:12, color:"#F97316" }}>⚡ {error}</p>}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:16 }}>
        <StatCard label="Ingresos del Mes"   value={`$${fmt(totalRevenue)} CUP`}  sub={`${salesCount} facturas emitidas`}                                color="#10B981" icon="trend_up"/>
        <StatCard label="Gastos del Mes"     value={`$${fmt(totalExpenses)} CUP`} sub="Total de egresos registrados"                                    color="#3B82F6" icon="contabilidad"/>
        <StatCard label="Utilidad Neta"      value={`$${fmt(netProfit)} CUP`}     sub={`Margen: ${Math.round(netProfit/Math.max(totalRevenue,1)*100)}%`} color={netProfit>=0?"#3B82F6":"#3B82F6"} icon="facturacion"/>
        <StatCard label="Alertas de Stock"   value={lowStockProducts.length}      sub={lowStockProducts.length ? lowStockProducts.map((p:any)=>p.name).join(", ").slice(0,60) : "Todos los productos OK"} color={lowStockProducts.length?"#F97316":"#10B981"} icon="alert"/>
      </div>
      {lowStockProducts.length > 0 && (
        <div style={{ background:"#FFF7ED", border:"1px solid #f0d070", borderRadius:16, padding:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <Icon name="alert" size={18} color="#F97316"/>
            <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:"#9A3412" }}>Productos con Stock Bajo</h3>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
            {lowStockProducts.map((p: any) => (
              <div key={p.id} style={{ background:"#ffffff", border:"1px solid #f0d070", borderRadius:12, padding:"8px 14px", fontSize:13 }}>
                <strong style={{ color:"#1E293B" }}>{p.name}</strong>
                <span style={{ color:"#F97316", marginLeft:8 }}>Stock: {p.stock} {p.unit} (mín: {p.minStock})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── INVENTARIO ───────────────────────────────────────────────────────────────
const Inventario = ({ user, showToast }: { user: any; showToast: (m: string, t: string) => void }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filterCat, setFilterCat] = useState("Todas");
  const [modal, setModal]       = useState<null|"add"|"edit"|"adjust">(null);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm]         = useState<any>({});
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustType, setAdjustType] = useState("entrada");
  const [saving, setSaving]     = useState(false);

  const canManage = ["admin","almacenista"].includes(user.role);

  const invOnline = useOnlineStatus();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      if (invOnline) {
        const list = await apiFetch("/products");
        await cacheProducts(list);
        setProducts(list);
      } else {
        const cached = await getOfflineProducts();
        setProducts(cached as any[]);
        showToast("Mostrando inventario offline","info");
      }
    } catch(e:any) {
      const cached = await getOfflineProducts();
      if (cached.length > 0) {
        setProducts(cached as any[]);
        showToast("Sin conexión — inventario cacheado","warning");
      } else {
        showToast(e.message,"error");
      }
    } finally { setLoading(false); }
  }, [invOnline]);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter(p =>
    (filterCat==="Todas" || p.category===filterCat) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()))
  );
  const cats = ["Todas", ...Array.from(new Set(products.map(p=>p.category).filter(Boolean)))];

  const openAdd  = () => { setForm({ code:`P${String(products.length+1).padStart(3,"0")}`, name:"", category:"Alimentos", unit:"ud", price:"", cost:"", stock:"", minStock:"10" }); setModal("add"); };
  const openEdit = (p:any) => { setForm({...p, price:String(p.price), cost:String(p.cost||""), stock:String(p.stock), minStock:String(p.minStock||"")}); setSelected(p); setModal("edit"); };
  const openAdjust = (p:any) => { setSelected(p); setAdjustQty(""); setAdjustType("entrada"); setModal("adjust"); };

  const saveProduct = async () => {
    if (!form.name||!form.price) return showToast("Complete los campos requeridos","error");
    setSaving(true);
    try {
      const payload = { code:form.code, name:form.name, category:form.category, unit:form.unit, price:Number(form.price), cost:Number(form.cost)||0, stock:Number(form.stock)||0, minStock:Number(form.minStock)||0 };
      if (modal==="add") {
        await apiFetch("/products", { method:"POST", body:payload });
        showToast("Producto creado correctamente","success");
      } else {
        await apiFetch(`/products/${selected.id}`, { method:"PUT", body:payload });
        showToast("Producto actualizado","success");
      }
      setModal(null);
      load();
    } catch(e:any) { showToast(e.message,"error"); }
    finally { setSaving(false); }
  };

  const saveAdjust = async () => {
    const qty = Number(adjustQty);
    if (!qty||qty<=0) return showToast("Ingrese una cantidad válida","error");
    setSaving(true);
    try {
      await apiFetch(`/products/${selected.id}/adjust-stock`, { method:"POST", body:{ type:adjustType, qty, reason:"Ajuste manual desde web" }});
      showToast(`Ajuste de stock registrado (${adjustType})`, "success");
      setModal(null);
      load();
    } catch(e:any) { showToast(e.message,"error"); }
    finally { setSaving(false); }
  };

  const reactivateProduct = async (id: string) => {
    try {
      await apiFetch(`/products/${id}`, { method:"PUT", body:{ active: true } });
      showToast("Producto reactivado","success");
      load();
    } catch(e:any) { showToast(e.message,"error"); }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("¿Desactivar este producto? No se eliminará, solo se ocultará.")) return;
    try {
      await apiFetch(`/products/${id}`, { method:"DELETE" });
      showToast("Producto desactivado","info");
      load();
    } catch(e:any) { showToast(e.message,"error"); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:800, color:"#1E293B" }}>Inventario</h2>
          <p style={{ margin:0, fontSize:14, color:"#64748B" }}>
            {products.filter((p:any)=>p.active!==false).length} productos
            {!invOnline && <span style={{ marginLeft:8, background:"#F97316", color:"#ffffff", borderRadius:20, padding:"1px 8px", fontSize:11, fontWeight:700 }}>OFFLINE</span>}
          </p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={btn("secondary")} onClick={load}><Icon name="refresh" size={15}/>Actualizar</button>
          {canManage && invOnline && <button style={btn("primary")} onClick={openAdd}><Icon name="plus" size={16}/>Nuevo Producto</button>}
          {canManage && !invOnline && <span style={{ fontSize:12, color:"#F97316", padding:"8px 0" }}>Edición requiere conexión</span>}
        </div>
      </div>

      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        <div style={{ position:"relative", flex:1, minWidth:200 }}>
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}><Icon name="search" size={15} color="#64748B"/></span>
          <input style={{ ...inp, paddingLeft:34 }} placeholder="Buscar por nombre o código..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select style={{ ...sel, width:"auto" }} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
          {cats.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>

      {loading ? <Spinner/> : (
        <div style={{ background:"#ffffff", borderRadius:16, border:"1px solid #e8e0d8", overflowX:"auto", WebkitOverflowScrolling:"touch" as any }}>
          <table style={{ width:"100%", minWidth:700, borderCollapse:"collapse" }}>
            <thead><tr style={{ background:"#F1F5F9" }}>
              {["Código","Producto","Categoría","Precio","Costo","Stock","Estado","Acciones"].map(h=>(
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:"0.5px", whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(p=>(
                <tr key={p.id} style={{ borderTop:"1px solid #f0ebe4", opacity:p.active?1:0.5 }}>
                  <td style={{ padding:"11px 14px", fontSize:12, fontWeight:600, color:"#64748B", fontFamily:"monospace" }}>{p.code}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, fontWeight:600, color:"#1E293B" }}>{p.name} <span style={{ fontSize:11, color:"#aaa", fontWeight:400 }}>/{p.unit}</span></td>
                  <td style={{ padding:"11px 14px" }}><Badge label={p.category||"—"} color="#5a3a1a"/></td>
                  <td style={{ padding:"11px 14px", fontSize:13, fontWeight:700 }}>${fmt(p.price)}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, color:"#475569" }}>${fmt(p.cost)}</td>
                  <td style={{ padding:"11px 14px" }}>
                    <span style={{ fontWeight:700, color:p.stock<=p.minStock?"#F97316":"#10B981", fontSize:14 }}>{p.stock}</span>
                    {p.stock<=p.minStock && <span style={{ marginLeft:6, fontSize:10, color:"#F97316" }}>⚠ BAJO</span>}
                  </td>
                  <td style={{ padding:"11px 14px" }}><Badge label={p.active?"Activo":"Inactivo"} color={p.active?"#10B981":"#888"}/></td>
                  <td style={{ padding:"11px 14px" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      {canManage && <button style={{ ...btn("ghost"), padding:"5px 9px", fontSize:12 }} onClick={()=>openAdjust(p)} title="Ajustar stock">±</button>}
                      {canManage && <button style={{ ...btn("ghost"), padding:"5px 9px" }} onClick={()=>openEdit(p)}><Icon name="edit" size={14}/></button>}
                      {canManage && p.active && <button style={{ ...btn("danger"), padding:"5px 9px" }} onClick={()=>deleteProduct(p.id)}><Icon name="trash" size={14}/></button>}
                      {canManage && !p.active && <button style={{ ...btn("secondary"), padding:"5px 9px", fontSize:11 }} onClick={()=>reactivateProduct(p.id)}>Activar</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length===0 && <div style={{ padding:40, textAlign:"center", color:"#64748B", fontSize:14 }}>No se encontraron productos</div>}
        </div>
      )}

      {(modal==="add"||modal==="edit") && (
        <Modal title={modal==="add"?"Nuevo Producto":"Editar Producto"} onClose={()=>setModal(null)}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <Field label="Código" required><input style={inp} value={form.code||""} onChange={e=>setForm((f:any)=>({...f,code:e.target.value}))} disabled={modal==="edit"}/></Field>
            <Field label="Categoría" required>
              <select style={sel} value={form.category||""} onChange={e=>setForm((f:any)=>({...f,category:e.target.value}))}>
                {CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </Field>
            <div style={{ gridColumn:"1/-1" }}><Field label="Nombre del Producto" required><input style={inp} value={form.name||""} onChange={e=>setForm((f:any)=>({...f,name:e.target.value}))}/></Field></div>
            <Field label="Unidad" required>
              <select style={sel} value={form.unit||""} onChange={e=>setForm((f:any)=>({...f,unit:e.target.value}))}>
                {UNITS.map(u=><option key={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Precio Venta (CUP)" required><input style={inp} type="number" value={form.price||""} onChange={e=>setForm((f:any)=>({...f,price:e.target.value}))}/></Field>
            <Field label="Costo (CUP)"><input style={inp} type="number" value={form.cost||""} onChange={e=>setForm((f:any)=>({...f,cost:e.target.value}))}/></Field>
            {modal==="add" && <Field label="Stock Inicial"><input style={inp} type="number" value={form.stock||""} onChange={e=>setForm((f:any)=>({...f,stock:e.target.value}))}/></Field>}
            <Field label="Stock Mínimo"><input style={inp} type="number" value={form.minStock||""} onChange={e=>setForm((f:any)=>({...f,minStock:e.target.value}))}/></Field>
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:24 }}>
            <button style={btn("secondary")} onClick={()=>setModal(null)}>Cancelar</button>
            <button style={{ ...btn("primary"), opacity:saving?0.6:1 }} onClick={saveProduct} disabled={saving}>{saving?"Guardando...":"Guardar"}</button>
          </div>
        </Modal>
      )}

      {modal==="adjust" && selected && (
        <Modal title={`Ajuste de Stock — ${selected.name}`} onClose={()=>setModal(null)} width={420}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ background:"#F1F5F9", borderRadius:12, padding:"12px 16px" }}>
              <p style={{ margin:0, fontSize:13, color:"#475569" }}>Stock actual: <strong>{selected.stock} {selected.unit}</strong></p>
            </div>
            <Field label="Tipo de Movimiento">
              <div style={{ display:"flex", gap:10 }}>
                {[["entrada","Entrada (+)"],["salida","Salida (-)"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setAdjustType(v)} style={{ ...btn(adjustType===v?"primary":"secondary"), flex:1, justifyContent:"center", fontSize:13 }}>{l}</button>
                ))}
              </div>
            </Field>
            <Field label="Cantidad" required><input style={inp} type="number" min="1" value={adjustQty} onChange={e=>setAdjustQty(e.target.value)} placeholder="0"/></Field>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button style={btn("secondary")} onClick={()=>setModal(null)}>Cancelar</button>
              <button style={{ ...btn("primary"), opacity:saving?0.6:1 }} onClick={saveAdjust} disabled={saving}>{saving?"Guardando...":"Registrar"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── POS ──────────────────────────────────────────────────────────────────────
const POS = ({ user, showToast }: { user: any; showToast: (m:string,t:string)=>void }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [cart, setCart]         = useState<any[]>([]);
  const [search, setSearch]     = useState("");
  const [payMethod, setPayMethod] = useState("efectivo");
  const [clientName, setClientName] = useState("");
  const [clientNit, setClientNit]   = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [cashGiven, setCashGiven]   = useState("");
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [processing, setProcessing]   = useState(false);

  const subtotal = cart.reduce((a,i)=>a+i.price*i.qty,0);
  const total    = subtotal;
  const change   = Number(cashGiven) - total;
  const needsTransferData = payMethod === "transferencia";

  const online = useOnlineStatus();

  useEffect(()=>{
    if (online) {
      apiFetch("/products")
        .then(async list => {
          await cacheProducts(list);
          setProducts(list.filter((p:any)=>p.active && p.stock>0));
          setLoading(false);
        })
        .catch(async e => {
          showToast("Sin conexión — cargando productos offline","warning");
          const cached = await getOfflineProducts();
          setProducts(cached.filter(p=>p.localStock>0));
          setLoading(false);
        });
    } else {
      getOfflineProducts().then(cached => {
        setProducts(cached.filter(p=>p.localStock>0));
        setLoading(false);
      });
    }
  },[online]);

  const avail = products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()));

  const qtyFor = (id:string) => cart.find(i=>i.id===id)?.qty || 0;

  const setQty = (p:any, newQty:number) => {
    if (newQty <= 0) { setCart(prev=>prev.filter(i=>i.id!==p.id)); return; }
    if (newQty > p.stock) { showToast("Stock insuficiente","warning"); return; }
    setCart(prev=>{
      const ex = prev.find(i=>i.id===p.id);
      if (ex) return prev.map(i=>i.id===p.id?{...i,qty:newQty}:i);
      return [...prev,{...p,qty:newQty}];
    });
  };

  const removeFromCart = (id:string) => setCart(prev=>prev.filter(i=>i.id!==id));

  const processSale = async () => {
    if (cart.length===0) return showToast("El carrito está vacío","error");
    if (needsTransferData && (!clientName || !clientNit || !clientPhone)) {
      return showToast("Complete nombre, NIT y teléfono del cliente para transferencia","error");
    }
    setProcessing(true);
    try {
      const saleData = {
        client: needsTransferData ? clientName : "Consumidor Final",
        clientNit: needsTransferData ? clientNit : "00000000000",
        clientPhone: needsTransferData ? clientPhone : undefined,
        items: cart.map(i=>({ productId:i.id, name:i.name, qty:i.qty, price:i.price, total:i.price*i.qty })),
        payMethod,
        subtotal: cart.reduce((a,i)=>a+i.price*i.qty,0),
        total: cart.reduce((a,i)=>a+i.price*i.qty,0),
        currency:"CUP",
      };

      if (!online) {
        // Guardar offline
        const offlineSale = await saveSaleOffline(saleData);
        setLastReceipt({ ...offlineSale, id: offlineSale.localId, isOffline: true });
        setCart([]);
        setSearch(""); setCashGiven("");
        setClientName(""); setClientNit(""); setClientPhone("");
        // Actualizar lista con stock local
        const cached = await getOfflineProducts();
        setProducts(cached.filter(p=>p.localStock>0));
        showToast(`Factura ${offlineSale.localId} guardada offline`,"info");
      } else {
        // Online normal
        const invoice = await apiFetch("/sales", { method:"POST", body: saleData });
        // Actualizar cache de productos
        const updated = await apiFetch("/products");
        await cacheProducts(updated);
        setProducts(updated.filter((p:any)=>p.active&&p.stock>0));
        setLastReceipt(invoice);
        setCart([]);
        setSearch(""); setCashGiven("");
        setClientName(""); setClientNit(""); setClientPhone("");
        showToast(`Factura ${invoice.id} emitida correctamente`,"success");
      }
    } catch(e:any) { showToast(e.message,"error"); }
    finally { setProcessing(false); }
  };

  // Altura del carrito fijo abajo (estimada)
  const cartH = needsTransferData ? 420 : payMethod==="efectivo" ? 320 : 260;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 120px)", gap:0 }}>
      <h2 style={{ margin:"0 0 12px", fontSize:20, fontWeight:800, color:"#1E293B", flexShrink:0 }}>Punto de Venta</h2>

      {/* Buscador fijo */}
      <div style={{ position:"relative", flexShrink:0, marginBottom:10 }}>
        <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}><Icon name="search" size={15} color="#64748B"/></span>
        <input style={{ ...inp, paddingLeft:34 }} placeholder="Buscar producto..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {/* Lista de productos — scroll independiente */}
      <div style={{ flex:1, overflowY:"auto", marginBottom:10, WebkitOverflowScrolling:"touch" as any }}>
        {loading ? <Spinner/> : (
          <div style={{ background:"#ffffff", borderRadius:16, border:"1px solid #e8e0d8", overflow:"hidden" }}>
            {avail.map((p,idx)=>{
              const q = qtyFor(p.id);
              return (
                <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", borderTop: idx===0?"none":"1px solid #f0ebe4" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#1E293B", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</p>
                    <p style={{ margin:0, fontSize:11, color:"#64748B" }}>Stock: {p.stock} {p.unit} · ${fmt(p.price)}</p>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                    <button onClick={()=>setQty(p, q-1)} disabled={q===0} style={{ width:28, height:28, background:"#E2E8F0", border:"none", borderRadius:8, cursor:q===0?"default":"pointer", opacity:q===0?0.4:1, display:"flex", alignItems:"center", justifyContent:"center" }}><Icon name="minus" size={13}/></button>
                    <span style={{ width:22, textAlign:"center", fontSize:14, fontWeight:700, color:q>0?"#3B82F6":"#1E293B" }}>{q}</span>
                    <button onClick={()=>setQty(p, q+1)} style={{ width:28, height:28, background:"#3B82F6", border:"none", borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><Icon name="plus" size={13} color="#ffffff"/></button>
                  </div>
                </div>
              );
            })}
            {avail.length===0 && <div style={{ textAlign:"center", padding:40, color:"#64748B", fontSize:14 }}>No hay productos disponibles</div>}
          </div>
        )}
      </div>

      {/* Carrito fijo abajo */}
      <div style={{ flexShrink:0, background:"#ffffff", borderRadius:16, border:"1px solid #e8e0d8", padding:14, display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <Icon name="cart" size={18} color="#3B82F6"/>
          <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:"#1E293B" }}>Carrito</h3>
          <span style={{ marginLeft:"auto", background:"#3B82F6", color:"#ffffff", borderRadius:20, padding:"1px 10px", fontSize:12, fontWeight:700 }}>{cart.length}</span>
        </div>

        {cart.length>0 && (
          <div style={{ maxHeight:80, overflowY:"auto", display:"flex", flexDirection:"column", gap:4 }}>
            {cart.map(item=>(
              <div key={item.id} style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                <span style={{ color:"#475569" }}>{item.qty}× {item.name}</span>
                <span style={{ fontWeight:700 }}>${fmt(item.price*item.qty)}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" as any }}>
          <Field label="Pago">
            <select style={{ ...sel, fontSize:12, padding:"6px 10px" }} value={payMethod} onChange={e=>setPayMethod(e.target.value)}>
              {PAY_METHODS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
          {payMethod==="efectivo" && (
            <Field label="Efectivo">
              <input style={{ ...inp, fontSize:12, padding:"6px 10px" }} type="number" value={cashGiven} onChange={e=>setCashGiven(e.target.value)} placeholder="0.00"/>
            </Field>
          )}
        </div>

        {payMethod==="efectivo" && cashGiven && Number(cashGiven)>=total && (
          <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#10B981" }}>Cambio: ${fmt(change)} CUP</p>
        )}

        {needsTransferData && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <input style={{ ...inp, fontSize:12 }} value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Nombre del cliente *"/>
            <div style={{ display:"flex", gap:8 }}>
              <input style={{ ...inp, fontSize:12, flex:1, fontFamily:"monospace" }} value={clientNit} onChange={e=>setClientNit(e.target.value)} maxLength={11} placeholder="NIT *"/>
              <input style={{ ...inp, fontSize:12, flex:1 }} value={clientPhone} onChange={e=>setClientPhone(e.target.value)} placeholder="Teléfono *"/>
            </div>
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:18, fontWeight:800, color:"#1E293B" }}>Total: ${fmt(total)} CUP</div>
          <button style={{ ...btn("primary"), padding:"10px 20px", fontSize:14, opacity:processing?0.6:1, background:"#10B981", boxShadow:"0 4px 12px rgba(16,185,129,0.3)" }} onClick={processSale} disabled={cart.length===0||processing}>
            <Icon name="check" size={15}/>{processing?"...":"Cobrar"}
          </button>
        </div>
      </div>

      {lastReceipt && (
        <Modal title="Factura Emitida" onClose={()=>setLastReceipt(null)} width={480}>
          <div style={{ fontFamily:"monospace", fontSize:12, lineHeight:1.8, background:"#F1F5F9", padding:20, borderRadius:12, border:"1px solid #e8e0d8" }}>
            {lastReceipt.isOffline && <div style={{ background:"#fff3cd", color:"#856404", padding:"6px 10px", borderRadius:8, marginBottom:10, fontSize:11, textAlign:"center" as any }}>⚡ GUARDADA OFFLINE — se sincronizará al recuperar conexión</div>}
            <div style={{ textAlign:"center", marginBottom:16 }}>
              <div style={{ fontWeight:800, fontSize:16 }}>CUBAGEST</div>
              <div style={{ fontWeight:700, fontSize:14, color:"#3B82F6" }}>FACTURA COMERCIAL</div>
              <div>No. <strong>{lastReceipt.id || lastReceipt.localId}</strong> · Fecha: {lastReceipt.date?.split("T")[0]||lastReceipt.syncedAt||new Date().toISOString().split("T")[0]}</div>
            </div>
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"10px 0" }}/>
            <div>Cliente: {lastReceipt.client}</div>
            <div>NIT Cliente: {lastReceipt.clientNit}</div>
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"10px 0" }}/>
            {(lastReceipt.items||[]).map((item:any,i:number)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between" }}>
                <span>{item.qty}x {(item.name||item.Product?.name||"").slice(0,22)}</span>
                <span>${fmt(item.total||item.price*item.qty)}</span>
              </div>
            ))}
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"10px 0" }}/>
            <div style={{ display:"flex", justifyContent:"space-between", fontWeight:800, fontSize:14, marginTop:4 }}><span>TOTAL:</span><span>${fmt(lastReceipt.total)} CUP</span></div>
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"10px 0" }}/>
            <div style={{ textAlign:"center", fontSize:10, color:"#888" }}>Gracias por su preferencia</div>
          </div>
          <div style={{ display:"flex", gap:10, marginTop:16, justifyContent:"flex-end" }}>
            <button style={btn("secondary")} onClick={()=>setLastReceipt(null)}><Icon name="check" size={15}/>Listo</button>
            <button style={btn("primary")} onClick={()=>window.print()}><Icon name="print" size={15}/>Imprimir</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── PLAN Y SUSCRIPCIÓN (modal desde el perfil) ────────────────────────────────
const PlanModal = ({ onClose, user }: { onClose: () => void; user: any }) => {
  const [planInfo, setPlanInfo]   = useState<any>(null);
  const [loading, setLoading]     = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string|null>(null);

  useEffect(() => {
    apiFetch("/plan").then(setPlanInfo).catch(()=>{});
    // Detectar si volvió del callback de QvaPay
    const params = new URLSearchParams(window.location.search);
    const planResult = params.get("plan");
    if (planResult === "activated") {
      window.history.replaceState({}, "", window.location.pathname);
      apiFetch("/plan").then(setPlanInfo).catch(()=>{});
    }
  }, []);

  const plans = [
    {
      key: "free", label: "Free", priceUSD: 0,
      features: ["1 usuario","Hasta 10 productos","100 ventas al mes","Historial de 30 días","Reportes básicos","Soporte por email (48-72 h)"],
      payable: false,
    },
    {
      key: "pro", label: "Pro", priceUSD: 5,
      features: ["3 usuarios","Hasta 50 productos","1.000 ventas al mes","Historial de 12 meses","Reportes avanzados + PDF","Cierre de caja e inventario","Notificaciones y alertas","Soporte prioritario (24-48 h)","48 h de onboarding incluidas"],
      payable: true,
    },
    {
      key: "empresarial", label: "Empresarial", priceUSD: 10,
      features: ["Usuarios ilimitados","Productos ilimitados","Ventas ilimitadas","Historial ilimitado","Roles y permisos avanzados","Backup automático y exportación","Soporte prioritario (< 12 h)","Onboarding personalizado"],
      payable: true,
    },
  ];

  const effectivePlan = planInfo?.plan || user?.company?.plan || "free";
  const subStatus     = planInfo?.subscriptionStatus || user?.company?.subscriptionStatus;
  const isTrial       = subStatus === "trial";
  const isFailed      = subStatus === "failed";
  const planExpiry    = user?.company?.planExpiry;
  const daysLeft      = planExpiry ? Math.max(0, Math.ceil((new Date(planExpiry).getTime() - Date.now()) / 86400000)) : null;

  const handleQvaPay = async (planKey: string) => {
    try {
      setLoading(true);
      setSelectedPlan(planKey);
      const data = await apiFetch("/subscription/authorize", { method:"POST", body:{ plan: planKey } });
      if (data?.url) window.location.href = data.url;
    } catch(e: any) { alert("Error al conectar con QvaPay: " + e.message); }
    finally { setLoading(false); setSelectedPlan(null); }
  };

  const handleWhatsApp = (planKey: string, priceUSD: number) => {
    const p   = plans.find(x => x.key === planKey);
    const company = user?.company?.name || "mi empresa";
    const email   = user?.email || "";
    const msg = encodeURIComponent(
      `Hola, quiero activar el plan *${p?.label}* de CubaGest.\n\n` +
      `🏢 Empresa: ${company}\n` +
      `📧 Correo: ${email}\n` +
      `💳 Plan: ${p?.label} — $${priceUSD} USD/mes\n\n` +
      `Por favor indícame cómo proceder con el pago.`
    );
    window.open(`https://wa.me/5354801057?text=${msg}`, "_blank");
  };

  return (
    <Modal title="Planes — CubaGest" onClose={onClose} width={660}>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

        {/* Banner trial */}
        {isTrial && daysLeft !== null && (
          <div style={{ background: daysLeft <= 7 ? "#FFF7ED" : "#EFF6FF", border:`1px solid ${daysLeft <= 7 ? "#FED7AA" : "#BFDBFE"}`, borderRadius:12, padding:14 }}>
            <div style={{ fontWeight:700, fontSize:14, color: daysLeft <= 7 ? "#C2410C" : "#1E40AF" }}>
              {daysLeft <= 7 ? "⚠ " : "🎁 "}Período de prueba — {daysLeft} día{daysLeft !== 1 ? "s" : ""} restante{daysLeft !== 1 ? "s" : ""}
            </div>
            <div style={{ fontSize:12, color:"#64748B", marginTop:4 }}>
              Estás usando el plan Empresarial gratis. Al vencer pasarás automáticamente al plan Free.
            </div>
          </div>
        )}

        {/* Banner pago fallido */}
        {isFailed && (
          <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:12, padding:14 }}>
            <div style={{ fontWeight:700, fontSize:14, color:"#DC2626" }}>⚠ Pago fallido</div>
            <div style={{ fontSize:12, color:"#64748B", marginTop:4 }}>
              No pudimos cobrar tu suscripción. Asegúrate de tener saldo en QvaPay o contacta por WhatsApp para pagar manualmente.
            </div>
          </div>
        )}

        {/* Uso actual */}
        {planInfo && (
          <div style={{ background:"#F8FAFC", borderRadius:12, padding:14, border:"1px solid #E2E8F0" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", marginBottom:10, textTransform:"uppercase" as const }}>Uso este mes</div>
            <div style={{ display:"flex", gap:20, flexWrap:"wrap" as const }}>
              {[
                { l:"Usuarios",       v:planInfo.usage.users,          max:planInfo.limits.maxUsers },
                { l:"Productos",      v:planInfo.usage.products,        max:planInfo.limits.maxProducts },
                { l:"Ventas",         v:planInfo.usage.salesThisMonth,  max:planInfo.limits.maxSalesMonth },
              ].map(u => {
                const pct  = u.max ? Math.min(100, Math.round(u.v / u.max * 100)) : 0;
                const warn = u.max && pct >= 80;
                return (
                  <div key={u.l} style={{ flex:1, minWidth:110 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                      <span style={{ color:"#475569", fontWeight:600 }}>{u.l}</span>
                      <span style={{ color: warn?"#F97316":"#1E293B", fontWeight:700 }}>
                        {u.v}{u.max ? ` / ${u.max}` : ""}
                      </span>
                    </div>
                    {u.max && (
                      <div style={{ height:6, background:"#E2E8F0", borderRadius:99 }}>
                        <div style={{ height:6, width:`${pct}%`, background: pct>=100?"#EF4444":pct>=80?"#F97316":"#3B82F6", borderRadius:99 }}/>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tarjetas de planes */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12 }}>
          {plans.map(p => {
            const isCurrent = p.key === effectivePlan;
            const isLoading = loading && selectedPlan === p.key;
            return (
              <div key={p.key} style={{ border:`2px solid ${isCurrent?"#3B82F6":"#E2E8F0"}`, borderRadius:14, padding:16, position:"relative" as const, background:isCurrent?"#EFF6FF":"#fff", display:"flex", flexDirection:"column", gap:8 }}>
                {isCurrent && (
                  <span style={{ position:"absolute" as const, top:-11, left:12, background:"#3B82F6", color:"#fff", fontSize:10, fontWeight:800, padding:"3px 10px", borderRadius:20 }}>
                    {isTrial && p.key === "empresarial" ? "PRUEBA GRATIS" : "PLAN ACTUAL"}
                  </span>
                )}
                <div style={{ fontWeight:800, fontSize:15, color:"#1E293B" }}>{p.label}</div>
                <div style={{ fontWeight:700, fontSize:18, color: p.priceUSD===0?"#10B981":"#3B82F6", marginBottom:4 }}>
                  {p.priceUSD===0 ? "Gratis" : `$${p.priceUSD} USD`}
                  {p.priceUSD>0 && <span style={{ fontSize:12, fontWeight:400, color:"#94A3B8" }}>/mes</span>}
                </div>
                <div style={{ flex:1 }}>
                  {p.features.map((f:string) => (
                    <div key={f} style={{ display:"flex", gap:6, fontSize:12, color:"#475569", marginBottom:5, alignItems:"flex-start" }}>
                      <Icon name="check" size={12} color="#10B981"/><span>{f}</span>
                    </div>
                  ))}
                </div>

                {/* Botones de pago solo en planes pagos y si no es el plan actual activo */}
                {p.payable && (!isCurrent || isTrial || isFailed) && user?.role === "admin" && (
                  <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:8 }}>
                    <button
                      style={{ background:"#1E293B", color:"#fff", border:"none", borderRadius:10, padding:"8px 10px", fontSize:12, fontWeight:700, cursor:loading?"not-allowed":"pointer", opacity:loading?0.6:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}
                      onClick={() => handleQvaPay(p.key)}
                      disabled={loading}>
                      {isLoading ? "Conectando..." : "💳 Pagar con QvaPay"}
                    </button>
                    <button
                      style={{ background:"#25D366", color:"#fff", border:"none", borderRadius:10, padding:"8px 10px", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}
                      onClick={() => handleWhatsApp(p.key, p.priceUSD)}>
                      💬 Pagar por WhatsApp
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ fontSize:12, color:"#94A3B8", textAlign:"center" as const }}>
          Los pagos por QvaPay se renuevan automáticamente cada 30 días. Puedes cancelar en cualquier momento.
        </div>

        <button style={{ ...btn("secondary"), fontSize:14 }} onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
};

// ─── CONTABILIDAD ─────────────────────────────────────────────────────────────
// ─── FACTURACIÓN (cajero + admin) ────────────────────────────────────────────
const Facturacion = ({ user, showToast, onSyncRefresh }: { user: any; showToast: (m:string,t:string)=>void; onSyncRefresh?: ()=>void }) => {
  const [sales, setSales]     = useState<any[]>([]);
  const [offlineSales, setOfflineSales] = useState<OfflineSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [viewInv, setViewInv] = useState<any>(null);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm]   = useState<any>({});
  const [saving, setSaving]   = useState(false);
  const [showOffline, setShowOffline] = useState(true);
  const facOnline = useOnlineStatus();

  const load = useCallback(async()=>{
    try {
      setLoading(true);
      // Cargar facturas offline siempre
      const offline = await getAllOfflineSales();
      setOfflineSales(offline);
      // Cargar del servidor si hay conexión
      if (facOnline) {
        const list = await apiFetch("/sales");
        setSales(list);
      }
    } catch(e:any) { showToast(e.message,"error"); }
    finally { setLoading(false); }
  },[facOnline]);
  useEffect(()=>{ load(); },[load]);

  const filtered = sales.filter(s=>
    (s.invoiceNumber||s.id||"").toLowerCase().includes(search.toLowerCase()) ||
    (s.clientName||s.client||"").toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (s:any) => {
    setEditForm({
      clientName: s.clientName || s.client || "",
      clientNit:  s.clientNit  || "",
      clientPhone:s.clientPhone|| "",
      payMethod:  s.payMethod  || "efectivo",
    });
    setEditModal(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await apiFetch(`/sales/${viewInv.id}`, { method:"PUT", body: editForm });
      showToast("Factura actualizada","success");
      setEditModal(false);
      load();
      setViewInv(null);
    } catch(e:any) { showToast(e.message,"error"); }
    finally { setSaving(false); }
  };

  const voidSale = async (id:string) => {
    if (!confirm("¿Anular esta factura? El stock se repondrá automáticamente.")) return;
    try {
      await apiFetch(`/sales/${id}/void`, { method:"POST" });
      showToast("Factura anulada. Stock repuesto.","warning");
      setViewInv(null);
      load();
    } catch(e:any) { showToast(e.message,"error"); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:800, color:"#1E293B" }}>Facturas</h2>
          <p style={{ margin:0, fontSize:14, color:"#64748B" }}>
            {sales.filter(s=>s.status==="emitida").length} emitidas · ${fmt(sales.filter(s=>s.status==="emitida").reduce((a,s)=>a+Number(s.total),0))} CUP
            {offlineSales.filter(s=>s.status==="pending").length > 0 && <span style={{ marginLeft:8, background:"#F97316", color:"#ffffff", borderRadius:20, padding:"1px 8px", fontSize:11, fontWeight:700 }}>{offlineSales.filter(s=>s.status==="pending").length} offline</span>}
            {offlineSales.filter(s=>s.status==="conflict").length > 0 && <span style={{ marginLeft:4, background:"#3B82F6", color:"#ffffff", borderRadius:20, padding:"1px 8px", fontSize:11, fontWeight:700 }}>{offlineSales.filter(s=>s.status==="conflict").length} conflicto</span>}
          </p>
        </div>
        <button style={btn("secondary")} onClick={load}><Icon name="refresh" size={15}/>Actualizar</button>
      </div>

      {/* Ventas offline pendientes */}
      {offlineSales.filter(s=>s.status==="pending"||s.status==="conflict").length > 0 && (
        <div style={{ background:"#FFF7ED", border:"1px solid #f0d070", borderRadius:16, padding:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:"#9A3412" }}>⚡ Ventas offline</h3>
            <button style={{ ...btn("ghost"), fontSize:12, padding:"4px 10px" }} onClick={()=>setShowOffline(v=>!v)}>{showOffline?"Ocultar":"Mostrar"}</button>
          </div>
          {showOffline && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {offlineSales.filter(s=>s.status==="pending"||s.status==="conflict").map(s=>(
                <div key={s.localId} style={{ background:"#ffffff", borderRadius:12, padding:"12px 14px", border:`1px solid ${s.status==="conflict"?"#f0c0c0":"#FED7AA"}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                    <div>
                      <span style={{ fontWeight:700, fontSize:13, fontFamily:"monospace", color:"#3B82F6" }}>{s.localId}</span>
                      <span style={{ fontSize:11, color:"#64748B", marginLeft:8 }}>{new Date(s.timestamp).toLocaleString("es-CU")}</span>
                    </div>
                    <Badge label={s.status==="conflict"?"Conflicto":"Pendiente"} color={s.status==="conflict"?"#3B82F6":"#F97316"}/>
                  </div>
                  <div style={{ fontSize:12, color:"#475569", marginBottom:4 }}>
                    {s.client} · <strong>${fmt(s.total)}</strong> · {s.items.map((i:any)=>`${i.qty}x ${i.name}`).join(", ")}
                  </div>
                  {s.status==="conflict" && (
                    <div style={{ fontSize:11, color:"#3B82F6", marginBottom:8 }}>⚠ {s.conflictReason}</div>
                  )}
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" as any, marginTop:6 }}>
                    {s.status==="conflict" && (
                      <button style={{ ...btn("primary"), fontSize:11, padding:"5px 10px" }}
                        onClick={async()=>{
                          // Reintentar manualmente
                          const { updateSaleStatus: upd } = await import("./offlineDB");
                          await upd(s.localId, "pending");
                          load();
                          if(onSyncRefresh) onSyncRefresh();
                        }}>
                        ↺ Reintentar
                      </button>
                    )}
                    <button style={{ ...btn("danger"), fontSize:11, padding:"5px 10px" }}
                      onClick={async()=>{
                        if(!confirm(`¿Descartar la venta ${s.localId}? El stock local ya fue restaurado.`)) return;
                        const { updateSaleStatus: upd, restoreLocalStock: rls } = await import("./offlineDB");
                        if(s.status==="pending") await rls(s.items);
                        await upd(s.localId, "synced"); // marcar como procesada para ocultarla
                        load();
                        if(onSyncRefresh) onSyncRefresh();
                      }}>
                      🗑 Descartar
                    </button>
                    <button style={{ ...btn("secondary"), fontSize:11, padding:"5px 10px" }}
                      onClick={()=>{
                        const lines = ["Venta: " + s.localId, "Cliente: " + s.client, "Total: $" + fmt(s.total), "Productos:"];
                        s.items.forEach((i:any) => lines.push("  - " + i.qty + "x " + i.name + " @ $" + fmt(i.price)));
                        if (s.conflictReason) lines.push("", "Error: " + s.conflictReason);
                        alert(lines.join("\n"));
                      }}>
                      👁 Ver detalle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ position:"relative" as any }}>
        <span style={{ position:"absolute" as any, left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" as any }}><Icon name="search" size={15} color="#64748B"/></span>
        <input style={{ ...inp, paddingLeft:34 }} placeholder="Buscar por No. factura o cliente..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {loading ? <Spinner/> : (
        <div style={{ background:"#ffffff", borderRadius:16, border:"1px solid #e8e0d8", overflowX:"auto", WebkitOverflowScrolling:"touch" as any }}>
          <table style={{ width:"100%", minWidth:700, borderCollapse:"collapse" }}>
            <thead><tr style={{ background:"#F1F5F9" }}>
              {["No. Factura","Fecha","Cliente","Total","Método","Estado",""].map(h=>(
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase" as any, whiteSpace:"nowrap" as any }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(s=>(
                <tr key={s.id} style={{ borderTop:"1px solid #f0ebe4", opacity:s.status==="anulada"?0.5:1 }}>
                  <td style={{ padding:"11px 14px", fontSize:12, fontWeight:700, color:"#3B82F6", fontFamily:"monospace" }}>{s.invoiceNumber||s.id}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, color:"#475569" }}>{(s.date||s.createdAt||"").split("T")[0]}</td>
                  <td style={{ padding:"11px 14px", fontSize:13 }}>{s.clientName||s.client}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, fontWeight:700 }}>${fmt(s.total)}</td>
                  <td style={{ padding:"11px 14px" }}><Badge label={PAY_METHODS.find(p=>p.id===s.payMethod)?.label||s.payMethod} color="#3B82F6"/></td>
                  <td style={{ padding:"11px 14px" }}><Badge label={s.status==="emitida"?"Emitida":"Anulada"} color={s.status==="emitida"?"#10B981":"#3B82F6"}/></td>
                  <td style={{ padding:"11px 14px" }}>
                    <button style={{ ...btn("ghost"), padding:"5px 10px", fontSize:12 }} onClick={()=>setViewInv(s)}>
                      <Icon name="eye" size={14}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length===0 && <div style={{ padding:40, textAlign:"center", color:"#64748B" }}>No hay facturas</div>}
        </div>
      )}

      {viewInv && (
        <Modal title={`Factura ${viewInv.invoiceNumber||viewInv.id}`} onClose={()=>setViewInv(null)} width={520}>
          <div style={{ fontFamily:"monospace", fontSize:12, lineHeight:1.9, background:"#F1F5F9", padding:20, borderRadius:12, border:"1px solid #e8e0d8" }}>
            <div style={{ textAlign:"center", marginBottom:14 }}>
              <div style={{ fontWeight:800, fontSize:15 }}>CUBAGEST</div>
              <div>FACTURA No. <strong style={{ color:"#3B82F6" }}>{viewInv.invoiceNumber||viewInv.id}</strong></div>
              {viewInv.status==="anulada" && <div style={{ color:"#3B82F6", fontWeight:800 }}>⚠ ANULADA</div>}
            </div>
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"8px 0" }}/>
            <div>Fecha: {(viewInv.date||viewInv.createdAt||"").split("T")[0]}</div>
            <div>Cliente: {viewInv.clientName||viewInv.client}</div>
            {viewInv.clientNit && <div>NIT: {viewInv.clientNit}</div>}
            {viewInv.clientPhone && <div>Teléfono: {viewInv.clientPhone}</div>}
            <div>Método: {PAY_METHODS.find(p=>p.id===viewInv.payMethod)?.label||viewInv.payMethod}</div>
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"8px 0" }}/>
            {(viewInv.items||viewInv.SaleItems||[]).map((item:any,i:number)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between" }}>
                <span>{item.qty}x {item.name}</span>
                <span>${fmt(item.total||item.price*item.qty)}</span>
              </div>
            ))}
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"8px 0" }}/>
            <div style={{ display:"flex", justifyContent:"space-between", fontWeight:800, fontSize:14 }}><span>TOTAL:</span><span>${fmt(viewInv.total)} CUP</span></div>
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:16, flexWrap:"wrap" as any }}>
            {viewInv.status==="emitida" && (
              <>
                <button style={btn("danger")} onClick={()=>voidSale(viewInv.id)}>Anular</button>
                <button style={btn("secondary")} onClick={()=>openEdit(viewInv)}><Icon name="edit" size={14}/>Editar datos</button>
              </>
            )}
            <button style={btn("secondary")} onClick={()=>setViewInv(null)}>Cerrar</button>
            <button style={btn("primary")} onClick={()=>window.print()}><Icon name="print" size={15}/>Imprimir</button>
          </div>
        </Modal>
      )}

      {editModal && viewInv && (
        <Modal title="Editar datos de factura" onClose={()=>setEditModal(false)} width={440}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ background:"#FFF7ED", border:"1px solid #f0d070", borderRadius:12, padding:12, fontSize:12, color:"#9A3412" }}>
              ⚠ Solo se pueden editar los datos del cliente y método de pago. Los productos y totales no cambian.
            </div>
            <Field label="Nombre del cliente"><input style={inp} value={editForm.clientName} onChange={e=>setEditForm((f:any)=>({...f,clientName:e.target.value}))}/></Field>
            <Field label="NIT"><input style={inp} value={editForm.clientNit} onChange={e=>setEditForm((f:any)=>({...f,clientNit:e.target.value}))} maxLength={11}/></Field>
            <Field label="Teléfono"><input style={inp} value={editForm.clientPhone} onChange={e=>setEditForm((f:any)=>({...f,clientPhone:e.target.value}))}/></Field>
            <Field label="Método de pago">
              <select style={sel} value={editForm.payMethod} onChange={e=>setEditForm((f:any)=>({...f,payMethod:e.target.value}))}>
                {PAY_METHODS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Field>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button style={btn("secondary")} onClick={()=>setEditModal(false)}>Cancelar</button>
              <button style={{ ...btn("primary"), opacity:saving?0.6:1 }} onClick={saveEdit} disabled={saving}>{saving?"Guardando...":"Guardar"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Contabilidad = ({ showToast }: { showToast: (m:string,t:string)=>void }) => {
  const [sales, setSales]       = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("ingresos");
  const [modal, setModal]       = useState(false);
  const [viewInv, setViewInv]   = useState<any>(null);
  const [form, setForm]         = useState({ date:today(), concept:"", amount:"", category:"Compras", method:"efectivo" });
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async()=>{
    try {
      setLoading(true);
      const [s,e] = await Promise.all([apiFetch("/sales"), apiFetch("/expenses")]);
      setSales(s); setExpenses(e);
    } catch(err:any) { showToast(err.message,"error"); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{ load(); },[load]);

  const totalIncome = sales.filter(s=>s.status==="emitida").reduce((a,s)=>a+Number(s.total),0);
  const totalExp    = expenses.reduce((a,e)=>a+Number(e.amount),0);
  const net         = totalIncome - totalExp;

  const exportarInforme = () => {
    const TAX_RATE = 0.10;
    const totalIncome = sales.filter((s:any)=>s.status==="emitida").reduce((a:number,s:any)=>a+Number(s.total),0);
    const totalExp    = expenses.reduce((a:number,e:any)=>a+Number(e.amount),0);
    const totalTax    = Math.round(totalIncome * TAX_RATE);
    const net         = totalIncome - totalExp;
    const mes         = new Date().toLocaleString("es-CU",{month:"long",year:"numeric"});
    const win = window.open("","_blank","width=700,height=900");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
      <title>Informe Fiscal CubaGest</title>
      <style>
        body{font-family:Arial,sans-serif;padding:40px;color:#1a1410;max-width:600px;margin:0 auto}
        h1{color:#8B1A1A;font-size:20px;margin-bottom:4px}
        .sub{color:#8a7060;font-size:13px;margin-bottom:32px}
        table{width:100%;border-collapse:collapse;margin-bottom:24px}
        th{text-align:left;font-size:11px;text-transform:uppercase;color:#8a7060;padding:8px 0;border-bottom:2px solid #e8e0d8}
        td{padding:10px 0;border-bottom:1px solid #f0ebe4;font-size:14px}
        .total{font-weight:800;font-size:16px}
        .red{color:#8B1A1A} .green{color:#1A7A3C}
        .box{border:1px solid #e8e0d8;border-radius:8px;padding:16px;margin-bottom:16px}
        .note{font-size:11px;color:#8a7060;margin-top:32px;border-top:1px solid #e8e0d8;padding-top:12px}
        @media print{button{display:none}}
      </style></head><body>
      <h1>CubaGest — Informe Fiscal</h1>
      <p class="sub">Período: ${mes} · Generado: ${new Date().toLocaleDateString("es-CU")}</p>
      <div class="box">
        <table>
          <tr><th>Concepto</th><th style="text-align:right">Monto (CUP)</th></tr>
          <tr><td>Ingresos brutos por ventas</td><td style="text-align:right">${fmt(totalIncome)}</td></tr>
          <tr><td class="red">Total egresos registrados</td><td class="red" style="text-align:right">${fmt(totalExp)}</td></tr>
          <tr class="total"><td class="${net>=0?"green":"red"}">Utilidad neta</td><td class="${net>=0?"green":"red"}" style="text-align:right">${fmt(net)}</td></tr>
        </table>
      </div>
      <h3 style="font-size:14px;margin-bottom:12px">Detalle de Egresos</h3>
      <table>
        <tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th style="text-align:right">Monto</th></tr>
        ${expenses.map((e:any)=>"<tr><td>"+(e.date||e.createdAt||"").split("T")[0]+"</td><td>"+e.concept+"</td><td>"+e.category+"</td><td style=\"text-align:right\">"+fmt(Number(e.amount))+"</td></tr>").join("")}
      </table>
      <p class="note">Este informe es generado automáticamente por CubaGest para uso interno.<br/>
      Los datos son orientativos. Consulte con su contador para la declaración oficial.</p>
      <br/><button onclick="window.print()" style="background:#8B1A1A;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:14px">🖨 Imprimir / Guardar PDF</button>
    </body></html>`);
    win.document.close();
  };

  const addExpense = async()=>{
    if (!form.concept||!form.amount) return showToast("Complete los campos requeridos","error");
    setSaving(true);
    try {
      await apiFetch("/expenses", { method:"POST", body:{ ...form, amount:Number(form.amount) }});
      showToast("Gasto registrado","success");
      setModal(false);
      setForm({ date:today(), concept:"", amount:"", category:"Compras", method:"efectivo" });
      load();
    } catch(e:any) { showToast(e.message,"error"); }
    finally { setSaving(false); }
  };


  if (loading) return <Spinner/>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:800, color:"#1E293B" }}>Contabilidad</h2>
          <p style={{ margin:0, fontSize:14, color:"#64748B" }}>Registro contable</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={btn("secondary")} onClick={load}><Icon name="refresh" size={15}/>Actualizar</button>
          <button style={btn("secondary")} onClick={exportarInforme}><Icon name="print" size={15}/>Informe Fiscal</button>
          <button style={btn("primary")} onClick={()=>setModal(true)}><Icon name="plus" size={16}/>Registrar Gasto</button>
        </div>
      </div>

      <div style={{ display:"flex", gap:4, background:"#E2E8F0", borderRadius:12, padding:4, width:"fit-content" }}>
        {[["ingresos","Ingresos"],["gastos","Egresos"],["facturas","Facturas"]].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} style={{ ...btn(tab===v?"primary":"ghost"), padding:"7px 16px", fontSize:13, borderRadius:7 }}>{l}</button>
        ))}
      </div>



      {tab==="ingresos" && (
        <div style={{ background:"#ffffff", borderRadius:16, border:"1px solid #e8e0d8", overflowX:"auto", WebkitOverflowScrolling:"touch" as any }}>
          <table style={{ width:"100%", minWidth:750, borderCollapse:"collapse" }}>
            <thead><tr style={{ background:"#F1F5F9" }}>
              {["No. Factura","Fecha","Cliente","NIT","Teléfono","Total","Método"].map(h=>(
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {sales.filter(s=>s.status==="emitida").map(s=>(
                <tr key={s.id} onClick={()=>setViewInv(s)} style={{ borderTop:"1px solid #f0ebe4", cursor:"pointer" }}>
                  <td style={{ padding:"11px 14px", fontSize:13, fontWeight:600, color:"#3B82F6", fontFamily:"monospace" }}>{s.id}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, color:"#475569" }}>{(s.date||s.createdAt||"").split("T")[0]}</td>
                  <td style={{ padding:"11px 14px", fontSize:13 }}>{s.client}</td>
                  <td style={{ padding:"11px 14px", fontSize:12, color:"#64748B", fontFamily:"monospace" }}>{s.clientNit || "—"}</td>
                  <td style={{ padding:"11px 14px", fontSize:12, color:"#64748B" }}>{s.clientPhone || "—"}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, fontWeight:700 }}>${fmt(s.total)}</td>
                  <td style={{ padding:"11px 14px" }}><Badge label={PAY_METHODS.find(p=>p.id===s.payMethod)?.label||s.payMethod} color="#3B82F6"/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==="gastos" && (
        <div style={{ background:"#ffffff", borderRadius:16, border:"1px solid #e8e0d8", overflowX:"auto", WebkitOverflowScrolling:"touch" as any }}>
          <table style={{ width:"100%", minWidth:500, borderCollapse:"collapse" }}>
            <thead><tr style={{ background:"#F1F5F9" }}>
              {["Fecha","Concepto","Categoría","Método","Monto"].map(h=>(
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {expenses.map(e=>(
                <tr key={e.id} style={{ borderTop:"1px solid #f0ebe4" }}>
                  <td style={{ padding:"11px 14px", fontSize:13, color:"#475569" }}>{(e.date||e.createdAt||"").split("T")[0]}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, fontWeight:600 }}>{e.concept}</td>
                  <td style={{ padding:"11px 14px" }}><Badge label={e.category} color="#5a3a1a"/></td>
                  <td style={{ padding:"11px 14px" }}><Badge label={PAY_METHODS.find(p=>p.id===e.method)?.label||e.method} color="#3B82F6"/></td>
                  <td style={{ padding:"11px 14px", fontSize:14, fontWeight:700, color:"#3B82F6" }}>${fmt(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {expenses.length===0 && <div style={{ padding:40, textAlign:"center", color:"#64748B" }}>No hay egresos registrados</div>}
        </div>
      )}

      {tab==="facturas" && (
        <div style={{ background:"#ffffff", borderRadius:16, border:"1px solid #e8e0d8", overflowX:"auto", WebkitOverflowScrolling:"touch" as any }}>
          <table style={{ width:"100%", minWidth:800, borderCollapse:"collapse" }}>
            <thead><tr style={{ background:"#F1F5F9" }}>
              {["No. Factura","Fecha","Cliente","NIT","Teléfono","Total","Método","Estado"].map(h=>(
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase" as any, whiteSpace:"nowrap" as any }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {sales.filter((s:any)=>s.status==="emitida").map((s:any)=>(
                <tr key={s.id} onClick={()=>setViewInv(s)} style={{ borderTop:"1px solid #f0ebe4", cursor:"pointer" }}>
                  <td style={{ padding:"11px 14px", fontSize:13, fontWeight:600, color:"#3B82F6", fontFamily:"monospace" }}>{s.id}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, color:"#475569" }}>{(s.date||s.createdAt||"").split("T")[0]}</td>
                  <td style={{ padding:"11px 14px", fontSize:13 }}>{s.client}</td>
                  <td style={{ padding:"11px 14px", fontSize:12, color:"#64748B", fontFamily:"monospace" }}>{s.clientNit || "—"}</td>
                  <td style={{ padding:"11px 14px", fontSize:12, color:"#64748B" }}>{s.clientPhone || "—"}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, fontWeight:700 }}>${fmt(s.total)}</td>
                  <td style={{ padding:"11px 14px" }}><Badge label={PAY_METHODS.find((p:any)=>p.id===s.payMethod)?.label||s.payMethod} color="#3B82F6"/></td>
                  <td style={{ padding:"11px 14px" }}><Badge label="Emitida" color="#10B981"/></td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.filter((s:any)=>s.status==="emitida").length===0 && <div style={{ padding:40, textAlign:"center", color:"#64748B" }}>No hay facturas emitidas</div>}
        </div>
      )}

      {viewInv && (
        <Modal title={`Factura ${viewInv.id}`} onClose={()=>setViewInv(null)} width={520}>
          <div style={{ fontFamily:"monospace", fontSize:12, lineHeight:1.9, background:"#F1F5F9", padding:20, borderRadius:12, border:"1px solid #e8e0d8" }}>
            <div style={{ textAlign:"center", marginBottom:14 }}>
              <div style={{ fontWeight:800, fontSize:15 }}>CUBAGEST</div>
              <div>FACTURA COMERCIAL No. <strong style={{ color:"#3B82F6", fontSize:15 }}>{viewInv.id}</strong></div>
              {viewInv.status==="anulada" && <div style={{ color:"#3B82F6", fontWeight:800 }}>⚠ ANULADA</div>}
            </div>
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"8px 0" }}/>
            <div>Fecha: {(viewInv.date||viewInv.createdAt||"").split("T")[0]}</div>
            <div>Cliente: {viewInv.client}</div>
            <div>NIT: {viewInv.clientNit || "—"}</div>
            <div>Teléfono: {viewInv.clientPhone || "—"}</div>
            <div>Método: {PAY_METHODS.find(p=>p.id===viewInv.payMethod)?.label||viewInv.payMethod}</div>
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"8px 0" }}/>
            {(viewInv.items||viewInv.SaleItems||[]).map((item:any,i:number)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between" }}>
                <span>{item.qty}x {item.name||item.Product?.name}</span>
                <span>${fmt(item.total||item.price*item.qty)}</span>
              </div>
            ))}
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"8px 0" }}/>
            <div style={{ display:"flex", justifyContent:"space-between", fontWeight:800, fontSize:14, marginTop:4 }}><span>TOTAL:</span><span>${fmt(viewInv.total)} CUP</span></div>
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"8px 0" }}/>
            <div style={{ textAlign:"center", fontSize:10, color:"#888" }}>Gracias por su preferencia</div>
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:16 }}>
            <button style={btn("secondary")} onClick={()=>setViewInv(null)}>Cerrar</button>
            <button style={btn("primary")} onClick={()=>window.print()}><Icon name="print" size={15}/>Imprimir</button>
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title="Registrar Egreso" onClose={()=>setModal(false)} width={460}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <Field label="Fecha" required><input style={inp} type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></Field>
              <Field label="Categoría" required>
                <select style={sel} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                  {EXPENSE_CATS.map(c=><option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Concepto" required><input style={inp} value={form.concept} onChange={e=>setForm(f=>({...f,concept:e.target.value}))}/></Field>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <Field label="Monto (CUP)" required><input style={inp} type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/></Field>
              <Field label="Método de Pago">
                <select style={sel} value={form.method} onChange={e=>setForm(f=>({...f,method:e.target.value}))}>
                  {PAY_METHODS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button style={btn("secondary")} onClick={()=>setModal(false)}>Cancelar</button>
              <button style={{ ...btn("primary"), opacity:saving?0.6:1 }} onClick={addExpense} disabled={saving}>{saving?"Guardando...":"Guardar"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── CIERRE DE CAJA ───────────────────────────────────────────────────────────
const CierreCaja = ({ user, showToast }: { user: any; showToast: (m: string, t: string) => void }) => {
  const [view, setView]               = useState<"list"|"selectReading"|"validate"|"detail">("list");
  const [closings, setClosings]       = useState<any[]>([]);
  const [readings, setReadings]       = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [selectedReading, setSelectedReading] = useState<any>(null);
  const [preview, setPreview]         = useState<any>(null);
  const [validatedItems, setValidatedItems]   = useState<Record<string, number>>({});
  const [detailClosing, setDetailClosing]     = useState<any>(null);
  const [confirmReading, setConfirmReading]   = useState(false);
  const [notes, setNotes]             = useState("");

  const isAdmin = user.role === "admin";

  const loadClosings = useCallback(async () => {
    try {
      setLoading(true);
      const list = await apiFetch("/closing");
      setClosings(list);
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadClosings(); }, [loadClosings]);

  const loadReadings = async () => {
    try {
      const list = await apiFetch("/closing/readings");
      setReadings(list);
    } catch (e: any) { showToast(e.message, "error"); }
  };

  const startClosing = async () => {
    await loadReadings();
    setView("selectReading");
  };

  const selectReading = async (reading: any) => {
    try {
      setSaving(true);
      setSelectedReading(reading);
      const data = await apiFetch(`/closing/preview/${reading.id}`);
      setPreview(data);
      const initValidated: Record<string, number> = {};
      for (const item of data.items) initValidated[item.productId] = item.stockValidated;
      setValidatedItems(initValidated);
      setView("validate");
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const confirmClosing = async () => {
    try {
      setSaving(true);
      const items = Object.entries(validatedItems).map(([productId, stockValidated]) => ({ productId, stockValidated }));
      await apiFetch("/closing/confirm", { method: "POST", body: { initialReadingId: selectedReading.id, items, notes } });
      showToast("Cierre registrado correctamente", "success");
      setView("list"); setPreview(null); setNotes(""); loadClosings();
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const takeReading = async () => {
    try {
      setSaving(true);
      await apiFetch("/closing/readings", { method: "POST", body: { notes: "Lectura de apertura manual" } });
      showToast("Lectura de inventario tomada", "success");
      setConfirmReading(false);
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("es-CU", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });

  const tbl = { width:"100%", borderCollapse:"collapse" as const, fontSize:13 };
  const th  = { padding:"10px 12px", textAlign:"left" as const, fontWeight:700, color:"#475569", fontSize:11, textTransform:"uppercase" as const, borderBottom:"1px solid #E2E8F0", whiteSpace:"nowrap" as const };
  const td  = (highlight?: boolean) => ({ padding:"10px 12px", borderBottom:"1px solid #F1F5F9", background: highlight ? "#FFF7ED" : "#fff" });

  // ── Lista ───────────────────────────────────────────────────────────────────
  if (view === "list") return (
    <div style={{ maxWidth:900, margin:"0 auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap" as const, gap:12 }}>
        <div>
          <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:800, color:"#1E293B" }}>Cierre de Caja</h2>
          <p style={{ margin:0, fontSize:13, color:"#64748B" }}>Conciliación de ventas, stock e ingresos</p>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          {isAdmin && (
            <button style={{ ...btn("secondary"), fontSize:13 }} onClick={() => setConfirmReading(true)}>
              <Icon name="refresh" size={15}/>Lectura de apertura
            </button>
          )}
          <button style={{ ...btn("primary"), fontSize:13 }} onClick={startClosing}>
            <Icon name="check" size={15}/>Iniciar cierre
          </button>
        </div>
      </div>

      {loading ? <Spinner/> : closings.length === 0 ? (
        <div style={{ textAlign:"center" as const, padding:60, color:"#94A3B8" }}>
          <Icon name="cierre" size={40} color="#CBD5E1"/>
          <p style={{ marginTop:12, fontSize:14 }}>No hay cierres registrados aún</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {closings.map((c: any) => {
            const hasShortage = c.items?.some((i: any) => i.shortage > 0.001);
            return (
              <div key={c.id} style={{ background:"#fff", borderRadius:14, padding:16, boxShadow:"0 1px 6px rgba(15,23,42,0.07)", border:"1px solid #E2E8F0", cursor:"pointer" }}
                onClick={() => { setDetailClosing(c); setView("detail"); }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap" as const, gap:8 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15, color:"#1E293B" }}>Cierre — {fmtDate(c.createdAt)}</div>
                    <div style={{ fontSize:12, color:"#64748B", marginTop:3 }}>
                      Por {c.closedBy?.name || "—"} · {fmtDate(c.periodStart)} → {fmtDate(c.periodEnd)}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    {hasShortage && <Badge label="⚠ Faltantes" color="#F97316"/>}
                    <Badge label={`${c.totalSales} ventas`} color="#3B82F6"/>
                  </div>
                </div>
                <div style={{ display:"flex", gap:24, marginTop:12, flexWrap:"wrap" as const }}>
                  {[{ l:"Total ingresos", v:`${fmt(c.totalIncome)} CUP`, c:"#10B981" },
                    { l:"Efectivo", v:`${fmt(c.incomeEfectivo)} CUP`, c:"#1E293B" },
                    { l:"Transferencia", v:`${fmt(c.incomeTransferencia)} CUP`, c:"#1E293B" }].map(s=>(
                    <div key={s.l}>
                      <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, textTransform:"uppercase" as const }}>{s.l}</div>
                      <div style={{ fontSize:15, fontWeight:800, color:s.c }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmReading && (
        <Modal title="Tomar lectura de inventario" onClose={() => setConfirmReading(false)} width={440}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:12, padding:14 }}>
              <div style={{ fontWeight:700, color:"#C2410C", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                <Icon name="alert" size={16} color="#C2410C"/>Antes de continuar
              </div>
              <ul style={{ margin:0, paddingLeft:18, fontSize:13, color:"#7C2D12", lineHeight:1.7 }}>
                <li>Registrará el stock actual como punto de partida del próximo cierre.</li>
                <li>Si hay ventas sin cerrar desde la última lectura, <strong>quedarán fuera del período</strong>.</li>
                <li>Hazlo solo al abrir el negocio o al cambiar de turno.</li>
                <li>No se puede deshacer.</li>
              </ul>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button style={btn("secondary")} onClick={() => setConfirmReading(false)}>Cancelar</button>
              <button style={{ ...btn("primary"), opacity:saving?0.6:1 }} onClick={takeReading} disabled={saving}>
                {saving ? "Tomando lectura..." : "Tomar lectura"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );

  // ── Seleccionar lectura ─────────────────────────────────────────────────────
  if (view === "selectReading") return (
    <div style={{ maxWidth:600, margin:"0 auto" }}>
      <button style={{ ...btn("ghost"), marginBottom:16, paddingLeft:0 }} onClick={() => setView("list")}>← Volver</button>
      <h2 style={{ margin:"0 0 6px", fontSize:20, fontWeight:800, color:"#1E293B" }}>Iniciar cierre</h2>
      <p style={{ margin:"0 0 20px", fontSize:13, color:"#64748B" }}>
        Elige desde cuándo contar las ventas. El stock registrado en esa fecha será el punto de partida.
      </p>
      {readings.length === 0 ? (
        <div style={{ background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:12, padding:16 }}>
          <div style={{ fontWeight:700, color:"#C2410C", marginBottom:6 }}>No hay lecturas disponibles</div>
          <p style={{ margin:0, fontSize:13, color:"#7C2D12" }}>
            Para hacer el primer cierre el administrador debe tomar una lectura de apertura primero.
          </p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {readings.map((r: any, i: number) => {
            const isRec = i === 0;
            const typeLabel = r.type === "apertura" ? "Lectura de apertura" : "Lectura al cierre anterior";
            return (
              <div key={r.id}
                style={{ border:isRec?"2px solid #3B82F6":"1px solid #E2E8F0", borderRadius:14, padding:16, background:isRec?"#EFF6FF":"#fff", cursor:saving?"not-allowed":"pointer", opacity:saving?0.6:1 }}
                onClick={() => !saving && selectReading(r)}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14, color:"#1E293B" }}>{typeLabel}</div>
                    <div style={{ fontSize:12, color:"#64748B", marginTop:3 }}>{fmtDate(r.createdAt)}</div>
                    {r.takenBy && <div style={{ fontSize:12, color:"#94A3B8", marginTop:2 }}>Por {r.takenBy.name}</div>}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    {isRec && <Badge label="Recomendado" color="#3B82F6"/>}
                  </div>
                </div>
                {!isRec && (
                  <div style={{ marginTop:8, fontSize:11, color:"#F97316", fontWeight:600 }}>
                    ⚠ Usar esta lectura excluirá las ventas entre esta fecha y la más reciente
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Validar stock ───────────────────────────────────────────────────────────
  if (view === "validate" && preview) {
    const itemsWithShortage = preview.items.filter((i: any) => (i.stockExpected - (validatedItems[i.productId] ?? i.stockValidated)) > 0.001);
    return (
      <div style={{ maxWidth:900, margin:"0 auto" }}>
        <button style={{ ...btn("ghost"), marginBottom:16, paddingLeft:0 }} onClick={() => setView("selectReading")}>← Cambiar lectura</button>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap" as const, gap:12, marginBottom:16 }}>
          <div>
            <h2 style={{ margin:"0 0 4px", fontSize:20, fontWeight:800, color:"#1E293B" }}>Validar stock del período</h2>
            <p style={{ margin:0, fontSize:13, color:"#64748B" }}>Desde {fmtDate(preview.periodStart)} · {preview.totalSales} ventas · {fmt(preview.totalIncome)} CUP</p>
          </div>
          <div style={{ display:"flex", gap:12, background:"#EFF6FF", borderRadius:12, padding:"10px 16px" }}>
            {[{ l:"Efectivo", v:preview.incomeEfectivo },{ l:"Transferencia", v:preview.incomeTransferencia }].map(s=>(
              <div key={s.l} style={{ textAlign:"center" as const }}>
                <div style={{ fontSize:11, color:"#3B82F6", fontWeight:600 }}>{s.l}</div>
                <div style={{ fontSize:15, fontWeight:800, color:"#1E293B" }}>{fmt(s.v)} CUP</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:12, padding:12, marginBottom:16, fontSize:13, color:"#1E40AF" }}>
          <strong>Instrucción:</strong> Cuenta físicamente cada producto y corrige el valor si difiere del esperado. La diferencia quedará registrada como faltante.
        </div>

        <div style={{ overflowX:"auto" as const, borderRadius:14, border:"1px solid #E2E8F0" }}>
          <table style={tbl}>
            <thead>
              <tr style={{ background:"#F8FAFC" }}>
                {["Producto","Stk. inicial","Vendido","Esperado","Conteo físico","Faltante","Ingreso"].map(h=>(
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.items.map((item: any) => {
                const validated = validatedItems[item.productId] ?? item.stockValidated;
                const shortage = parseFloat((item.stockExpected - validated).toFixed(3));
                const hasS = shortage > 0.001;
                return (
                  <tr key={item.productId}>
                    <td style={td(hasS)}><div style={{ fontWeight:600, color:"#1E293B" }}>{item.productName}</div><div style={{ fontSize:11, color:"#94A3B8" }}>{item.productCode}</div></td>
                    <td style={td(hasS)}>{item.stockInitial} {item.unit}</td>
                    <td style={td(hasS)}>{item.stockSold} {item.unit}</td>
                    <td style={{ ...td(hasS), fontWeight:600, color:"#1E293B" }}>{item.stockExpected} {item.unit}</td>
                    <td style={td(hasS)}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <input type="number" min={0} step="0.001" value={validated}
                          onChange={e => setValidatedItems(prev => ({ ...prev, [item.productId]: parseFloat(e.target.value)||0 }))}
                          style={{ ...inp, width:80, padding:"5px 8px", textAlign:"right" as const }}/>
                        <span style={{ fontSize:11, color:"#94A3B8" }}>{item.unit}</span>
                      </div>
                    </td>
                    <td style={{ ...td(hasS), fontWeight:700, color:hasS?"#F97316":"#10B981" }}>
                      {hasS ? `-${shortage} ${item.unit}` : "✓"}
                    </td>
                    <td style={{ ...td(hasS), color:"#10B981", fontWeight:600 }}>{fmt(item.income)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {itemsWithShortage.length > 0 && (
          <div style={{ background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:12, padding:12, marginTop:12, fontSize:13, color:"#C2410C", fontWeight:600 }}>
            ⚠ Se registrarán faltantes en {itemsWithShortage.length} producto(s). Estos quedarán en el historial.
          </div>
        )}

        <div style={{ marginTop:16 }}>
          <Field label="Observaciones (opcional)">
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notas sobre este cierre..."
              style={{ ...inp, minHeight:60, resize:"vertical" as const }}/>
          </Field>
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:16 }}>
          <button style={btn("secondary")} onClick={() => setView("selectReading")}>Cancelar</button>
          <button style={{ ...btn("primary"), opacity:saving?0.6:1 }} onClick={confirmClosing} disabled={saving}>
            {saving ? "Guardando cierre..." : "Confirmar cierre"}
          </button>
        </div>
      </div>
    );
  }

  // ── Detalle ─────────────────────────────────────────────────────────────────
  if (view === "detail" && detailClosing) {
    const c = detailClosing;
    const hasShortage = c.items?.some((i: any) => i.shortage > 0.001);
    return (
      <div style={{ maxWidth:900, margin:"0 auto" }}>
        <button style={{ ...btn("ghost"), marginBottom:16, paddingLeft:0 }} onClick={() => setView("list")}>← Volver a cierres</button>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap" as const, gap:12, marginBottom:20 }}>
          <div>
            <h2 style={{ margin:"0 0 4px", fontSize:20, fontWeight:800, color:"#1E293B" }}>Detalle del cierre</h2>
            <p style={{ margin:0, fontSize:13, color:"#64748B" }}>{fmtDate(c.createdAt)} · Cerrado por {c.closedBy?.name || "—"}</p>
          </div>
          <button style={btn("secondary")} onClick={() => window.print()}><Icon name="print" size={15}/>Imprimir</button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:20 }}>
          {[{ l:"Total ingresos", v:`${fmt(c.totalIncome)} CUP`, color:"#10B981" },
            { l:"Efectivo", v:`${fmt(c.incomeEfectivo)} CUP`, color:"#1E293B" },
            { l:"Transferencia", v:`${fmt(c.incomeTransferencia)} CUP`, color:"#1E293B" },
            { l:"Ventas realizadas", v:String(c.totalSales), color:"#3B82F6" }].map(s=>(
            <div key={s.l} style={{ background:"#fff", borderRadius:12, padding:"12px 16px", border:"1px solid #E2E8F0", boxShadow:"0 1px 4px rgba(15,23,42,0.05)" }}>
              <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, textTransform:"uppercase" as const }}>{s.l}</div>
              <div style={{ fontSize:18, fontWeight:800, color:s.color, marginTop:4 }}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize:12, color:"#64748B", marginBottom:10 }}>
          Período: {fmtDate(c.periodStart)} → {fmtDate(c.periodEnd)}
          {c.notes && <span> · <em>{c.notes}</em></span>}
        </div>

        {hasShortage && (
          <div style={{ background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:10, padding:10, marginBottom:12, fontSize:13, color:"#C2410C", fontWeight:600 }}>
            ⚠ Este cierre registra faltantes de inventario
          </div>
        )}

        <div style={{ overflowX:"auto" as const, borderRadius:14, border:"1px solid #E2E8F0" }}>
          <table style={tbl}>
            <thead>
              <tr style={{ background:"#F8FAFC" }}>
                {["Producto","Stk. inicial","Vendido","Esperado","Conteo físico","Faltante","Ingreso"].map(h=>(
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(c.items||[]).map((item: any, idx: number) => {
                const hasS = item.shortage > 0.001;
                return (
                  <tr key={idx}>
                    <td style={td(hasS)}><div style={{ fontWeight:600, color:"#1E293B" }}>{item.productName}</div><div style={{ fontSize:11, color:"#94A3B8" }}>{item.productCode}</div></td>
                    <td style={td(hasS)}>{item.stockInitial} {item.unit}</td>
                    <td style={td(hasS)}>{item.stockSold} {item.unit}</td>
                    <td style={{ ...td(hasS), fontWeight:600, color:"#1E293B" }}>{item.stockExpected} {item.unit}</td>
                    <td style={td(hasS)}>{item.stockValidated} {item.unit}</td>
                    <td style={{ ...td(hasS), fontWeight:700, color:hasS?"#F97316":"#10B981" }}>
                      {hasS ? `-${item.shortage} ${item.unit}` : "✓"}
                    </td>
                    <td style={{ ...td(hasS), color:"#10B981", fontWeight:600 }}>{fmt(item.income)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return null;
};

// ─── USUARIOS ─────────────────────────────────────────────────────────────────
const Usuarios = ({ currentUser, showToast }: { currentUser: any; showToast: (m:string,t:string)=>void }) => {
  const [users, setUsers]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [form, setForm]     = useState({ name:"", email:"", password:"", role:"cajero" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async()=>{
    try { setLoading(true); const list = await apiFetch("/users"); setUsers(list); }
    catch(e:any) { showToast(e.message,"error"); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{ load(); },[load]);

  const openAdd  = () => { setEditUser(null); setForm({ name:"", email:"", password:"", role:"cajero" }); setModal(true); };
  const openEdit = (u:any) => { setEditUser(u); setForm({ name:u.name, email:u.email, password:"", role:u.role }); setModal(true); };

  const saveUser = async()=>{
    if (!form.name||!form.email||((!editUser)&&!form.password)) return showToast("Complete todos los campos","error");
    setSaving(true);
    try {
      if (editUser) {
        const payload: any = { name:form.name, role:form.role };
        if (form.password) payload.password = form.password;
        await apiFetch(`/users/${editUser.id}`, { method:"PUT", body:payload });
        showToast("Usuario actualizado","success");
      } else {
        await apiFetch("/users", { method:"POST", body:form });
        showToast("Usuario creado correctamente","success");
      }
      setModal(false);
      load();
    } catch(e:any) { showToast(e.message,"error"); }
    finally { setSaving(false); }
  };

  const deleteUser = async(id:string)=>{
    if (!confirm("¿Eliminar este usuario?")) return;
    try { await apiFetch(`/users/${id}`, { method:"DELETE" }); showToast("Usuario eliminado","info"); load(); }
    catch(e:any) { showToast(e.message,"error"); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:800, color:"#1E293B" }}>Usuarios y Roles</h2>
          <p style={{ margin:0, fontSize:14, color:"#64748B" }}>{users.length} usuarios registrados</p>
        </div>
        <button style={btn("primary")} onClick={openAdd}><Icon name="plus" size={16}/>Nuevo Usuario</button>
      </div>

      {loading ? <Spinner/> : (
        <div style={{ background:"#ffffff", borderRadius:16, border:"1px solid #e8e0d8", overflowX:"auto", WebkitOverflowScrolling:"touch" as any }}>
          <table style={{ width:"100%", minWidth:700, borderCollapse:"collapse" }}>
            <thead><tr style={{ background:"#F1F5F9" }}>
              {["Nombre","Correo","Rol","Permisos","Acciones"].map(h=>(
                <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:"0.5px" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {users.map(u=>(
                <tr key={u.id} style={{ borderTop:"1px solid #f0ebe4" }}>
                  <td style={{ padding:"14px 16px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:36, height:36, borderRadius:50, background:ROLES[u.role]?.color||"#888", color:"#ffffff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700 }}>{u.name?.charAt(0)}</div>
                      <div>
                        <p style={{ margin:0, fontSize:14, fontWeight:700, color:"#1E293B" }}>{u.name}</p>
                        {u.id===currentUser.id && <span style={{ fontSize:11, color:"#3B82F6", fontWeight:600 }}>← Sesión actual</span>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:"14px 16px", fontSize:13, color:"#475569" }}>{u.email}</td>
                  <td style={{ padding:"14px 16px" }}><Badge label={ROLES[u.role]?.label||u.role} color={ROLES[u.role]?.color||"#888"}/></td>
                  <td style={{ padding:"14px 16px" }}>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                      {(ROLES[u.role]?.perms||[]).map((p:string)=><Badge key={p} label={p} color="#475569"/>)}
                    </div>
                  </td>
                  <td style={{ padding:"14px 16px" }}>
                    <div style={{ display:"flex", gap:6 }}>
                      <button style={{ ...btn("ghost"), padding:"5px 9px" }} onClick={()=>openEdit(u)}><Icon name="edit" size={14}/></button>
                      {u.id!==currentUser.id && <button style={{ ...btn("danger"), padding:"5px 9px" }} onClick={()=>deleteUser(u.id)}><Icon name="trash" size={14}/></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ background:"#F1F5F9", borderRadius:16, border:"1px solid #e8e0d8", padding:20 }}>
        <h3 style={{ margin:"0 0 14px", fontSize:14, fontWeight:700, color:"#1E293B" }}>Política de seguridad</h3>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:12 }}>
          {[["🔐","Contraseñas mínimo 8 caracteres"],["📋","Registro de auditoría por usuario"],["⏱","Sesión con token JWT expirable"],["🔒","Acceso restringido por rol"],["📊","Registro de auditoría por acceso"],["🛡","Comunicación cifrada HTTPS"]].map(([icon,text])=>(
            <div key={text as string} style={{ display:"flex", gap:10, alignItems:"flex-start", fontSize:13, color:"#475569" }}>
              <span style={{ fontSize:16 }}>{icon}</span>{text as string}
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <Modal title={editUser?"Editar Usuario":"Nuevo Usuario"} onClose={()=>setModal(false)} width={440}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <Field label="Nombre completo" required><input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></Field>
            <Field label="Correo electrónico" required><input style={inp} type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} disabled={!!editUser}/></Field>
            <Field label={editUser?"Nueva contraseña (dejar vacío para no cambiar)":"Contraseña"} required={!editUser}>
              <input style={inp} type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder={editUser?"••••••••":""} autoComplete="new-password"/>
            </Field>
            <Field label="Rol del sistema" required>
              <select style={sel} value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                {Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <div style={{ background:"#F1F5F9", borderRadius:12, padding:12, fontSize:12, color:"#475569" }}>
              <strong>Permisos del rol {ROLES[form.role]?.label}:</strong> {ROLES[form.role]?.perms.join(", ")}
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button style={btn("secondary")} onClick={()=>setModal(false)}>Cancelar</button>
              <button style={{ ...btn("primary"), opacity:saving?0.6:1 }} onClick={saveUser} disabled={saving}>{saving?"Guardando...":editUser?"Actualizar":"Crear Usuario"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── APP SHELL ────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]             = useState<any>(null);
  const [checkingAuth, setChecking] = useState(true);

  // Safety net: si checkingAuth no se resuelve en 3s, forzar false
  useEffect(()=>{
    const t = setTimeout(()=>setChecking(false), 3000);
    return ()=>clearTimeout(t);
  },[]);
  const [activeModule, setActiveModule] = useState("dashboard");
  const [toast, setToast]           = useState<any>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [syncing, setSyncing]       = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const online = useOnlineStatus();

  // Detectar retorno desde QvaPay y mostrar resultado
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const planResult = params.get("plan");
    if (planResult) {
      window.history.replaceState({}, "", window.location.pathname);
      if (planResult === "activated") {
        showToast("¡Plan activado correctamente! Bienvenido.", "success");
        setPlanOpen(true);
      } else if (planResult === "payment_failed") {
        showToast("Autorización guardada pero el pago falló. Verifica tu saldo en QvaPay.", "error");
        setPlanOpen(true);
      } else if (planResult === "cancelled") {
        showToast("Autorización cancelada.", "warning");
      }
    }
  }, []);
  const syncRef = useRef(false);
  // Restaurar sesión al recargar
  useEffect(()=>{
    const token = getToken();
    if (!token) { setChecking(false); return; }

    const restoreFromCache = () => {
      const cached = localStorage.getItem("cubagest_user");
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch {
          saveToken(null);
          localStorage.removeItem("cubagest_user");
        }
      } else {
        saveToken(null);
      }
      setChecking(false);
    };

    // Si no hay conexión, usar caché directamente sin intentar el servidor
    if (!navigator.onLine) {
      restoreFromCache();
      return;
    }

    // Con conexión: verificar token con el servidor
    apiFetch("/auth/me")
      .then(u=>{
        localStorage.setItem("cubagest_user", JSON.stringify(u));
        setUser(u);
        setChecking(false);
      })
      .catch(()=>{
        // Falló (timeout, error red, etc.) — usar caché
        restoreFromCache();
      });
  },[]);

  // Escuchar sync requests del Service Worker
  useEffect(()=>{\
    const handler = () => {
      if (online && user) syncRef.current = false; // permitir re-sync
    };
    window.addEventListener('sw-sync-requested', handler);
    return () => window.removeEventListener('sw-sync-requested', handler);
  },[online, user]);

  // Renovar token automáticamente al recuperar conexión
  useEffect(()=>{
    if (!online || !user) return;
    apiFetch("/auth/refresh", { method: "POST" })
      .then((data: any) => {
        if (data?.token) {
          setToken(data.token);
          localStorage.setItem("cubagest_user", JSON.stringify(data.user));
          setUser(data.user);
        }
      })
      .catch(()=>{}); // si falla (401) apiFetch ya limpia la sesión
  },[online]);

  // Registrar background sync cuando hay ventas pendientes
  useEffect(()=>{
    if (pendingCount > 0 && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        if ('sync' in reg) {
          (reg as any).sync.register('sync-sales').catch(() => {});
        }
      });
    }
  },[pendingCount]);

  // Actualizar contador de pendientes
  const refreshPending = useCallback(async () => {
    const sales = await getAllOfflineSales();
    setPendingCount(sales.filter(s=>s.status==='pending').length);
    setConflictCount(sales.filter(s=>s.status==='conflict').length);
  }, []);

  useEffect(() => { refreshPending(); }, []);

  // Sincronizar cuando vuelve la conexión
  useEffect(() => {
    if (!online || !user || syncRef.current) return;
    const syncPending = async () => {
      const pending = await getPendingSales();
      if (pending.length === 0) return;
      syncRef.current = true;
      setSyncing(true);
      let synced = 0; let conflicts = 0;

      try {
        for (const sale of pending) await updateSaleStatus(sale.localId, 'syncing');

        const { results } = await apiFetch("/sales/sync", {
          method: "POST",
          body: {
            sales: pending.map(s => ({
              localId: s.localId,
              client: s.client,
              clientNit: s.clientNit,
              clientPhone: s.clientPhone,
              items: s.items.map(i=>({ productId:i.productId, name:i.name, qty:i.qty, price:i.price })),
              payMethod: s.payMethod,
              currency: "CUP",
              offlineTimestamp: s.timestamp,
            }))
          }
        });

        for (const result of results) {
          if (result.status === 'synced') {
            await updateSaleStatus(result.localId, 'synced', result.serverId);
            synced++;
          } else {
            await updateSaleStatus(result.localId, 'conflict', undefined, result.reason);
            const sale = pending.find(s=>s.localId===result.localId);
            if (sale) await restoreLocalStock(sale.items);
            conflicts++;
          }
        }
      } catch(e:any) {
        for (const sale of pending) await updateSaleStatus(sale.localId, 'pending');
        showToast("Error al sincronizar — se reintentará al reconectar","error");
      }

      await saveSyncLog({ timestamp: Date.now(), salesSynced: synced, salesConflict: conflicts });
      await refreshPending();
      setSyncing(false);
      syncRef.current = false;
      if (synced > 0) showToast(`${synced} venta(s) sincronizada(s)`,"success");
      if (conflicts > 0) showToast(`${conflicts} conflicto(s) de stock — revisa Facturas`,"warning");

      try { const updated = await apiFetch("/products"); await cacheProducts(updated); } catch {}
    };
    syncPending();
  }, [online, user]);

  const showToast = (msg: string, type = "info") => setToast({ msg, type, key: Date.now() });

  const handleLogout = () => { saveToken(null); localStorage.removeItem("cubagest_user"); localStorage.removeItem("cubagest_dashboard"); setUser(null); setActiveModule("dashboard"); };

  if (checkingAuth) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#F8FAFC" }}>
      <Spinner/>
    </div>
  );

  if (!user) return <LoginScreen onLogin={u=>{ setUser(u); setActiveModule("dashboard"); }}/>;

  const perms = ROLES[user.role]?.perms || [];
  const navItems = [
    { id:"dashboard",    label:"Dashboard",      icon:"dashboard" },
    { id:"inventario",   label:"Inventario",     icon:"inventario" },
    { id:"pos",          label:"Punto de Venta", icon:"pos" },
    { id:"facturacion",  label:"Facturas",        icon:"facturacion" },
    { id:"contabilidad", label:"Contabilidad",   icon:"contabilidad" },
    { id:"cierre",       label:"Cierre de Caja", icon:"cierre" },
  ].filter(n=>perms.includes(n.id));


  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"#F8FAFC", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* Top header */}
      <div style={{ background:"#1E293B", padding:"0 16px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, zIndex:10, boxShadow:"0 1px 8px rgba(0,0,0,0.12)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, background:"linear-gradient(135deg,#3B82F6,#60A5FA)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none"><path d="M8 24L16 8L24 24" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M10.5 19h11" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <div style={{ color:"#ffffff", fontWeight:800, fontSize:15 }}>CubaGest</div>
        </div>
        {/* Profile button */}
        <div style={{ position:"relative" as any }}>
          <button onClick={()=>setProfileOpen(v=>!v)} style={{ width:36, height:36, borderRadius:"50%", background:ROLES[user.role]?.color||"#888", color:"#ffffff", border:"none", cursor:"pointer", fontSize:14, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>
            {user.name?.charAt(0)}
          </button>
          {profileOpen && (
            <div style={{ position:"fixed" as any, inset:0, zIndex:400 }} onClick={()=>setProfileOpen(false)}>
              <div style={{ position:"absolute" as any, right:12, top:56, background:"#ffffff", borderRadius:12, boxShadow:"0 8px 32px rgba(0,0,0,0.25)", border:"1px solid #e8e0d8", minWidth:220, zIndex:401 }} onClick={e=>e.stopPropagation()}>
                <div style={{ padding:"14px 16px", borderBottom:"1px solid #f0ebe4" }}>
                  <div style={{ fontWeight:700, fontSize:14, color:"#1E293B" }}>{user.name}</div>
                  <div style={{ fontSize:12, color:"#64748B" }}>{user.email}</div>
                  <div style={{ marginTop:4 }}><Badge label={ROLES[user.role]?.label||user.role} color={ROLES[user.role]?.color||"#888"}/></div>
                </div>
                <div style={{ padding:8 }}>
                  <button onClick={()=>{setPlanOpen(true);setProfileOpen(false);}} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", borderRadius:12, border:"none", cursor:"pointer", background:"none", color:"#475569", fontSize:14, fontWeight:600 }}>
                    <Icon name="facturacion" size={16} color="#475569"/>Mi Plan
                  </button>
                  {["admin"].includes(user.role) && (
                    <button onClick={()=>{setActiveModule("usuarios");setProfileOpen(false);}} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", borderRadius:12, border:"none", cursor:"pointer", background:"none", color:"#475569", fontSize:14, fontWeight:600 }}>
                      <Icon name="usuarios" size={16} color="#475569"/>Usuarios
                    </button>
                  )}
                  <div style={{ height:1, background:"#E2E8F0", margin:"4px 0" }}/>
                  <button onClick={()=>{handleLogout();setProfileOpen(false);}} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", borderRadius:12, border:"none", cursor:"pointer", background:"none", color:"#3B82F6", fontSize:14, fontWeight:600 }}>
                    <Icon name="logout" size={16} color="#3B82F6"/>Cerrar sesión
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Banner trial */}
      {user?.company?.trialActive && (() => {
        const daysLeft = user.company.planExpiry
          ? Math.max(0, Math.ceil((new Date(user.company.planExpiry).getTime() - Date.now()) / 86400000))
          : null;
        if (daysLeft === null) return null;
        const urgent = daysLeft <= 7;
        return (
          <div style={{ background: urgent ? "#C2410C" : "#1D4ED8", color:"#fff", padding:"7px 16px", fontSize:12, fontWeight:600, textAlign:"center" as const, flexShrink:0, cursor:"pointer" }}
            onClick={() => setPlanOpen(true)}>
            {urgent ? "⚠ " : "🎁 "}
            Período de prueba gratis — {daysLeft} día{daysLeft !== 1 ? "s" : ""} restante{daysLeft !== 1 ? "s" : ""}
            {urgent ? " · Toca aquí para ver planes" : " · Plan Empresarial completo"}
          </div>
        );
      })()}

      {/* Offline banner */}
      <OfflineBanner online={online} syncing={syncing} pending={pendingCount} conflicts={conflictCount}/>

      {/* Content */}
      <div style={{ flex:1, overflow:"auto", padding:16, paddingBottom:80 }}>
        {activeModule==="dashboard"    && <Dashboard user={user}/>}
        {activeModule==="inventario"   && <Inventario user={user} showToast={showToast}/>}
        {activeModule==="pos"          && <POS user={user} showToast={showToast}/>}
        {activeModule==="facturacion"  && <Facturacion user={user} showToast={showToast} onSyncRefresh={refreshPending}/>}
        {activeModule==="contabilidad" && <Contabilidad showToast={showToast}/>}
        {activeModule==="cierre"       && <CierreCaja user={user} showToast={showToast}/>}
        {activeModule==="usuarios"     && <Usuarios currentUser={user} showToast={showToast}/>}
      </div>

      {/* Bottom navigation */}
      <div style={{ position:"fixed" as any, bottom:0, left:0, right:0, background:"#ffffff", borderTop:"1px solid #e8e0d8", display:"flex", zIndex:100, paddingBottom:"env(safe-area-inset-bottom)" }}>
        {navItems.map(item=>(
          <button key={item.id} onClick={()=>{ setActiveModule(item.id); setProfileOpen(false); }} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"10px 4px 8px", border:"none", cursor:"pointer", background:"none", color:activeModule===item.id?"#3B82F6":"#94A3B8", gap:4, minWidth:0 }}>
            <Icon name={item.icon} size={22} color={activeModule===item.id?"#3B82F6":"#64748B"}/>
            <span style={{ fontSize:10, fontWeight:activeModule===item.id?700:400, whiteSpace:"nowrap" as any, overflow:"hidden", textOverflow:"ellipsis", maxWidth:"100%" }}>{item.label}</span>
            {activeModule===item.id && <div style={{ width:4, height:4, borderRadius:"50%", background:"#3B82F6", marginTop:2 }}/>}
          </button>
        ))}
      </div>

      {planOpen && <PlanModal onClose={()=>setPlanOpen(false)} user={user}/>}
      {toast && <Toast key={toast.key} msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
    </div>
  );
}
