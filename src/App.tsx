//v3 — App Shell modular (pantallas en src/screens, UI en src/components)
import { useState, useEffect, useRef, useCallback } from "react";
import {
  cacheProducts, getPendingSales, getAllOfflineSales, updateSaleStatus,
  saveSyncLog, restoreLocalStock, resetStuckSyncingSales,
} from "@/offlineDB";
import { PRIVACY_POLICY_MD, TERMS_MD } from "@/legalContent";
import { apiFetch, getToken, saveToken } from "@/lib/api";
import { useOnlineStatus } from "@/hooks/useOnline";
import { ROLES } from "@/config/constants";

import Icon from "@/components/shared/Icon";
import { Toast, OfflineBanner, Badge, Spinner } from "@/components/shared/primitives";
import { DialogHost } from "@/components/shared/dialogs";
import { LegalModal } from "@/components/shared/LegalModal";
import { WelcomeTour } from "@/components/shared/WelcomeTour";
import { BrandLogo } from "@/screens/Landing";

import Landing from "@/screens/Landing";
import LoginScreen from "@/screens/LoginScreen";
import SetPasswordScreen from "@/screens/SetPasswordScreen";
import Dashboard from "@/screens/Dashboard";
import Inventario from "@/screens/Inventario";
import POS from "@/screens/POS";
import Facturacion from "@/screens/Facturacion";
import Contabilidad from "@/screens/Contabilidad";
import CierreCaja from "@/screens/CierreCaja";
import Transferencias from "@/screens/Transferencias";
import Usuarios from "@/screens/Usuarios";
import Auditoria from "@/screens/Auditoria";
import PlanModal from "@/screens/PlanModal";
import DiscountsAdmin from "@/screens/DiscountsAdmin";
import CurrenciesSettings from "@/screens/CurrenciesSettings";

