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
      // Se guarda el turno Y la lista de cajas, y se guardan SIEMPRE. Antes
      // esto no se guardaba al leer: la copia local solo la escribía
      // `abrirTurno`, así que un cajero recién logueado (que es justo cuando no
      // tiene turno abierto) se quedaba sin lista de cajas, y al caerse la red
      // `cargar()` caía al `catch`, no encontraba nada, y el POS acababa
      // diciendo que no tenía caja asignada — de una caja que sí tenía.
      persistirTurno(r?.shift ?? null, r?.assignedCajas ?? []);
    } catch {
      // Sin conexión: el turno abierto se recuerda en el dispositivo. Sin esto
      // el cajero perdería la caja justo cuando más la necesita.
      try {
        const guardado = localStorage.getItem("cubagest_shift");
        if (guardado) {
          // Formato `{ shift, cajas }`. El `shift` va explícito dentro del
          // registro y no esparcido en la raíz: con el formato viejo (los campos
          // del turno sueltos + `cajas`) no se puede distinguir "no hay turno" de
          // "hay un registro con solo las cajas", y esa distinción es la que
          // decide si el POS puede vender.
          const s = JSON.parse(guardado);
          setShift(s?.shift ?? null);
          setCajas(Array.isArray(s?.cajas) ? s.cajas : []);
        } else {
          setShift(null);
          setCajas([]);
        }
        setOffline(true);
      } catch { setShift(null); setCajas([]); }
    } finally { setCargando(false); }
  }, [user?.id]);

  useEffect(() => { cargar(); }, [cargar]);

  /**
   * Guarda el turno y las cajas en el mismo registro.
   *
   * `s === null` es un valor legítimo: significa que el servidor confirmó que no
   * hay turno abierto. Antes de esto, ese caso BORRABA el registro entero, y se
   * llevaba por delante la lista de cajas. Como el único momento en que el
   * servidor manda `assignedCajas` es en `/shift/current`, y ese es
   * precisamente el momento en que se descartaba, la lista nunca se guardaba.
   *
   * La lista de cajas es de la CUENTA, no de la caja en la que se esté: dice
   * dónde puede abrir turno esta persona, no dónde está. Por eso cerrar un turno
   * no la vacía.
   */
  const persistirTurno = (s: ShiftInfo | null, c: AssignedCaja[]) => {
    try {
      localStorage.setItem("cubagest_shift", JSON.stringify({ shift: s ?? null, cajas: c }));
    } catch { /* almacenamiento lleno: no es motivo para romper nada */ }
  };

  /**
   * El turno abierto de esta cuenta, o null si no hay ninguno.
   *
   * Antes borraba el registro cuando no había turno, y con él la lista de cajas
   * asignadas. `cargar()` es la que llama a `persistirTurno` en cada lectura, y
   * `cerrarTurno` conserva la lista en vez de mandarla a cero.
   */
  const recordar = (s: ShiftInfo | null, c: AssignedCaja[]) => persistirTurno(s, c);

  /**
   * Abrir turno ES hacer el conteo de apertura.
   *
   * Antes esta función solo mandaba `locationId` y el servidor copiaba el stock
   * actual como si fuera una lectura: el sistema se verificaba a sí mismo y la
   * caja quedaba sin contar en cada cambio de turno.
   *
   * Ahora se manda el conteo. OBLIGATORIO de pasar por él, LIBRE de rellenarlo: el
   * cajero puede aceptar lo que ve tal cual, y eso es firma, no error. Si el
   * negocio tiene activa la apertura heredada, el servidor copia la foto anterior
   * y no cuenta.
   */
  const abrirTurno = useCallback(async (
    locationId: string,
    baseCash?: Record<string, number>,
    items?: { productId: string; contado: number }[],
  ) => {
    const r = await apiFetch("/shift/start", {
      method: "POST",
      body: { locationId, baseCash, items, businessAt: new Date().toISOString() },
    });
    const nuevo: ShiftInfo = r?.shift;
    if (nuevo) { setShift(nuevo); persistirTurno(nuevo, cajas); }
    return nuevo;
  }, [cajas]);

  /**
   * Terminar turno ES cerrar el periodo: cuenta la caja, la cierra y concilia la
   * cadena de turnos. Es el mismo handler que usa la pantalla de cierres, así que
   * el resultado sale igual que desde allí.
   */
  const cerrarTurno = useCallback(async (payload?: {
    items?: any[];
    countedCash?: Record<string, number>;
    countedAt?: string;
    notes?: string;
  }) => {
    const r = await apiFetch("/shift/end", {
      method: "POST",
      body: { ...payload, countedAt: payload?.countedAt ?? new Date().toISOString() },
    });
    setShift(null);
    // Las cajas NO se borran al cerrar el turno: siguen siendo las del cajero.
    // Mandarlas a [] vaciaba la lista y dejaba la app sin saber dónde puede
    // abrir el siguiente turno, que es justo lo que hace falta al cerrar uno.
    persistirTurno(null, cajas);
    return r;
  }, [cajas]);

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

  // ── El conteo de apertura ──
  // Abrir turno ES contar la caja. Antes el servidor copiaba el stock actual y lo
  // llamaba lectura: el sistema se verificaba a sí mismo y la caja quedaba sin
  // contar en cada cambio de turno.
  //
  // Es OBLIGATORIO pasar por aquí y LIBRE rellenar: el cajero puede aceptar lo que
  // ve tal cual y seguir. Eso es firma, no error — si después hay faltante, es de
  // quien aceptó contar y no contó, y eso ya es responsabilidad suya.
  //
  // Si el negocio tiene activa la apertura heredada, el paso se salta: el servidor
  // copia la foto anterior y no cuenta.
  const [paso, setPaso] = useState<"elegir" | "contar">("elegir");
  const [conteo, setConteo] = useState<{ productId: string; productName: string; unit: string; esperado: number; contado: number }[]>([]);
  const [cadena, setCadena] = useState<any>(null);
  const [cargandoConteo, setCargandoConteo] = useState(false);

  if (!abierta) return null;

  const empezar = async (locationId: string, items?: { productId: string; contado: number }[]) => {
    try {
      setEligiendo(true);
      const baseCash: Record<string, number> = {};
      for (const m of monedas) {
        const n = Number(m.valor);
        if (Number.isFinite(n) && n > 0) baseCash[m.cur] = n;
      }
      const r = await apiFetch("/shift/start", {
        method: "POST",
        body: { locationId, baseCash, items, businessAt: new Date().toISOString() },
      });
      onListo(r?.shift);
    } catch (e: any) {
      showToast(e.message || "No se pudo abrir el turno", "error");
      setPaso("elegir");
    } finally { setEligiendo(false); }
  };

  /**
   * Pasar al conteo. Pregunta al servidor el estado de la cadena de esa caja, para
   * que el "esperado" sea el que el backend va a usar de verdad y no un cálculo
   * local que podría no coincidir.
   */
  const irAContar = async (locationId: string) => {
    setCargandoConteo(true);
    try {
      const [chain, productos]: any[] = await Promise.all([
        apiFetch(`/closing/chain/${locationId}`),
        apiFetch("/products"),
      ]);
      const esp = new Map<string, number>(
        (chain?.esperado?.items || []).map((x: any) => [String(x.productId), Number(x.diff || 0)]),
      );
      setConteo((productos || []).map((p: any) => {
        const e = esp.get(String(p.id)) ?? 0;
        return { productId: p.id, productName: p.name, unit: p.unit || "u", esperado: e, contado: e };
      }));
      setCadena(chain);
      setPaso("contar");
    } catch (e: any) {
      showToast(e.message || "No se pudo cargar la caja", "error");
    } finally { setCargandoConteo(false); }
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

          {paso === "contar" && (
            <>
              {cadena?.esperado?.faltaEslabon && (
                <div style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.30)", borderRadius: 12, padding: 12, fontSize: 13, color: "#C2410C", fontWeight: 600, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Icon name="alert" size={15} />
                  <span>
                    {cadena.esperado.eslabonFaltante || "Falta el cierre anterior de esta caja"}.
                    Los faltantes que veas <strong>pueden ser de un turno anterior</strong>.
                  </span>
                </div>
              )}
              <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.6, background: "var(--input-bg)", borderRadius: 12, padding: 12 }}>
                <strong>Cuenta la caja.</strong> El esperado es lo que dejó el turno anterior.
                Puedes aceptar todo tal cual si está bien: eso también vale.
              </div>
              <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 12 }}>
                {conteo.map((r, idx) => {
                  const d = Math.round(((Number(r.contado) || 0) - Number(r.esperado)) * 1000) / 1000;
                  const cambia = Math.abs(d) > 0.001;
                  return (
                    <div key={r.productId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", borderBottom: "1px solid var(--line)" }}>
                      <span style={{ flex: 1, fontSize: 13, color: "var(--ink)" }}>{r.productName}</span>
                      <span style={{ width: 58, textAlign: "right", fontSize: 12, color: "var(--muted)" }}>{r.esperado}</span>
                      <input
                        type="number" inputMode="decimal" min={0} step="0.001"
                        value={r.contado}
                        aria-label={`Cantidad de ${r.productName}`}
                        onChange={e => setConteo(prev => prev.map((x, i) => i === idx ? { ...x, contado: e.target.value === "" ? 0 : Number(e.target.value) } : x))}
                        style={{ ...inp, width: 88, padding: "5px 8px", textAlign: "right" }}
                      />
                      <span style={{ width: 50, textAlign: "right", fontSize: 12, fontWeight: 700, color: !cambia ? "#10B981" : (d < 0 ? "#DC2626" : "#F97316") }}>
                        {!cambia ? "✓" : (d < 0 ? `−${Math.abs(d)}` : `+${d}`)}
                      </span>
                    </div>
                  );
                })}
                {conteo.length === 0 && (
                  <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
                    Esta caja no tiene productos que contar.
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={() => elegida && empezar(elegida, conteo.map((r) => ({ productId: r.productId, contado: Number(r.contado) || 0 })))}
                  disabled={!elegida || eligiendo}
                  style={{ ...btn("primary"), opacity: (!elegida || eligiendo) ? 0.55 : 1 }}
                >
                  {eligiendo ? "Abriendo turno…" : "Abrir turno con este conteo"}
                </button>
                <button onClick={() => setPaso("elegir")} style={{ ...btn("ghost"), fontSize: 13 }}>
                  Volver atrás
                </button>
              </div>
            </>
          )}

          {paso === "elegir" && offline && (
            <div style={{ fontSize: 12, color: "#C2410C" }}>
              Sin conexión no se puede abrir turno. Ábrelo con internet una vez.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            <button
              onClick={() => elegida && (cadena?.aperturaHeredada ? empezar(elegida) : irAContar(elegida))}
              disabled={!elegida || eligiendo || cargandoConteo}
              style={{ ...btn("primary"), opacity: (!elegida || eligiendo || cargandoConteo) ? 0.55 : 1, cursor: (!elegida || eligiendo || cargandoConteo) ? "not-allowed" : "pointer" }}
            >
              {cargandoConteo ? "Cargando la caja…" : (cadena?.aperturaHeredada ? "Comenzar turno" : "Continuar al conteo")}
            </button>
            {!cadena?.aperturaHeredada && (
              <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
                Después vas a contar la caja. Puedes aceptarla tal cual si está bien.
              </div>
            )}
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
/**
 * Banda de arriba del POS.
 *
 * "Terminar turno" no cierra el turno: PIDE el cierre. Terminar el turno ES hacer
 * el cierre del periodo —contar la caja, cerrarla y conciliar la cadena—, y eso lo
 * hace `onPedirCierre`. Antes este botón llamaba a /shift/end a pelo y se quedaba
 * un turno en la cadena sin foto de cierre.
 */
export const ShiftBadge = ({
  shift, onPedirCierre,
}: { shift: ShiftInfo; onPedirCierre: () => void }) => {
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
          <span style={{ fontSize: 12, color: "var(--ink)" }}>¿Cerrar caja?</span>
          <button onClick={onPedirCierre} style={{ ...btn("primary"), fontSize: 12, padding: "5px 10px" }}>Sí, contar y cerrar</button>
          <button onClick={() => setConfirmando(false)} style={{ ...btn("secondary"), fontSize: 12, padding: "5px 10px" }}>No</button>
        </span>
      )}
    </div>
  );
};

