import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { enablePush, disablePush, pushSupported, permissionState } from "@/lib/push";
import Icon from "@/components/shared/Icon";
import { btn } from "@/components/shared/primitives";
import { showAlert } from "@/components/shared/dialogs";

type Aviso = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const cuando = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hs = Math.floor(mins / 60);
  if (hs < 24) return `hace ${hs} h`;
  const ds = Math.floor(hs / 24);
  return ds === 1 ? "ayer" : `hace ${ds} días`;
};

/**
 * Campanita de avisos.
 *
 * La lista sale de la base de datos, no del push: así los avisos se ven
 * aunque el navegador no haya podido mostrarlos (móvil sin batería, iPhone sin
 * "añadir a pantalla de inicio", la app cerrada a la fuerza). El push es solo
 * el empujón para que la abras.
 */
const NotificationsBell = ({ onNavigate }: { onNavigate?: (path: string) => void }) => {
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<Aviso[]>([]);
  const [sinLeer, setSinLeer] = useState(0);
  const [permiso, setPermiso] = useState<string>("default");
  const [ocupado, setOcupado] = useState(false);
  const cajaRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    try {
      const data = await apiFetch("/push/notifications?limit=20");
      setItems(data?.items ?? []);
      setSinLeer(data?.unread ?? 0);
    } catch {
      // Sin red: se deja lo que había. La lista no es urgente.
    }
  }, []);

  useEffect(() => {
    setPermiso(permissionState());
    cargar();
    // El service worker avisa por postMessage cuando llega un push con la app
    // abierta: se recarga la lista sin que el usuario tenga que recargar.
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "PUSH_RECEIVED") {
        // Solo hay que repintar la lista. El sonido y la vibración los pone el
        // propio sistema con el aviso (el service worker marca requireInteraction
        // en los urgentes): tocar un audio desde aquí exigiría un archivo extra
        // en el repo y devolvería un 404 en cada aviso si no estuviera.
        cargar();
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    // Y un parche cada medio minuto mientras esté abierta, por si llegó un
    // aviso desde otro dispositivo.
    const timer = setInterval(cargar, 30000);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      clearInterval(timer);
    };
  }, [cargar]);

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    if (!abierto) return;
    const onClick = (e: MouseEvent) => {
      if (cajaRef.current && !cajaRef.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [abierto]);

  const activar = async () => {
    setOcupado(true);
    const r = await enablePush();
    setPermiso(permissionState());
    setOcupado(false);
    if (r === "activado" || r === "ya-estaba") {
      showAlert("Avisos activados. Te avisaré cuando haya un envío por aprobar o un faltante en la caja.");
    } else if (r === "cancelado") {
      showAlert("No activaste los avisos. Si cambias de opinión, puedes activarlos desde los ajustes del navegador (el candado de la barra de direcciones).");
    } else if (r === "no-soportado") {
      showAlert("Este navegador no admite avisos. En iPhone hay que añadir CubaGest a la pantalla de inicio.");
    } else {
      showAlert("No se pudieron activar los avisos. Inténtalo de nuevo en un momento.");
    }
  };

  const desactivar = async () => {
    setOcupado(true);
    await disablePush();
    setOcupado(false);
    showAlert("Avisos desactivados en este dispositivo.");
  };

  const abrirAviso = async (a: Aviso) => {
    setAbierto(false);
    if (!a.readAt) {
      apiFetch("/push/notifications/read", { method: "POST", body: { ids: [a.id] } }).catch(() => {});
      setSinLeer((n) => Math.max(0, n - 1));
      setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, readAt: new Date().toISOString() } : x)));
    }
    if (a.link) onNavigate?.(a.link);
  };

  if (!pushSupported()) return null;

  return (
    <div style={{ position:"relative" }} ref={cajaRef}>
      <button
        onClick={() => { setAbierto((v) => !v); if (!abierto) cargar(); }}
        aria-label={`Avisos${sinLeer ? ` (${sinLeer} sin leer)` : ""}`}
        style={{ position:"relative", background:"transparent", border:"none", cursor:"pointer", color:"var(--ink)", padding:6, borderRadius:8, display:"flex", alignItems:"center" }}>
        <Icon name="bell" size={18}/>
        {sinLeer > 0 && (
          <span style={{ position:"absolute", top:2, right:2, minWidth:15, height:15, padding:"0 3px", borderRadius:8, background:"#DC2626", color:"#fff", fontSize:9, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>
            {sinLeer > 9 ? "9+" : sinLeer}
          </span>
        )}
      </button>

      {abierto && (
        <div style={{ position:"absolute", top:"100%", right:0, marginTop:6, width:340, maxWidth:"88vw", background:"var(--card)", border:"1px solid var(--line)", borderRadius:14, boxShadow:"0 12px 32px rgba(0,0,0,0.18)", zIndex:60, overflow:"hidden" }}>
          <div style={{ padding:"10px 12px", borderBottom:"1px solid var(--line)", display:"flex", alignItems:"center", gap:8 }}>
            <strong style={{ fontSize:13, color:"var(--ink)" }}>Avisos</strong>
            {sinLeer > 0 && (
              <button
                onClick={async () => { await apiFetch("/push/notifications/read", { method:"POST", body:{ all:true } }); cargar(); }}
                style={{ marginLeft:"auto", background:"none", border:"none", color:"var(--brand)", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                Marcar leídos
              </button>
            )}
          </div>

          <div style={{ maxHeight:360, overflowY:"auto" }}>
            {items.length === 0 && (
              <div style={{ padding:20, textAlign:"center", color:"var(--muted)", fontSize:12 }}>
                No hay avisos todavía.
              </div>
            )}
            {items.map((a) => (
              <button
                key={a.id}
                onClick={() => abrirAviso(a)}
                style={{ display:"block", width:"100%", textAlign:"left", background: a.readAt ? "transparent" : "var(--input-bg)", border:"none", borderBottom:"1px solid var(--line)", padding:"10px 12px", cursor:"pointer" }}>
                <div style={{ fontSize:12, fontWeight:800, color:"var(--ink)", marginBottom:2 }}>{a.title}</div>
                <div style={{ fontSize:11, color:"var(--muted)", lineHeight:1.4 }}>{a.body}</div>
                <div style={{ fontSize:10, color:"var(--muted)", marginTop:4, opacity:0.8 }}>{cuando(a.createdAt)}</div>
              </button>
            ))}
          </div>

          {/* El permiso es lo que decide si los avisos llegan. Se pregunta
              aquí, no al arrancar: quien acaba de ver funcionar algo (una
              venta guardada) dice que sí; en la primera pantalla, casi nadie. */}
          <div style={{ padding:12, borderTop:"1px solid var(--line)", background:"var(--input-bg)" }}>
            {permiso === "granted" ? (
              <button onClick={desactivar} disabled={ocupado} style={{ ...btn("secondary"), fontSize:11, width:"100%" }}>
                Desactivar avisos en este dispositivo
              </button>
            ) : permiso === "denied" ? (
              <div style={{ fontSize:11, color:"var(--muted)", lineHeight:1.5 }}>
                Los avisos están bloqueados en este navegador. Para activarlos: toca el candado de la barra de direcciones → Permisos de notificaciones → Allow, y recarga.
              </div>
            ) : (
              <div>
                <div style={{ fontSize:11, color:"var(--muted)", marginBottom:8, lineHeight:1.5 }}>
                  Recibe un aviso cuando haya un envío por aprobar o un faltante en el cierre de caja.
                </div>
                <button onClick={activar} disabled={ocupado} style={{ ...btn("primary"), fontSize:11, width:"100%" }}>
                  {ocupado ? "Activando..." : "Activar avisos"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsBell;