// ─── APP SHELL ────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]             = useState<any>(null);
  const [checkingAuth, setChecking] = useState(true);
  // Landing pública: visible por defecto; ?app=1 la salta (p.ej. usuarios que
  // ya saben que quieren ir directo al login). Una vez dentro, no vuelve a
  // mostrarse hasta recargar.
  const [showLanding, setShowLanding] = useState(() => !new URLSearchParams(window.location.search).get("app"));
  const enterApp = () => { setShowLanding(false); try { window.history.replaceState({}, "", window.location.pathname + "?app=1"); } catch {} };

  // Link de "establecer contraseña" (?setpw=token) — es una pantalla
  // pública, independiente de si hay sesión o no. Se revisa una sola vez al
  // cargar la app, antes de cualquier otra lógica.
  const [setPwToken] = useState<string | null>(() => new URLSearchParams(window.location.search).get("setpw"));
  const clearSetPwToken = () => {
    window.history.replaceState({}, "", window.location.pathname);
    window.location.reload();
  };

  // Safety net: si checkingAuth no se resuelve en 3s, forzar false
  useEffect(()=>{
    const t = setTimeout(()=>setChecking(false), 3000);
    return ()=>clearTimeout(t);
  },[]);
  const [activeModule, setActiveModule] = useState("dashboard");
  const [toast, setToast]           = useState<any>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [discountsOpen, setDiscountsOpen] = useState(false);
  const [currenciesOpen, setCurrenciesOpen] = useState(false);
  // Tour de bienvenida: se muestra UNA sola vez (bandera persistente).
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    if (user && !localStorage.getItem("cubagest_tour_done")) setTourOpen(true);
  }, [user]);

  const closeTour = () => {
    localStorage.setItem("cubagest_tour_done", "1");
    setTourOpen(false);
  };
  // Modo oscuro: preferencia persistida, class "dark" en <html>.
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("cubagest_theme") === "dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("cubagest_theme", darkMode ? "dark" : "light");
  }, [darkMode]);
  const [legalDoc, setLegalDoc] = useState<null | "privacy" | "terms">(null);
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
  // Si el token se invalida en cualquier momento (401 de apiFetch), volvemos
  // a la pantalla de login SIN recargar la página — así no se interrumpe
  // ninguna sincronización de ventas offline que pudiera estar en curso.
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener("cubagest-session-expired", handler);
    return () => window.removeEventListener("cubagest-session-expired", handler);
  }, []);

  // Al abrir la app, recuperamos cualquier venta offline que haya quedado
  // "colgada" en estado 'syncing' por un cierre/recarga anterior en medio
  // de una sincronización, para que vuelva a intentarse.
  useEffect(() => {
    resetStuckSyncingSales().then(recovered => {
      if (recovered > 0) refreshPending();
    });
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
      .then(res=>{
        // El backend devuelve { ok:true, user:{...} }, no el usuario "plano"
        const u = res?.user;
        if (!u) throw new Error("Respuesta de /auth/me sin usuario");
        localStorage.setItem("cubagest_user", JSON.stringify(u));
        setUser(u);
        setChecking(false);
      })
      .catch(()=>{
        // Falló (timeout, error red, etc.) — usar caché
        restoreFromCache();
      });
  },[]);

  // Escuchar sync requests del Service Worker (Background Sync API)
  useEffect(()=>{
    const handler = () => { if (online && user) runSync(); };
    window.addEventListener('sw-sync-requested', handler);
    return () => window.removeEventListener('sw-sync-requested', handler);
  },[online, user]);

  // Renovar token automáticamente al recuperar conexión
  useEffect(()=>{
    if (!online || !user) return;
    const storedRefreshToken = localStorage.getItem("cubagest_refresh_token");
    if (!storedRefreshToken) return;
    apiFetch("/auth/refresh", { method: "POST", body: { refreshToken: storedRefreshToken }, auth: false })
      .then((data: any) => {
        // El backend solo devuelve { ok:true, accessToken } — no reenvía
        // el usuario, así que no lo tocamos aquí (ya está cacheado).
        if (data?.accessToken) {
          saveToken(data.accessToken);
        }
      })
      .catch(()=>{}); // si falla (401) apiFetch ya avisa vía cubagest-session-expired
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

  // ── Sincronización de ventas offline ──────────────────────────────────────
  // Función reutilizable: la dispara automáticamente el efecto de abajo al
  // volver la conexión, y también el botón manual "Sincronizar ahora" desde
  // Facturas. manual=true muestra mensajes también cuando no hay nada que
  // sincronizar o ya hay una sincronización en curso, para dar feedback claro
  // al usuario que pulsó el botón.
  const runSync = async (manual = false) => {
    if (syncRef.current) {
      if (manual) showToast("Ya hay una sincronización en curso","info");
      return;
    }
    const pending = await getPendingSales();
    if (pending.length === 0) {
      if (manual) showToast("No hay ventas pendientes por sincronizar","info");
      return;
    }

    syncRef.current = true;
    setSyncing(true);
    let synced = 0; let conflicts = 0;

    try {
      for (const sale of pending) await updateSaleStatus(sale.localId, 'syncing');

      const results = await apiFetch("/sales/sync", {
        method: "POST",
        body: {
          sales: pending.map(s => ({
            localId: s.localId,
            client: s.client || s.clientName || "Consumidor Final",
            clientName: s.clientName || s.client || "Consumidor Final",
            clientNit: s.clientNit,
            clientPhone: s.clientPhone,
            items: s.items.map(i=>({ productId:i.productId, name:i.name, qty:i.qty, price:i.price })),
            payMethod: s.payMethod,
            currency: s.currency || "CUP",
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

      await saveSyncLog({ timestamp: Date.now(), salesSynced: synced, salesConflict: conflicts });
    } catch(e:any) {
      // Cualquier fallo (red, timeout, sesión expirada, etc.) revierte TODAS
      // las ventas de este intento a 'pending' — nunca quedan "colgadas" en
      // 'syncing', así que siempre se vuelven a reintentar más adelante.
      for (const sale of pending) await updateSaleStatus(sale.localId, 'pending');
      showToast("No se pudo sincronizar — se reintentará automáticamente","error");
    } finally {
      await refreshPending();
      setSyncing(false);
      syncRef.current = false;
    }

    if (synced > 0) showToast(`${synced} venta(s) sincronizada(s)`,"success");
    if (conflicts > 0) showToast(`${conflicts} conflicto(s) de stock — revisa Facturas`,"warning");
    if (synced > 0) {
      try { const updated = await apiFetch("/products"); await cacheProducts(updated); } catch {}
    }
  };

  // Sincronizar automáticamente cuando vuelve la conexión
  useEffect(() => {
    if (!online || !user) return;
    runSync();
  }, [online, user]);

  const showToast = (msg: string, type = "info") => setToast({ msg, type, key: Date.now() });

  const handleLogout = () => { saveToken(null); localStorage.removeItem("cubagest_user"); localStorage.removeItem("cubagest_dashboard"); setUser(null); setActiveModule("dashboard"); };

  // Pantalla pública de "establecer contraseña" — no importa si hay sesión
  // activa o no, ni si todavía se está verificando.
  if (setPwToken) return <SetPasswordScreen token={setPwToken} onDone={clearSetPwToken}/>;

  if (checkingAuth) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg, #F8FAFC)" }}>
      <Spinner/>
    </div>
  );

  if (!user) {
    if (showLanding) return <Landing onEnter={enterApp}/>;
    return <LoginScreen onLogin={u=>{ setUser(u); setActiveModule("dashboard"); }} onBackToLanding={()=>setShowLanding(true)}/>;
  }

  const perms = ROLES[user.role]?.perms || [];
  const navItems = [
    { id:"dashboard",    label:"Dashboard",      icon:"dashboard" },
    { id:"inventario",   label:"Inventario",     icon:"inventario" },
    { id:"pos",          label:"Punto de Venta", icon:"pos" },
    { id:"facturacion",  label:"Facturas",        icon:"facturacion" },
    { id:"contabilidad", label:"Contabilidad",   icon:"contabilidad" },
    { id:"cierre",       label:"Cierre de Caja", icon:"cierre" },
    { id:"transferencias", label:"Envíos",       icon:"transferencias" },
  ].filter(n=>perms.includes(n.id));


  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"var(--bg, #F8FAFC)", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* Top header — el paddingTop con safe-area baja el contenido por debajo
          de la barra de estado del iPhone (reloj/batería); en desktop env() = 0 */}
      <div style={{ background:"#1E293B", padding:"0 16px", paddingTop:"env(safe-area-inset-top)", height:"calc(56px + env(safe-area-inset-top))", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, zIndex:10, boxShadow:"0 1px 8px rgba(0,0,0,0.12)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <BrandLogo size={32}/>
          <div style={{ color:"#ffffff", fontWeight:800, fontSize:15 }}>CubaGest</div>
        </div>
        {/* Profile button */}
        <div style={{ position:"relative" as any }}>
          <button onClick={()=>setProfileOpen(v=>!v)} style={{ width:36, height:36, borderRadius:"50%", background:ROLES[user.role]?.color||"#888", color:"#ffffff", border:"none", cursor:"pointer", fontSize:14, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>
            {user.name?.charAt(0)}
          </button>
          {profileOpen && (
            <div style={{ position:"fixed" as any, inset:0, zIndex:400 }} onClick={()=>setProfileOpen(false)}>
              <div style={{ position:"absolute" as any, right:12, top:"calc(56px + env(safe-area-inset-top))", background:"var(--card, #fff)", borderRadius:12, boxShadow:"0 8px 32px rgba(0,0,0,0.25)", border:"1px solid var(--line, #e8e0d8)", minWidth:220, zIndex:401 }} onClick={e=>e.stopPropagation()}>
                <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--line, #f0ebe4)" }}>
                  <div style={{ fontWeight:700, fontSize:14, color:"var(--ink, #1E293B)" }}>{user.name}</div>
                  <div style={{ fontSize:12, color:"var(--muted, #64748B)" }}>{user.email}</div>
                  <div style={{ marginTop:4 }}><Badge label={ROLES[user.role]?.label||user.role} color={ROLES[user.role]?.color||"#888"}/></div>
                </div>
                <div style={{ padding:8 }}>
                  <button onClick={()=>{setPlanOpen(true);setProfileOpen(false);}} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", borderRadius:12, border:"none", cursor:"pointer", background:"none", color:"var(--ink, #475569)", fontSize:14, fontWeight:600 }}>
                    <Icon name="facturacion" size={16} color="#475569"/>Mi Plan
                  </button>
                  {["admin"].includes(user.role) && (
                    <button onClick={()=>{setActiveModule("usuarios");setProfileOpen(false);}} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", borderRadius:12, border:"none", cursor:"pointer", background:"none", color:"var(--ink, #475569)", fontSize:14, fontWeight:600 }}>
                      <Icon name="usuarios" size={16} color="#475569"/>Usuarios
                    </button>
                  )}
                  {perms.includes("auditoria") && (
                    <button onClick={()=>{setActiveModule("auditoria");setProfileOpen(false);}} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", borderRadius:12, border:"none", cursor:"pointer", background:"none", color:"var(--ink, #475569)", fontSize:14, fontWeight:600 }}>
                      <Icon name="auditoria" size={16} color="#475569"/>Auditoría
                    </button>
                  )}
                  {user.role==="admin" && (
                    <button onClick={()=>{setDiscountsOpen(true);setProfileOpen(false);}} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", borderRadius:12, border:"none", cursor:"pointer", background:"none", color:"var(--ink, #475569)", fontSize:14, fontWeight:600 }}>
                      <Icon name="facturacion" size={16} color="#475569"/>Descuentos
                    </button>
                  )}
                  {user.role==="admin" && (
                    <button onClick={()=>{setCurrenciesOpen(true);setProfileOpen(false);}} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", borderRadius:12, border:"none", cursor:"pointer", background:"none", color:"var(--ink, #475569)", fontSize:14, fontWeight:600 }}>
                      <Icon name="contabilidad" size={16} color="#475569"/>Monedas y Tasas
                    </button>
                  )}
                  <button onClick={()=>{setTourOpen(true);setProfileOpen(false);}} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", borderRadius:12, border:"none", cursor:"pointer", background:"none", color:"var(--ink, #475569)", fontSize:14, fontWeight:600 }}>
                    <Icon name="dashboard" size={16} color="#475569"/>Ver tour de bienvenida
                  </button>
                  <button onClick={()=>setDarkMode(v=>!v)} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", borderRadius:12, border:"none", cursor:"pointer", background:"none", color:"var(--ink, #475569)", fontSize:14, fontWeight:600 }}>
                    <span style={{ fontSize:16 }}>{darkMode?"☀️":"🌙"}</span>{darkMode?"Modo claro":"Modo oscuro"}
                  </button>
                  <div style={{ height:1, background:"var(--line, #E2E8F0)", margin:"4px 0" }}/>
                  <button onClick={()=>{setLegalDoc("privacy");setProfileOpen(false);}} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", borderRadius:12, border:"none", cursor:"pointer", background:"none", color:"var(--ink, #475569)", fontSize:14, fontWeight:600 }}>
                    <Icon name="doc" size={16} color="#475569"/>Política de Privacidad
                  </button>
                  <button onClick={()=>{setLegalDoc("terms");setProfileOpen(false);}} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", borderRadius:12, border:"none", cursor:"pointer", background:"none", color:"var(--ink, #475569)", fontSize:14, fontWeight:600 }}>
                    <Icon name="doc" size={16} color="#475569"/>Términos y Condiciones
                  </button>
                  <div style={{ height:1, background:"var(--line, #E2E8F0)", margin:"4px 0" }}/>
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

      {/* Reglas de visibilidad de la navegación. ¡Con !important! Los estilos
          inline de <nav> (display:flex) ganan por especificidad sobre esta hoja,
          sin !important la sidebar aparecía también en el teléfono y la
          bottom-nav también en desktop. */}
      <style>{`
        .cg-sidebar { display: none !important; }
        .cg-bottomnav { display: flex !important; }
        .cg-content { padding-bottom: 96px !important; }
        @media (min-width: 1024px) {
          .cg-sidebar { display: flex !important; }
          .cg-bottomnav { display: none !important; }
          .cg-content { padding-left: 232px !important; padding-bottom: 16px !important; }
        }
      `}</style>

      {/* Content */}
      <div className="cg-content" style={{ flex:1, overflow:"auto", padding:16, paddingBottom:80 }}>
        {activeModule==="dashboard"    && <Dashboard user={user}/>}
        {activeModule==="inventario"   && <Inventario user={user} showToast={showToast}/>}
        {activeModule==="pos"          && <POS user={user} showToast={showToast}/>}
        {activeModule==="facturacion"  && <Facturacion user={user} showToast={showToast} onSyncRefresh={refreshPending} onManualSync={()=>runSync(true)} syncing={syncing}/>}
        {activeModule==="contabilidad" && <Contabilidad user={user} showToast={showToast}/>}
        {activeModule==="cierre"       && <CierreCaja user={user} showToast={showToast}/>}
        {activeModule==="transferencias" && <Transferencias user={user} showToast={showToast}/>}
        {activeModule==="usuarios"     && <Usuarios currentUser={user} showToast={showToast}/>}
        {activeModule==="auditoria"    && <Auditoria showToast={showToast}/>}
      </div>

      {/* Sidebar desktop (≥1024px) — top con safe-area por si corre como PWA
          en una tablet con notch; bottom alineado al borde real */}
      <nav className="cg-sidebar" style={{ position:"fixed", top:"calc(56px + env(safe-area-inset-top))", bottom:0, left:0, width:216, background:"var(--card, #ffffff)", borderRight:"1px solid var(--line, #e8e0d8)", display:"flex", flexDirection:"column", padding:10, gap:2, zIndex:90, overflowY:"auto" }}>
        {navItems.map(item=>{
          const on = activeModule===item.id;
          return (
            <button key={item.id} onClick={()=>{ setActiveModule(item.id); setProfileOpen(false); }}
              style={{ display:"flex", alignItems:"center", gap:11, padding:"11px 14px", borderRadius:12, border:"none", cursor:"pointer", textAlign:"left" as any, fontSize:13.5, fontWeight:on?700:500, background:on?"rgba(59,130,246,0.10)":"transparent", color:on?"#3B82F6":"var(--muted, #64748B)", transition:"background 0.12s" }}>
              <Icon name={item.icon} size={19} color={on?"#3B82F6":"#64748B"}/>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Bottom navigation (móvil) — la altura extra del safe-area ya la aporta
          el padding-bottom del env(), el contenido respira con 96px arriba */}
      <div className="cg-bottomnav" style={{ position:"fixed" as any, bottom:0, left:0, right:0, background:"var(--card, #ffffff)", borderTop:"1px solid var(--line, #e8e0d8)", display:"flex", zIndex:100, paddingBottom:"max(env(safe-area-inset-bottom), 4px)" }}>
        {navItems.map(item=>(
          <button key={item.id} onClick={()=>{ setActiveModule(item.id); setProfileOpen(false); }} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"8px 4px 6px", border:"none", cursor:"pointer", background:"none", color:activeModule===item.id?"#3B82F6":"var(--muted, #94A3B8)", gap:3, minWidth:0 }}>
            <Icon name={item.icon} size={22} color={activeModule===item.id?"#3B82F6":"#64748B"}/>
            <span style={{ fontSize:10, fontWeight:activeModule===item.id?700:400, whiteSpace:"nowrap" as any, overflow:"hidden", textOverflow:"ellipsis", maxWidth:"100%" }}>{item.label}</span>
            {activeModule===item.id && <div style={{ width:4, height:4, borderRadius:"50%", background:"#3B82F6", marginTop:2 }}/>}
          </button>
        ))}
      </div>


      {planOpen && <PlanModal onClose={()=>setPlanOpen(false)} user={user}/>}
      {discountsOpen && <DiscountsAdmin showToast={showToast} onClose={()=>setDiscountsOpen(false)}/>}
      {currenciesOpen && <CurrenciesSettings showToast={showToast} onClose={()=>setCurrenciesOpen(false)}/>}
      {tourOpen && <WelcomeTour onDone={closeTour}/>}
      {legalDoc==="privacy" && <LegalModal title="Política de Privacidad" content={PRIVACY_POLICY_MD} onClose={()=>setLegalDoc(null)}/>}
      {legalDoc==="terms" && <LegalModal title="Términos y Condiciones" content={TERMS_MD} onClose={()=>setLegalDoc(null)}/>}
      {toast && <Toast key={toast.key} msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      <DialogHost/>
    </div>
  );
}
