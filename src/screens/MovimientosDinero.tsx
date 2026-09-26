import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { fmt } from "@/lib/format";
import Icon from "@/components/shared/Icon";
import { Spinner, Modal, Field, btn, inp, sel } from "@/components/shared/primitives";
import { CURRENCY_SYMBOLS } from "@/config/constants";

// ─── ENTRADAS Y SALIDAS DE DINERO ────────────────────────────────────────────
//
// Esta pantalla existe por una razón muy concreta: cuando alguien saca plata de
// la caja, el cierre la ve como faltante y avisa de un robo que no ocurrió.
// Nadie puede distinguir "me faltó" de "el dueño retiró y no lo dijo".
//
// Y hay un segundo motivo: si toda salida tiene que quedar escrita y aprobada,
// el dueño puede ver a dónde fue el dinero. Esa es la diferencia entre un
// sistema de gestión y una libreta.

const TIPO_COLOR: Record<string, string> = { entrada: "#059669", salida: "#DC2626" };
const ESTADO: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Por aprobar", color: "#D97706" },
  aprobada:  { label: "Aprobada",    color: "#059669" },
  rechazada: { label: "Rechazada",   color: "#DC2626" },
};

export const MovimientosDinero = ({
  user, showToast, locationId, locationName,
}: {
  user: any;
  showToast: (m: string, t: string) => void;
  locationId: string;
  locationName: string;
}) => {
  const [lista, setLista] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);

  const puedeAprobar = user?.role === "admin" || user?.role === "contador";

  const cargar = useCallback(async () => {
    if (!locationId) return;
    try {
      setCargando(true);
      setLista((await apiFetch(`/cash-movements?locationId=${locationId}`)) || []);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally { setCargando(false); }
  }, [locationId]);

  useEffect(() => { cargar(); }, [cargar]);

  const decidir = async (id: string, decision: "aprobar" | "rechazar") => {
    try {
      await apiFetch(`/cash-movements/${id}/decide`, { method: "POST", body: { decision } });
      showToast(decision === "aprobar" ? "Movimiento aprobado" : "Movimiento rechazado", "success");
      cargar();
    } catch (e: any) { showToast(e.message, "error"); }
  };

  const pendientes = lista.filter((m) => m.status === "pendiente");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: "0 0 3px", fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>
            Dinero de {locationName}
          </h3>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
            Lo que entra y sale de la caja. Todo lo que sale necesita un motivo.
          </p>
        </div>
        <button onClick={() => setModal(true)} style={{ ...btn("primary"), fontSize: 13 }}>
          <Icon name="plus" size={15} />Registrar movimiento
        </button>
      </div>

      {pendientes.length > 0 && (
        <div style={{ padding: 13, borderRadius: 12, background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.30)" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#92400E", marginBottom: 3 }}>
            {pendientes.length} {pendientes.length === 1 ? "movimiento espera" : "movimientos esperan"} tu aprobación
          </div>
          <div style={{ fontSize: 12, color: "#B45309", lineHeight: 1.5 }}>
            Hasta que los apruebes, no cuentan como dinero de la caja: por eso el
            cierre de quien está trabajando todavía no cuadra.
          </div>
        </div>
      )}

      {cargando ? <Spinner /> : lista.length === 0 ? (
        <div style={{ padding: 22, borderRadius: 12, background: "var(--input-bg)", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
          Aún no hay entradas ni salidas registradas en esta caja.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lista.map((m) => {
            const est = ESTADO[m.status] || ESTADO.pendiente;
            const mio = m.id && user?.id;
            return (
              <div key={m.id} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: TIPO_COLOR[m.type] || "var(--ink)" }}>
                        {m.type === "entrada" ? "+" : "−"}{fmt(m.amount)} {CURRENCY_SYMBOLS[m.currency] || ""} {m.currency}
                      </span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: `${est.color}1A`, color: est.color }}>
                        {est.label}
                      </span>
                    </div>
                    {m.reason && <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 5, lineHeight: 1.45 }}>{m.reason}</div>}
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
                      {m.userName} · {new Date(m.createdAt).toLocaleString("es-ES")}
                    </div>
                    {m.decisionNote && (
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4, fontStyle: "italic" }}>
                        Nota de la decisión: {m.decisionNote}
                      </div>
                    )}
                  </div>

                  {puedeAprobar && m.status === "pendiente" && (
                    <div style={{ display: "flex", gap: 7 }}>
                      <button onClick={() => decidir(m.id, "rechazar")} style={{ ...btn("secondary"), fontSize: 12, padding: "6px 11px" }}>Rechazar</button>
                      <button onClick={() => decidir(m.id, "aprobar")} style={{ ...btn("primary"), fontSize: 12, padding: "6px 11px" }}>Aprobar</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ModalMovimiento
        abierto={modal}
        onClose={() => setModal(false)}
        locationId={locationId}
        user={user}
        showToast={showToast}
        onGuardado={() => { setModal(false); cargar(); }}
      />
    </div>
  );
};