/**
 * Contar y cerrar el turno.
 *
 * Este modal es la otra mitad de la cadena: abrir turno cuenta la apertura,
 * cerrar turno cuenta el cierre. Los dos son la MISMA operación de negocio y el
 * mismo riesgo si se saltan —sin foto, el siguiente turno hereda un descuadre que
 * no es suyo—, así que los dos son obligatorios.
 *
 * LIBRE de rellenar, igual que la apertura: se puede aceptar todo tal cual. Si
 * después hay faltante, es de quien firmó el cierre.
 *
 * Manda el conteo a /shift/end, que es el mismo handler que usa la pantalla de
 * cierres: una sola manera de cerrar un periodo, o una de las dos se queda sin
 * conciliar.
 */
export const CerrarTurno = ({
  shift, visible, onCerrar, showToast,
}: {
  shift: ShiftInfo;
  visible: boolean;
  onCerrar: (r: any) => void;
  showToast: (m: string, t: string) => void;
}) => {
  const [conteo, setConteo] = useState<{ productId: string; productName: string; unit: string; esperado: number; contado: number }[]>([]);
  const [monedas, setMonedas] = useState<{ cur: string; valor: string }[]>([{ cur: "CUP", valor: "" }]);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(false);

  // El esperado de un cierre es lo que dejó el turno MÁS lo que se vendió. La
  // pantalla de cierres ya lo calcula con /closing/preview; aquí se pide lo mismo
  // para no tener dos fórmulas de "cuánto debería haber" en dos sitios.
  useEffect(() => {
    if (!visible) return;
    let vivo = true;
    setCargando(true);
    (async () => {
      try {
        const r: any = await apiFetch(`/closing/preview/${shift.openingReadingId}`);
        if (!vivo) return;
        const filas: any[] = r?.stock || r?.items || [];
        setConteo(filas.map((i: any) => ({
          productId: i.productId,
          productName: i.productName || i.productCode || "",
          unit: i.unit || "u",
          esperado: Number(i.stockExpected ?? 0),
          contado: Number(i.stockExpected ?? 0),
        })));
        const base: any = r?.baseCash || {};
        setMonedas(Object.keys(base).length
          ? Object.keys(base).map((k) => ({ cur: k, valor: String(base[k] ?? "") }))
          : [{ cur: "CUP", valor: "" }]);
      } catch (e: any) {
        showToast("No se pudo cargar la caja: " + e.message, "error");
      } finally { if (vivo) setCargando(false); }
    })();
    return () => { vivo = false; };
  }, [visible, shift.openingReadingId]);

  if (!visible) return null;

  const confirmar = async () => {
    const countedCash: Record<string, number> = {};
    for (const m of monedas) {
      const n = Number(String(m.valor).replace(",", "."));
      if (m.cur && Number.isFinite(n) && n >= 0) countedCash[m.cur] = n;
    }
    setGuardando(true);
    try {
      const r = await apiFetch("/shift/end", {
        method: "POST",
        body: {
          items: conteo.map((x) => ({
            productId: x.productId,
            stockValidated: Number(x.contado) || 0,
          })),
          countedCash,
          countedAt: new Date().toISOString(),
        },
      });
      onCerrar(r);
    } catch (e: any) {
      showToast(e.message || "No se pudo cerrar el turno", "error");
    } finally { setGuardando(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--card)", borderRadius: 18, width: "100%", maxWidth: 760, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(15,23,42,0.3)" }}>
        <div style={{ padding: "20px 22px 12px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>Cerrar {shift.locationName}</h3>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
            Cuenta la mercadería y el dinero. El esperado ya descuenta lo que vendiste
            en el turno. Puedes aceptarlo tal cual si está bien.
          </p>
        </div>

        <div style={{ padding: "0 22px 12px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>¿Cuánto dinero hay en la caja?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {monedas.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 8 }}>
                <input
                  value={m.cur}
                  onChange={e => setMonedas(monedas.map((x, j) => j === i ? { ...x, cur: e.target.value.toUpperCase().slice(0, 8) } : x))}
                  style={{ ...inp, width: 92 }}
                  aria-label="Moneda"
                />
                <input
                  type="number" inputMode="decimal" min={0} step="0.01"
                  value={m.valor} placeholder="0"
                  onChange={e => setMonedas(monedas.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))}
                  style={{ ...inp, flex: 1 }}
                  aria-label={`Cantidad de ${m.cur || "dinero"}`}
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

          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginTop: 6 }}>Cuenta la mercadería</div>
          {cargando && <div style={{ fontSize: 13, color: "var(--muted)" }}>Cargando la caja…</div>}
          <div style={{ border: "1px solid var(--line)", borderRadius: 12 }}>
            {conteo.map((r, idx) => {
              const d = Math.round(((Number(r.contado) || 0) - Number(r.esperado)) * 1000) / 1000;
              const cambia = Math.abs(d) > 0.001;
              return (
                <div key={r.productId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ flex: 1, fontSize: 13, color: "var(--ink)" }}>{r.productName}</span>
                  <span style={{ width: 58, textAlign: "right", fontSize: 12, color: "var(--muted)" }}>{r.esperado}</span>
                  <input
                    type="number" inputMode="decimal" min={0} step="0.001"
                    value={r.contado}
                    aria-label={`Cantidad de ${r.productName}`}
                    onChange={e => setConteo(prev => prev.map((x, i) => i === idx ? { ...x, contado: e.target.value === "" ? 0 : Number(e.target.value) } : x))}
                    style={{ ...inp, width: 88, padding: "5px 8px", textAlign: "right" }}
                  />
                  <span style={{ width: 50, textAlign: "right", fontSize: 12, fontWeight: 700, color: !cambia ? "#10B981" : (d < 0 ? "#DC2626" : "#F97316") }}>
                    {!cambia ? "✓" : (d < 0 ? `−${Math.abs(d)}` : `+${d}`)}
                  </span>
                </div>
              );
            })}
            {!cargando && conteo.length === 0 && (
              <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
                Esta caja no tiene productos que contar.
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: "14px 22px 20px", display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid var(--line)" }}>
          <button style={btn("secondary")} onClick={() => onCerrar(null)} disabled={guardando}>Cancelar</button>
          <button style={{ ...btn("primary"), opacity: guardando ? 0.6 : 1 }} onClick={confirmar} disabled={guardando || cargando}>
            {guardando ? "Cerrando…" : "Contar y cerrar el turno"}
          </button>
        </div>
      </div>
    </div>
  );
};
