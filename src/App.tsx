//v3 — App Shell modular (pantallas en src/screens, UI en src/components)
import { useState, useEffect, useRef, useCallback } from "react";
import {
  cacheProducts, getPendingSales, getAllOfflineSales, updateSaleStatus,
  getPendingClosings, updateClosingStatus,
  saveSyncLog, restoreLocalStock, resetStuckSyncingSales, setSaleLocationOnce,
  getLastLocationId, type OfflineAccount, type OfflineSale,
} from "@/offlineDB";
import { PRIVACY_POLICY_MD, TERMS_MD } from "@/legalContent";
import { apiFetch, getToken, saveToken, logout, ApiError } from "@/lib/api";
import { warmCache } from "@/warmCache";
import { useOnlineStatus, usePendingClosingsCount } from "@/hooks/useOnline";
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
import Configuracion, { GRUPOS, puede } from "@/screens/Configuracion";
import NotificationsBell from "@/components/shared/NotificationsBell";
import DiscountsAdmin from "@/screens/DiscountsAdmin";
import CurrenciesSettings from "@/screens/CurrenciesSettings";

// ─── APP SHELL ────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]             = useState<any>(null);
  const [checkingAuth, setChecking] = useState(true);
  // Landing pública: visible por defecto; ?app=1 la salta (p.ej. usuarios que
  // ya saben que quieren ir directo al login). Una vez dentro, no vuelve a
  // mostrarse hasta recargar.
  // La landing no se muestra si la URL ya es un deep-link de la app (/app/*)
  const [showLanding, setShowLanding] = useState(() =>
    !new URLSearchParams(window.location.search).get("app") && !window.location.pathname.startsWith("/app/"));
  const enterApp = () => {
    setShowLanding(false);
    try {
      // Si entramos por /app/<modulo>, respeta esa URL; si no, ?app=1 normal
      const isDeepLink = window.location.pathname.startsWith("/app/");
      window.history.replaceState({}, "", window.location.pathname + (isDeepLink ? "" : "?app=1"));
    } catch {}
  };

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
  const [activeModule, setActiveModule] = useState(() => {
    // Deep-link: /app/pos abre directamente el módulo POS (si el rol lo
    // permite; si no, cae al dashboard por defecto).
    const seg = window.location.pathname.split("/")[2];
    return seg || "dashboard";
  });
  // Cada screen tiene su URL (/app/dashboard, /app/pos, ...): el botón
  // "atrás" del navegador cambia de módulo en vez de salir de la app.
  useEffect(() => {
    const onPop = () => {
      const seg = window.location.pathname.split("/")[2];
      setActiveModule(seg || "dashboard");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openModule = (id: string) => {
    setActiveModule(id);
    try {
      const url = `/app/${id}${window.location.search}`;
      window.history.pushState({}, "", url);
    } catch {}
  };
  const [toast, setToast]           = useState<any>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  // Qué grupo de Configuración está abierto. Ahora es el grupo y no una pestaña:
  // la barra de abajo cambia sus botones por estos cuando entras, así que quien
  // tiene que saber cuál está activo es la barra, no la pantalla.
  const [configGrupo, setConfigGrupo] = useState<string>("caja");
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
  // Si el token se invalida en cualquier momento (401 de apiFetch tras no
  // poder renovar la sesión), volvemos a la pantalla de login SIN recargar la
  // página — así no se interrumpe ninguna sincronización de ventas offline que
  // pudiera estar en curso.
  useEffect(() => {
    const handler = () => { setUser(null); setActiveModule("dashboard"); };
    window.addEventListener("cubagest-session-expired", handler);
    return () => window.removeEventListener("cubagest-session-expired", handler);
  }, []);

  // Espacio de nombres local de esta cuenta. Todo lo que se guarda offline
  // (catálogo, stock, cola) vive bajo companyId+userId (+locationId), así que
  // un dispositivo usado por dos cuentas nunca mezcla ni reenvía datos ajenos.
  const account: OfflineAccount | null = user
    ? { companyId: user.company?.id || user.companyId || "", userId: user.id || "" }
    : null;
  const hasAccount = !!(account?.companyId && account?.userId);
  const pendingClosings = usePendingClosingsCount(account);

  // Al abrir la app, recuperamos cualquier venta offline que haya quedado
  // "colgada" en estado 'syncing' por un cierre/recarga anterior en medio
  // de una sincronización, para que vuelva a intentarse.
  useEffect(() => {
    if (!hasAccount) return;
    resetStuckSyncingSales(account!).then(recovered => {
      if (recovered > 0) refreshPending();
    });
  }, [hasAccount, account?.userId, account?.companyId]);

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

    // Con conexión: verificar token con el servidor (apiFetch ya intenta
    // renovar el access token una vez si recibe un 401).
    apiFetch("/auth/me")
      .then(res=>{
        // El backend devuelve { ok:true, user:{...} }, no el usuario "plano"
        const u = res?.user;
        if (!u) throw new Error("Respuesta de /auth/me sin usuario");
        localStorage.setItem("cubagest_user", JSON.stringify(u));
        setUser(u);
        setChecking(false);
      })
      .catch((e:any)=>{
        // Sesión realmente terminada (el token no se pudo renovar): fuera.
        if (e instanceof ApiError && e.kind === "auth") {
          saveToken(null);
          localStorage.removeItem("cubagest_user");
          setChecking(false);
          return;
        }
        // Falló por red (timeout, sin internet, servidor caído) — usar caché y
        // seguir trabajando: la falta de conexión NO cierra la sesión.
        restoreFromCache();
      });
  },[]);

  // Actualizar contador de pendientes
  const refreshPending = useCallback(async () => {
    if (!hasAccount) { setPendingCount(0); setConflictCount(0); return; }
    const sales = await getAllOfflineSales(account!);
    setPendingCount(sales.filter(s=>s.status==='pending').length);
    setConflictCount(sales.filter(s=>s.status==='conflict').length);
  }, [hasAccount, account?.userId, account?.companyId]);

  useEffect(() => { refreshPending(); }, [refreshPending]);

  // ── Sincronización de ventas offline ──────────────────────────────────────
  // Se dispara al volver la conexión, al entrar/arrancar con la app y con el
  // botón manual "Sincronizar ahora" de Facturas. Solo manda las ventas
  // PENDIENTES: no relee el catálogo entero ni hace lecturas de relleno.
  // manual=true muestra mensajes también cuando no hay nada que sincronizar o
  // ya hay una sincronización en curso, para dar feedback claro al usuario.
  /**
   * Envía los cierres que se contaron sin conexión.
   *
   * El reintento es seguro: si el cierre ya se había registrado y solo se perdió
   * la respuesta, el servidor responde 409 (lectura ya cerrada) y se marca como
   * enviado igual, porque el cierre SÍ está. Nunca duplica un cierre.
   */
  const syncClosingsOffline = async (acc: { companyId: string; userId: string }): Promise<number> => {
    const pendientes = await getPendingClosings(acc);
    if (pendientes.length === 0) return 0;
    let enviados = 0;
    for (const c of pendientes) {
      try {
        await updateClosingStatus(c.key, 'syncing');
        await apiFetch("/closing/confirm", {
          method: "POST",
          // countedCash y countedAt viajan del móvil: sin ellos, un cierre
          // hecho sin conexión llegaría sin el dinero contado y sin la hora
          // real del conteo, y el descuadre se mediría contra el momento en
          // que volvió la conexión en vez de cuando se contó.
          body: {
            initialReadingId: c.initialReadingId,
            items: c.items,
            notes: c.notes ?? undefined,
            countedCash: c.countedCash ?? {},
            countedAt: new Date(c.timestamp).toISOString(),
          },
        });
        await updateClosingStatus(c.key, 'synced');
        enviados++;
      } catch (e: any) {
        // 409 = la lectura ya estaba cerrada: el trabajo está hecho, solo se
        // perdió la respuesta la primera vez. No se reintenta para siempre.
        const yaHecho = e?.status === 409;
        await updateClosingStatus(c.key, yaHecho ? 'synced' : 'pending', yaHecho ? undefined : (e?.message || "sin respuesta"));
        if (yaHecho) enviados++;
      }
    }
    return enviados;
  };

  const runSync = async (manual = false) => {
    if (!hasAccount) return;
    if (syncRef.current) {
      if (manual) showToast("Ya hay una sincronización en curso","info");
      return;
    }
    const acc = account!;
    const habia = (await getPendingSales(acc)).length > 0;

    // Orden importante: ventas primero, cierres después. Un cierre se calcula
    // con las ventas que el servidor tenga en ese momento, así que si el cierre
    // se mandara antes, creería que no se vendió nada durante el turno y
    // marcaría como faltante todo lo que el cajero vendió sin conexión.
    await empujarVentas(manual);

    if (!habia && manual) showToast("No hay ventas pendientes por sincronizar","info");
    const cerrados = await syncClosingsOffline(acc);
    if (cerrados > 0) showToast(`${cerrados} cierre(s) sin conexión enviado(s) al servidor`,"success");
  };

  /**
   * Sube las ventas pendientes. NO toca los cierres.
   *
   * Va separado de `runSync` porque la pantalla de cierre necesita subirlas
   * ANTES de confirmar, y no después. Antes, `confirmClosing` llamaba directo a
   * `/closing/confirm` saltándose este paso: si quedaban ventas sin subir en el
   * dispositivo, el servidor conciliaba contra un período sin ellas y el cierre
   * salía con un faltante fantasma de lo que sí se había vendido.
   */
  const empujarVentas = async (manual = false) => {
    if (!hasAccount || syncRef.current) return;
    const acc = account!;
    const pending = await getPendingSales(acc);
    if (pending.length === 0) return;

    syncRef.current = true;
    setSyncing(true);
    let synced = 0; let conflicts = 0; let retryable = 0;
    const touchedLocations = new Set<string>();

    try {
      for (const sale of pending) await updateSaleStatus(acc, sale.localId, 'syncing');

      // Última ubicación conocida de esta cuenta. Solo se usa para rellenar
      // ventas que se capturaron sin ubicación (no se cambia ninguna que ya
      // tenga una: la locationId de una venta es inmutable).
      const lastLocationId = (await getLastLocationId(acc)) || "";
      for (const sale of pending) {
        if (!sale.locationId && lastLocationId) await setSaleLocationOnce(acc, sale.localId, lastLocationId);
      }

      const results: any[] = await apiFetch("/sales/sync", {
        method: "POST",
        body: {
          sales: pending.map((s: OfflineSale) => ({
            // Idempotencia: el mismo clientSaleId (UUID) en cada reintento.
            clientSaleId: s.clientSaleId,
            localId: s.localId,
            locationId: s.locationId || lastLocationId || undefined,
            client: s.client || s.clientName || "Consumidor Final",
            clientName: s.clientName || s.client || "Consumidor Final",
            clientNit: s.clientNit,
            clientPhone: s.clientPhone,
            items: s.items.map(i=>({ productId:i.productId, name:i.name, qty:i.qty, price:i.price, ...(i.discountId ? { discountId:i.discountId } : {}) })),
            payMethod: s.payMethod,
            currency: s.currency || "CUP",
            ...(s.discountId ? { discountId: s.discountId } : {}),
            subtotal: s.subtotal,
            total: s.total,
            // Momento local de la venta (auditoría). El servidor usa su propia
            // hora de recepción para límites de plan y cierres.
            offlineTimestamp: s.timestamp,
          }))
        },
        // Un lote grande por una conexión inestable necesita más margen que
        // una consulta normal.
        timeoutMs: 25000,
      });

      // Una respuesta por venta. Si el servidor repite la misma venta (mismo
      // clientSaleId), gana la primera, así una respuesta duplicada no cuenta
      // dos veces ni devuelve stock dos veces. El stock local solo se restaura
      // ante un conflicto explícito.
      const byKey = new Map<string, any>();
      for (const r of (Array.isArray(results) ? results : [])) {
        const key = r?.clientSaleId || r?.localId;
        if (key && !byKey.has(key)) byKey.set(key, r);
      }

      for (const sale of pending) {
        const result = byKey.get(sale.clientSaleId) || byKey.get(sale.localId);
        if (!result) {
          // Respuesta ausente o incompleta: la venta NO se da por buena ni por
          // mala. Sigue pendiente y su stock sigue descontado (reintentable).
          await updateSaleStatus(acc, sale.localId, 'pending');
          retryable++;
          continue;
        }
        if (result.status === 'synced') {
          await updateSaleStatus(acc, sale.localId, 'synced', result.serverId);
          synced++;
          if (sale.locationId) touchedLocations.add(sale.locationId);
        } else if (result.status === 'conflict') {
          // Conflicto explícito del servidor (stock, producto, permiso…): ahí
          // sí se devuelve el stock local.
          await updateSaleStatus(acc, sale.localId, 'conflict', undefined, result.reason || "Conflicto reportado por el servidor");
          await restoreLocalStock({ ...acc, locationId: sale.locationId }, sale.items);
          conflicts++;
        } else {
          await updateSaleStatus(acc, sale.localId, 'pending');
          retryable++;
        }
      }

      await saveSyncLog(acc, { timestamp: Date.now(), salesSynced: synced, salesConflict: conflicts });
    } catch(e:any) {
      // Cualquier fallo (red, timeout, sesión expirada, etc.) revierte TODAS
      // las ventas de este intento a 'pending' — nunca quedan "colgadas" en
      // 'syncing', así que siempre se vuelven a reintentar más adelante.
      for (const sale of pending) await updateSaleStatus(acc, sale.localId, 'pending');
      showToast("No se pudo sincronizar — se reintentará automáticamente","error");
    } finally {
      await refreshPending();
      setSyncing(false);
      syncRef.current = false;
    }

    if (synced > 0) showToast(`${synced} venta(s) sincronizada(s)`,"success");
    if (conflicts > 0) showToast(`${conflicts} conflicto(s) de stock — revisa Facturas`,"warning");
    if (retryable > 0 && manual) showToast(`${retryable} venta(s) sin respuesta del servidor — se reintentarán`,"warning");

    // Tras sincronizar, el stock del servidor de esas ubicaciones ya no es el
    // que tenemos cacheado. Se refresca SOLO la ubicación afectada (lo que el
    // POS necesita para volver a vender), nunca el catálogo completo de la
    // empresa, que en una conexión intermitente es lo más caro que hay.
    for (const locationId of touchedLocations) {
      try {
        const { items } = await apiFetch(`/locations/${locationId}/stock`);
        await cacheProducts({ ...acc, locationId }, items);
      } catch { /* sin red otra vez: se reintenta en la próxima venta */ }
    }

  };

  // Cada cuánto refresca la app por su cuenta, con la pestaña abierta y con red.
  // No corre en segundo plano: una pestaña en background no debería despertar la
  // radio cada 5 minutos, y el navegador ya congela los temporizadores de las
  // pestañas que no están visibles.
  const SYNC_CYCLE_MS = 5 * 60 * 1000;
  // Mínimo entre sincronizaciones automáticas, para que un tick del intervalo no
  // se pile encima de la sincronización que dispara la reconexión de red.
  const AUTO_SYNC_COOLDOWN_MS = 45 * 1000;
  const ultimoSync = useRef(0);

  // Calienta TODAS las cachés de una vez. Sin esto, la copia offline de cada
  // pantalla solo existía si alguien la había abierto antes con red, y el cajero
  // que entraba y perdía la conexión se encontraba media aplicación vacía.
  //
  // En segundo plano y sin await: la app no puede quedarse esperando a ocho
  // peticiones para dejar usable la pantalla. `warmCache` nunca lanza.
  const calentar = useCallback(() => {
    if (!account) return;
    void warmCache({ account });
  }, [account]);

  // Sincronizar al volver la conexión y en cada arranque/entrada de la app.
  useEffect(() => {
    if (!online || !user) return;
    ultimoSync.current = Date.now();
    calentar();
    runSync();
  }, [online, user, calentar]);

  // Al volver al primer plano de la app (el cajero dejó la PWA abierta en
  // segundo plano y vuelve): se intenta sincronizar lo pendiente. No es
  // sondeo: solo dispara al volver el usuario a la pantalla.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine || !user) return;
      if (Date.now() - ultimoSync.current < AUTO_SYNC_COOLDOWN_MS) return;
      ultimoSync.current = Date.now();
      calentar();
      runSync();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [online, user]);

  // ── Ciclo de 5 minutos ────────────────────────────────────────────────────
  // Cuatro condiciones, y todas hacen falta: con sesión, con red, con la pestaña
  // visible, y sin solaparse con otra sincronización. Cada pasada sube primero lo
  // pendiente y baja después lo fresco; al revés, una descarga podría pisar la
  // vista local de una venta que el servidor todavía no ha visto.
  useEffect(() => {
    if (!online || !user) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (syncRef.current) return;
      if (Date.now() - ultimoSync.current < AUTO_SYNC_COOLDOWN_MS) return;
      ultimoSync.current = Date.now();
      void runSync();
    }, SYNC_CYCLE_MS);
    return () => window.clearInterval(id);
  }, [online, user]);

  const showToast = (msg: string, type = "info") => setToast({ msg, type, key: Date.now() });

  // Cierre de sesión: se revoca la sesión en el servidor (best-effort) y se
  // borra SOLO el estado de autenticación. Los datos offline de esta cuenta
  // (catálogo, stock, cola de ventas) se conservan para el próximo inicio de
  // sesión en este mismo dispositivo; al entrar con otra cuenta se usa otro
  // espacio de nombres y nunca se ven entre sí.
  const handleLogout = () => {
    setUser(null);
    setActiveModule("dashboard");
    setPendingCount(0); setConflictCount(0); setSyncing(false);
    logout();
  };

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
    return <LoginScreen onLogin={(u)=>{
      setUser(u); setActiveModule("dashboard");
      // Calienta TODAS las cachés nada más entrar. Sin esto la copia offline
      // de cada pantalla solo existía si alguien la había abierto antes con red.
      // La cuenta se deriva del propio usuario recién logueado, así que no hace
      // falta esperar al re-render.
      void warmCache({ account: { companyId: u?.company?.id || "", userId: u?.id || "" } });
    }} onBackToLanding={()=>setShowLanding(true)}/>;
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

  // Módulo efectivo: el de la URL solo si el rol lo permite (el backend
  // igualmente enforcea, pero así un deep-link ajeno no renderiza la screen).
  // Los grupos visibles, con el mismo filtro por rol que aplica dentro del
  // componente. Se calcula aquí porque quien los PINTA es la barra, no la
  // pantalla: si cada uno filtrara por su cuenta, un grupo cerrado podría salir
  // en la barra y no abrir nada.
  const gruposVisibles = GRUPOS
    .map(g => ({ ...g, sub: g.sub.filter(t => puede(t, user?.role, perms)) }))
    .filter(g => g.sub.length > 0);

  // La MISMA barra, dos contenidos: módulos o grupos de Configuración. Es la misma
  // pieza y el mismo `cg-bottomnav` porque es la misma barra; solo cambia la lista.
  // No hay dos barras superpuestas — hay una que se vacía y se rellena.
  const barraItems = configOpen
    ? gruposVisibles.map(g => ({ id: g.id, label: g.label, icon: g.icon }))
    : navItems;

  const allowedModules = new Set<string>([...navItems.map(n=>n.id), "dashboard"]);
  if (user.role==="admin") allowedModules.add("usuarios");
  if (perms.includes("auditoria")) allowedModules.add("auditoria");
  const view = allowedModules.has(activeModule) ? activeModule : "dashboard";


  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"var(--bg, #F8FAFC)", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* Top header — el paddingTop con safe-area baja el contenido por debajo
          de la barra de estado del iPhone (reloj/batería); en desktop env() = 0 */}
      <div style={{ background:"#0B1220", padding:"0 16px", paddingTop:"env(safe-area-inset-top)", height:"calc(56px + env(safe-area-inset-top))", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, zIndex:10, boxShadow:"0 1px 8px rgba(0,0,0,0.12)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {configOpen ? (
            <button
              onClick={()=>setConfigOpen(false)}
              aria-label="Volver"
              style={{ display:"flex", alignItems:"center", cursor:"pointer", background:"none", border:"none", padding:2, marginLeft:-2, color:"#ffffff" }}
            >
              <Icon name="arrow_left" size={22}/>
            </button>
          ) : (
            <BrandLogo size={32}/>
          )}
          <div style={{ color:"#ffffff", fontWeight:800, fontSize:15 }}>CubaGest</div>
        </div>
        {/* Campanita de avisos + botón de perfil */}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {/* El header es oscuro: el icono va en blanco explícito, porque el
              color por defecto (currentColor) saldría invisible sobre #0B1220. */}
          <div style={{ ["--ink" as any]: "#ffffff" }}>
            <NotificationsBell onNavigate={(path) => { const target = path.split("?")[0].replace(/^\//, ""); if (target) setActiveModule(target as any); }}/>
          </div>
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
                  {/* Antes aquí vivían cuatro entradas sueltas (Mi Plan,
                      Usuarios, Auditoría y Monedas y Tasas) más el acceso por
                      la barra lateral: la misma pantalla en dos sitios y
                      distinto comportamiento. Ahora hay UNA y dentro están
                      todas, como pestañas. */}
                  <button onClick={()=>{setConfigOpen(true);setProfileOpen(false);}} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", borderRadius:12, border:"none", cursor:"pointer", background:"none", color:"var(--ink, #475569)", fontSize:14, fontWeight:600 }}>
                    <Icon name="settings" size={16} color="#475569"/>Configuración
                  </button>
                  <button onClick={()=>{setTourOpen(true);setProfileOpen(false);}} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", borderRadius:12, border:"none", cursor:"pointer", background:"none", color:"var(--ink, #475569)", fontSize:14, fontWeight:600 }}>
                    <Icon name="dashboard" size={16} color="#475569"/>Ver tour de bienvenida
                  </button>
                  <button onClick={()=>setDarkMode(v=>!v)} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", borderRadius:12, border:"none", cursor:"pointer", background:"none", color:"var(--ink, #475569)", fontSize:14, fontWeight:600 }}>
                    <Icon name={darkMode ? "sun" : "moon"} size={16} color="#475569"/>{darkMode?"Modo claro":"Modo oscuro"}
                  </button>
                  <div style={{ height:1, background:"var(--line, #E2E8F0)", margin:"4px 0" }}/>
                  <button onClick={()=>{setLegalDoc("privacy");setProfileOpen(false);}} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", borderRadius:12, border:"none", cursor:"pointer", background:"none", color:"var(--ink, #475569)", fontSize:14, fontWeight:600 }}>
                    <Icon name="doc" size={16} color="#475569"/>Política de Privacidad
                  </button>
                  <button onClick={()=>{setLegalDoc("terms");setProfileOpen(false);}} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", borderRadius:12, border:"none", cursor:"pointer", background:"none", color:"var(--ink, #475569)", fontSize:14, fontWeight:600 }}>
                    <Icon name="doc" size={16} color="#475569"/>Términos y Condiciones
                  </button>
                  <div style={{ height:1, background:"var(--line, #E2E8F0)", margin:"4px 0" }}/>
                  <button onClick={()=>{handleLogout();setProfileOpen(false);}} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", borderRadius:12, border:"none", cursor:"pointer", background:"none", color:"var(--brand)", fontSize:14, fontWeight:600 }}>
                    <Icon name="logout" size={16} color="var(--brand)"/>Cerrar sesión
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
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
            <span style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
              <Icon name={urgent ? "alert" : "gift"} size={14} color="currentColor"/>
              <span>Período de prueba gratis — {daysLeft} día{daysLeft !== 1 ? "s" : ""} restante{daysLeft !== 1 ? "s" : ""}
                {urgent ? " · Toca aquí para ver planes" : " · Plan Empresarial completo"}</span>
            </span>
          </div>
        );
      })()}

      {/* Offline banner */}
      <OfflineBanner online={online} syncing={syncing} pending={pendingCount} conflicts={conflictCount} pendingClosings={pendingClosings}/>

      {/* Reglas de visibilidad de la navegación. ¡Con !important! Los estilos
          inline de <nav> (display:flex) ganan por especificidad sobre esta hoja,
          sin !important la sidebar aparecía también en el teléfono y la
          bottom-nav también en desktop. */}
      <style>{`
        .cg-sidebar { display: none !important; }
        .cg-bottomnav { display: flex !important; }
        /* La barra flotante no toca el borde: ocupa desde 34px del safe-area
           hacia arriba (~55px de alto), así que hacen falta ~90px de aire.
           Con 96 quedaba justa en un iPhone con indicador. */
        .cg-content { padding-bottom: 112px !important; }
        @media (min-width: 1024px) {
          .cg-sidebar { display: flex !important; }
          .cg-bottomnav { display: none !important; }
          .cg-content { padding-left: 232px !important; padding-bottom: 16px !important; }
        }
      `}</style>

      {/* Content */}
      <div className="cg-content" style={{ flex:1, overflow:"auto", padding:16, paddingBottom:80 }}>
        {view==="dashboard"    && <Dashboard user={user}/>}
        {view==="inventario"   && <Inventario user={user} showToast={showToast}/>}
        {view==="pos"          && <POS user={user} showToast={showToast} onPedirCierre={()=>openModule("cierre")}/>}
        {view==="facturacion"  && <Facturacion user={user} showToast={showToast} onSyncRefresh={refreshPending} onManualSync={()=>runSync(true)} syncing={syncing}/>}
        {view==="contabilidad" && <Contabilidad user={user} showToast={showToast}/>}
        {view==="cierre"       && <CierreCaja user={user} showToast={showToast} onBeforeConfirm={empujarVentas}/>}
        {view==="transferencias" && <Transferencias user={user} showToast={showToast}/>}
        {view==="usuarios"     && <Usuarios currentUser={user} showToast={showToast}/>}
        {view==="auditoria"    && <Auditoria showToast={showToast}/>}
        {/* Módulo desconocido en la URL (p.ej. /app/loquesea): fallback suave */}
        {!["dashboard","inventario","pos","facturacion","contabilidad","cierre","transferencias","usuarios","auditoria"].includes(activeModule) && (
          <div style={{ textAlign:"center", padding:60, color:"var(--muted)" }}>
            Módulo no encontrado — usa el menú de navegación.
          </div>
        )}
      </div>

      {/* Sidebar desktop (≥1024px) — top con safe-area por si corre como PWA
          en una tablet con notch; bottom alineado al borde real */}
      <nav className="cg-sidebar" style={{ position:"fixed", top:"calc(56px + env(safe-area-inset-top))", bottom:0, left:0, width:216, background:"var(--card, #ffffff)", borderRight:"1px solid var(--line, #e8e0d8)", display:"flex", flexDirection:"column", padding:10, gap:2, zIndex:90, overflowY:"auto" }}>
        {navItems.map(item=>{
          const on = view===item.id;
          return (
            <button key={item.id} onClick={()=>{ openModule(item.id); setProfileOpen(false); }}
              style={{ display:"flex", alignItems:"center", gap:11, padding:"11px 14px", borderRadius:12, border:"none", cursor:"pointer", textAlign:"left" as any, fontSize:13.5, fontWeight:on?700:500, background:on?"rgba(var(--brand-rgb),0.10)":"transparent", color:on?"var(--brand)":"var(--muted, #64748B)", transition:"background 0.12s" }}>
              <Icon name={item.icon} size={19} color={on?"var(--brand)":"#64748B"}/>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Bottom navigation (móvil) — cristal líquido.

    El fondo, el borde y el difuminado NO van aquí: viven en index.css
    (.cg-bottomnav). Un estilo en línea gana a una clase, y si el background
    siguiera en el JSX el backdrop-filter no tendría nada que difuminar y la barra
    se vería como una placa translúcida normal. Solo queda en línea el
    safe-area, que depende del dispositivo y no se puede expresar en CSS aquí.

    Y aquí va en `bottom`, no en `paddingBottom`: flotando, el margen del
    indicador de inicio tiene que EMPUJAR la pastilla hacia arriba. Como relleno
    dentro, la esquina redondeada se quedaría pegada al borde de la pantalla con
    un hueco transparente debajo, y no parecería flotar. */}
      <div className="cg-bottomnav" style={{ bottom:"max(env(safe-area-inset-bottom), 12px)" }}>
        {barraItems.map(item=>{
          const on = configOpen ? configGrupo===item.id : view===item.id;
          return (
          <button
            key={item.id}
            onClick={()=>{
              setProfileOpen(false);
              if (configOpen) setConfigGrupo(item.id);
              else openModule(item.id);
            }}
            className={on ? "cg-tab cg-tab-active" : "cg-tab"}
            style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"10px 4px 6px", border:"none", cursor:"pointer", background:"none", gap:3, minWidth:0 }}
          >
            <Icon name={item.icon} size={22} color={on ? "var(--brand)" : "currentColor"}/>
            <span style={{ fontSize:10, fontWeight:on?700:500, whiteSpace:"nowrap" as any, overflow:"hidden", textOverflow:"ellipsis", maxWidth:"100%" }}>{item.label}</span>
          </button>
          );
        })}
      </div>


      {planOpen && <PlanModal onClose={()=>setPlanOpen(false)} user={user}/>}

      {/* El modal de Configuración, con pestañas laterales. */}
      {configOpen && (
        <Configuracion
          user={user}
          perms={perms}
          showToast={showToast}
          initialGrupo={configGrupo}
          onClose={()=>setConfigOpen(false)}
        />
      )}
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
