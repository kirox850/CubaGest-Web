import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import Icon from "@/components/shared/Icon";
import { Spinner, btn, inp } from "@/components/shared/primitives";

// ─── TURNO ───────────────────────────────────────────────────────────────────
//
// Al abrir turno el cajero elige con qué caja trabaja, de entre las que el
// admin le asignó. El POS, el inventario y el cierre salen de ahí: si el turno
// dice caja 2, todas las ventas van a la caja 2.
//
// Antes no había nada que elegir porque la caja era del cajero. Ahora puede
// tener varias, y la caja puede ser la de otro cajero en otro momento.

export type ShiftInfo = {
  id: string;
  locationId: string;
  locationName: string;
  startedAt: string;
  openingReadingId?: string | null;
};

export type AssignedCaja = { id: string; name: string };

/** El turno abierto de esta cuenta, o null si no hay ninguno. */
export function useShift(user: any) {
  const [shift, setShift] = useState<ShiftInfo | null>(null);
  const [cajas, setCajas] = useState<AssignedCaja[]>([]);
  const [cargando, setCargando] = useState(true);
  const [offline, setOffline] = useState(false);

  const cargar = useCallback(async () => {
    if (!user?.id) return;
    try {
      const r = await apiFetch("/shift/current");
      setShift(r?.shift ?? null);
      setCajas(r?.assignedCajas ?? []);
      setOffline(false);
    } catch {
      // Sin conexión: el turno abierto se recuerda en el dispositivo. Sin esto
      // el cajero perdería la caja justo cuando más la necesita.
      try {
        const guardado = localStorage.getItem("cubagest_shift");
        if (guardado) {
          const s = JSON.parse(guardado);
          setShift(s);
          setCajas(s.cajas || []);
        } else {
          setShift(null);
        }
        setOffline(true);
      } catch { setShift(null); }
    } finally { setCargando(false); }
  }, [user?.id]);

  useEffect(() => { cargar(); }, [cargar]);

  const recordar = (s: ShiftInfo | null, c: AssignedCaja[]) => {
    try {
      if (s) localStorage.setItem("cubagest_shift", JSON.stringify({ ...s, cajas: c }));
      else localStorage.removeItem("cubagest_shift");
    } catch { /* almacenamiento lleno: no es motivo para romper nada */ }
  };

  const abrirTurno = useCallback(async (locationId: string) => {
    const r = await apiFetch("/shift/start", { method: "POST", body: { locationId } });
    const nuevo: ShiftInfo = r?.shift;
    if (nuevo) { setShift(nuevo); recordar(nuevo, cajas); }
    return nuevo;
  }, [cajas]);

  const cerrarTurno = useCallback(async () => {
    await apiFetch("/shift/end", { method: "POST" });
    setShift(null);
    recordar(null, []);
  }, []);

  return { shift, cajas, cargando, offline, abrirTurno, cerrarTurno, refresh: cargar, recordar };
}

/**
 * Pantalla para abrir turno. Se muestra en el POS cuando el cajero todavía no
 * tiene turno, y también en Inventario.
 *
 * Sin cajas asignadas no hay nada que elegir: se dice con claridad a quién
 * pedirle, en vez de mostrar una lista vacía sin explicación.
 */
export const AbrirTurno = ({
  user, cajas, onListo, showToast, abierta, onCerrar,
}: {
  user: any;
  cajas: AssignedCaja[];
  onListo: (s: ShiftInfo) => void;
  showToast: (m: string, t: string) => void;
  abierta: boolean;
  onCerrar: () => void;
}) => {
  const [eligiendo, setEligiendo] = useState(false);
  const [offline, setOffline] = useState(false);

  if (!abierta) return null;

  const empezar = async (locationId: string) => {
    try {
      setEligiendo(true);
      const r = await apiFetch("/shift/start", { method: "POST", body: { locationId } });
      onListo(r?.shift);
    } catch (e: any) {
      showToast(e.message || "No se pudo abrir el turno", "error");
    } finally { setEligiendo(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--card)", borderRadius: 18, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(15,23,42,0.3)" }}>
        <div style={{ padding: "20px 22px 14px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>Comenzar turno</h3>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
            Elige la caja en la que vas a trabajar hoy. Todo lo que vendas y cuentes
            irá a esa caja.
          </p>
        </div>

        <div style={{ padding: "0 22px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {cajas.length === 0 ? (
            <div style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.30)", borderRadius: 12, padding: 14, fontSize: 13, color: "#7C2D12" }}>
              <strong style={{ display: "block", marginBottom: 4, color: "#C2410C" }}>No tienes ninguna caja asignada</strong>
              Pídele al administrador de tu negocio que te asigne una caja desde
              Configuración. Te puede asignar varias si rotas entre varios mostradores.
            </div>
          ) : cajas.map((c) => (
            <button key={c.id} onClick={() => empezar(c.id)} disabled={eligiendo}
              style={{ ...btn("secondary"), display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", textAlign: "left" as const, opacity: eligiendo ? 0.6 : 1 }}>
              <Icon name="pos" size={20} color="#64748B" />
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{c.name}</span>
              <Icon name="check" size={16} color="var(--brand)" />
            </button>
          ))}

          {offline && (
            <div style={{ fontSize: 12, color: "#C2410C" }}>
              Sin conexión no se puede abrir turno. Ábrelo con internet una vez.
            </div>
          )}

          {onCerrar && (
            <button onClick={onCerrar} style={{ ...btn("ghost"), marginTop: 4, fontSize: 13 }}>
              Ahora no
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/** Banda de arriba del POS: en qué caja se está y cuánto lleva abierto. */
export const ShiftBadge = ({ shift, onCerrar }: { shift: ShiftInfo; onCerrar: () => void }) => {
  const [confirmando, setConfirmando] = useState(false);
  const desde = new Date(shift.startedAt);
  const horas = Math.floor((Date.now() - desde.getTime()) / 3_600_000);
  const mins = Math.floor(((Date.now() - desde.getTime()) % 3_600_000) / 60_000);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--input-bg)", border: "1px solid var(--line)", borderRadius: 12, marginBottom: 14, flexWrap: "wrap" as any }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", flex: "0 0 auto" }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" as any, overflow: "hidden", textOverflow: "ellipsis" }}>
          {shift.locationName}
        </span>
        <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" as any }}>
          {horas > 0 ? `${horas}h ${mins}m` : `${mins} min`}
        </span>
      </div>
      {!confirmando ? (
        <button onClick={() => setConfirmando(true)} style={{ ...btn("ghost"), fontSize: 12, padding: "5px 10px" }}>Terminar turno</button>
      ) : (
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--ink)" }}>¿Seguro?</span>
          <button onClick={onCerrar} style={{ ...btn("primary"), fontSize: 12, padding: "5px 10px" }}>Sí, terminar</button>
          <button onClick={() => setConfirmando(false)} style={{ ...btn("secondary"), fontSize: 12, padding: "5px 10px" }}>No</button>
        </span>
      )}
    </div>
  );
};