const ModalMovimiento = ({
  abierto, onClose, locationId, user, showToast, onGuardado,
}: {
  abierto: boolean; onClose: () => void; locationId: string;
  user: any; showToast: (m: string, t: string) => void; onGuardado: () => void;
}) => {
  const [type, setType] = useState<"entrada" | "salida">("salida");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState("CUP");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  if (!abierto) return null;
  const n = Number(monto);
  const valido = Number.isFinite(n) && n > 0 && (type === "entrada" || motivo.trim().length > 0);

  const guardar = async () => {
    try {
      setGuardando(true);
      await apiFetch("/cash-movements", {
        method: "POST",
        body: { locationId, type, amount: n, currency: moneda, reason: motivo.trim() },
      });
      showToast("Movimiento registrado", "success");
      setMonto(""); setMotivo(""); setType("salida");
      onGuardado();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally { setGuardando(false); }
  };

  return (
    <Modal title="Movimiento de dinero" onClose={onClose} width={480}>
      <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {(["salida", "entrada"] as const).map((t) => (
            <button key={t} onClick={() => setType(t)}
              style={{ ...btn(t === type ? "primary" : "secondary"), flex: 1, fontSize: 13 }}>
              {t === "salida" ? "Sale dinero" : "Entra dinero"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" inputMode="decimal" min={0} step="0.01" value={monto}
            onChange={e => setMonto(e.target.value)} placeholder="Cantidad"
            style={{ ...inp, flex: 1, fontSize: 18, fontWeight: 700 }} />
          <input value={moneda} onChange={e => setMoneda(e.target.value.toUpperCase().slice(0, 8))}
            style={{ ...inp, width: 92, textTransform: "uppercase" as any }} aria-label="Moneda" />
        </div>

        {type === "salida" && (
          <Field label="¿Para qué es?" required>
            <input value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ej: pago al proveedor, retiro del dueño, adelanto"
              style={inp} />
          </Field>
        )}
        {type === "entrada" && (
          <Field label="Motivo (opcional)">
            <input value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ej: cambio del cajero, devolución de un cliente"
              style={inp} />
          </Field>
        )}

        <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--input-bg)", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
          {type === "salida"
            ? "Quedará pendiente hasta que un administrador o un contador lo apruebe. Hasta entonces no descuenta de la caja."
            : "Quedará pendiente hasta que un administrador o un contador lo apruebe."}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button style={btn("secondary")} onClick={onClose}>Cancelar</button>
          <button style={{ ...btn("primary"), opacity: (!valido || guardando) ? 0.6 : 1 }}
            onClick={guardar} disabled={!valido || guardando}>
            {guardando ? "Guardando…" : "Registrar"}
          </button>
        </div>
      </div>
    </Modal>
  );
};
