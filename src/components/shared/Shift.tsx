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
  /** Con cuánto dinero arrancó la caja, por moneda. */
  baseCash?: Record<string, number>;
};

export type AssignedCaja = { id: string; name: string };

/** El turno abierto de esta cuenta, o null si no hay ninguno. */
export function useShift(user: any) {
  const [shift, setShift] = useState<ShiftInfo | null>(null);
  const [cajas, setCajas] = useState<AssignedCaja[]>([]);
  const [cargando, setCargando] = useState(true);
  const [offline, setOffline] = useState(false);
  // Un aviso del servidor, del estilo "falta aplicar una migración". Antes
  // esto se perdía en un catch y el móvil creía que simplemente no había
  // turno, y acababa mostrando un POS vacío blaming a los productos.
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!user?.id) return;
    try {
      const r = await apiFetch("/shift/current");
      setShift(r?.shift ?? null);
      setCajas(r?.assignedCajas ?? []);
      setAviso(r?.aviso ?? null);
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

  const abrirTurno = useCallback(async (locationId: string, baseCash?: Record<string, number>) => {
    const r = await apiFetch("/shift/start", { method: "POST", body: { locationId, baseCash } });
    const nuevo: ShiftInfo = r?.shift;
    if (nuevo) { setShift(nuevo); recordar(nuevo, cajas); }
    return nuevo;
  }, [cajas]);

  const cerrarTurno = useCallback(async () => {
    await apiFetch("/shift/end", { method: "POST" });
    setShift(null);
    recordar(null, []);
  }, []);

  return { shift, cajas, cargando, offline, aviso, abrirTurno, cerrarTurno, refresh: cargar, recordar };
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
  // El dinero con el que abre la caja, por moneda. Se pregunta porque es el
  // dato del que depende toda la conciliación: sin él, cualquier faltante es
  // imposible de atribuir.
  const [monedas, setMonedas] = useState<{ cur: string; valor: string }[]>([{ cur: "CUP", valor: "" }]);
  // La caja elegida se confirma con un botón. Antes el turno arrancaba al
  // tocar la caja, y no había forma de volver atrás: un toque en el sitio
  // equivocado ya había abierto turno y creado la lectura de apertura.
  const [elegida, setElegida] = useState<string | null>(null);

  if (!abierta) return null;

  const empezar = async (locationId: string) => {
    try {
      setEligiendo(true);
      const baseCash: Record<string, number> = {};
      for (const m of monedas) {
        const n = Number(m.valor);
        if (Number.isFinite(n) && n > 0) baseCash[m.cur] = n;
      }
      const r = await apiFetch("/shift/start", { method: "POST", body: { locationId, baseCash } });
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
          ) : (
            <>
            {cajas.map((c) => {
              const marcada = elegida === c.id;
              return (
              <button key={c.id} onClick={() => setElegida(c.id)} disabled={eligiendo}
                aria-pressed={marcada}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "13px 15px",
                  textAlign: "left" as const, cursor: "pointer",
                  borderRadius: 12,
                  border: `1px solid ${marcada ? "var(--brand)" : "var(--line)"}`,
                  background: marcada ? "var(--input-bg)" : "transparent",
                  opacity: eligiendo ? 0.6 : 1,
                }}>
                <span style={{
                  width: 20, height: 20, borderRadius: "50%", flex: "0 0 auto",
                  border: `2px solid ${marcada ? "var(--brand)" : "var(--line)"}`,
                  background: marcada ? "var(--brand)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {marcada && <Icon name="check" size={12} color="#fff" />}
                </span>
                <Icon name="pos" size={20} color={marcada ? "var(--brand)" : "#64748B"} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>{c.name}</span>
              </button>
              );
            })}

          <div style={{ marginTop: 6, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>¿Con cuánto dinero abres la caja?</div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, marginBottom: 10 }}>
              Es el fondo con el que sales hoy. Al final del turno se compara con lo
              que haya y con lo que se vendió, para saber si falta algo.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {monedas.map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 8 }}>
                  <input
                    value={m.cur} onChange={e => setMonedas(monedas.map((x, j) => j === i ? { ...x, cur: e.target.value.toUpperCase().slice(0, 8) } : x))}
                    style={{ ...inp, width: 92, textTransform: "uppercase" as any }}
                    aria-label="Moneda"
                  />
                  <input
                    type="number" inputMode="decimal" min={0} step="0.01"
                    value={m.valor} placeholder="0"
                    onChange={e => setMonedas(monedas.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))}
                    style={{ ...inp, flex: 1 }}
                    aria-label="Cantidad"
                  />
                  {monedas.length > 1 && (
                    <button onClick={() => setMonedas(monedas.filter((_, j) => j !== i))}
                      style={{ ...btn("secondary"), padding: "0 12px" }} aria-label="Quitar moneda">−</button>
                  )}
                </div>
              ))}
              <button onClick={() => setMonedas([...monedas, { cur: "", valor: "" }])}
                style={{ ...btn("ghost"), fontSize: 12, alignSelf: "flex-start" }}>
                <Icon name="plus" size={13} />Añadir otra moneda
              </button>
            </div>
          </div>
            </>
          )}

          {offline && (
            <div style={{ fontSize: 12, color: "#C2410C" }}>
              Sin conexión no se puede abrir turno. Ábrelo con internet una vez.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            <button
              onClick={() => elegida && empezar(elegida)}
              disabled={!elegida || eligiendo}
              style={{ ...btn("primary"), opacity: (!elegida || eligiendo) ? 0.55 : 1, cursor: (!elegida || eligiendo) ? "not-allowed" : "pointer" }}
            >
              {eligiendo ? "Abriendo turno…" : "Comenzar turno"}
            </button>
            {onCerrar && (
              <button onClick={onCerrar} style={{ ...btn("ghost"), fontSize: 13 }}>
                Ahora no
              </button>
            )}
          </div>
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
