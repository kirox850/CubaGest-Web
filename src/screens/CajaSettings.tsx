import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { fmt } from "@/lib/format";
import Icon from "@/components/shared/Icon";
import { Field, btn, inp } from "@/components/shared/primitives";

// ─── CAJA (configuración) ────────────────────────────────────────────────────
//
// Lo que el dueño de un negocio decide por su cuenta y la plataforma no puede
// decidir por él: cuánto descuadre de dinero se considera redondeo normal.
//
// Sin esto, cualquier caja con billetes sueltos y monedas da un "faltan 63
// pesos" todas las noches. Y un aviso que salta siempre deja de mirarse, que es
// peor que no avisar.

const PRESETS = [
  { valor: 0,    etiqueta: "No tolerar nada",            ayuda: "Avisa de cualquier diferencia, por pequeña que sea." },
  { valor: 100,  etiqueta: "Hasta 100",                  ayuda: "Para una caja pequeña con mucho cambio." },
  { valor: 500,  etiqueta: "Hasta 500",                  ayuda: "Razonable para la mayoría de los negocios." },
  { valor: 1000, etiqueta: "Hasta 1 000",                ayuda: "Negocios con mucho efectivo circulando." },
  { valor: 5,    etiqueta: "5% de lo esperado",          ayuda: "Para negocios grandes: el % pesa más que la cifra fija.", porcentaje: true },
];

export const CajaSettings = ({ user, showToast }: { user: any; showToast: (m: string, t: string) => void }) => {
  const [cargando, setCargando] = useState(true);
  const [modo, setModo] = useState<"absoluto" | "porcentaje">("absoluto");
  const [valor, setValor] = useState<number>(0);
  const [guardando, setGuardando] = useState(false);
  const [aprobacion, setAprobacion] = useState(true);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const s = await apiFetch("/settings");
      setModo(s?.cashToleranceMode || "absoluto");
      setValor(Number(s?.cashToleranceValue ?? 0));
      setAprobacion(s?.cashRequireApproval !== false);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (patch: object) => {
    try {
      setGuardando(true);
      const s = await apiFetch("/settings", { method: "PUT", body: patch });
      setModo(s?.cashToleranceMode ?? modo);
      setValor(Number(s?.cashToleranceValue ?? valor));
      setAprobacion(!!s?.cashRequireApproval);
      showToast("Guardado", "success");
    } catch (e: any) {
      showToast(e.message, "error");
    } finally { setGuardando(false); }
  };

  if (cargando) return <div style={{ color: "var(--muted)", fontSize: 13 }}>Cargando…</div>;

  const esPorcentaje = modo === "porcentaje";
  const enRango = esPorcentaje ? valor <= 100 : valor <= 1_000_000_000;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

      {/* ── El margen ── */}
      <section>
        <h4 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
          Diferencia de dinero tolerable
        </h4>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
          En una caja hay billetes sueltos y monedas: es normal que el contado no cuadre al peso.
          Esta es la diferencia a partir de la cual el cierre avisa. Por encima, no pasa nada.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10, marginBottom: 18 }}>
          {PRESETS.map(p => {
            const on = modo === (p.porcentaje ? "porcentaje" : "absoluto") && valor === p.valor;
            return (
              <button
                key={p.etiqueta}
                onClick={() => guardar({ cashToleranceMode: p.porcentaje ? "porcentaje" : "absoluto", cashToleranceValue: p.valor })}
                disabled={guardando}
                className="btn"
                style={{
                  ...btn(on ? "primary" : "secondary"),
                  flexDirection: "column", alignItems: "flex-start", gap: 4,
                  padding: "12px 14px", textAlign: "left", opacity: guardando ? 0.6 : 1,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700 }}>{p.etiqueta}</span>
                <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.8, lineHeight: 1.4 }}>{p.ayuda}</span>
              </button>
            );
          })}
        </div>

        <Field label="O pon la tuya" required>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={modo}
              onChange={e => { const m = e.target.value as any; setModo(m); guardar({ cashToleranceMode: m }); }}
              disabled={guardando}
              style={{ ...inp, width: 150 }}
            >
              <option value="absoluto">Cantidad fija (CUP)</option>
              <option value="porcentaje">Porcentaje</option>
            </select>
            <input
              type="number" min={0} step="0.01" value={valor}
              onChange={e => setValor(Number(e.target.value))}
              onBlur={() => { if (enRango) guardar({ cashToleranceMode: modo, cashToleranceValue: valor }); }}
              disabled={guardando}
              style={{ ...inp, width: 130 }}
            />
            <span style={{ fontSize: 13, color: "var(--muted)" }}>{esPorcentaje ? "% de lo esperado" : "CUP"}</span>
            {!enRango && (
              <span style={{ fontSize: 12, color: "#C2410C", fontWeight: 600 }}>
                Ese valor es demasiado grande
              </span>
            )}
          </div>
        </Field>

        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "var(--input-bg)", fontSize: 13, color: "var(--ink)", display: "flex", gap: 9, alignItems: "flex-start" }}>
          <Icon name={valor === 0 ? "alert" : "check"} size={15} color={valor === 0 ? "#F97316" : "#10B981"} />
          <span>
            {valor === 0
              ? "Ahora mismo cualquier diferencia, por mínima que sea, genera un aviso en el cierre."
              : esPorcentaje
              ? `Se avisará cuando la diferencia supere el ${valor}% de lo esperado en dinero.`
              : `Se avisará cuando la diferencia supere los ${fmt(valor)} CUP.`}
          </span>
        </div>
      </section>

      {/* ── Aprobación de las salidas de dinero ── */}
      <section style={{ borderTop: "1px solid var(--line)", paddingTop: 20 }}>
        <h4 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
          Salidas de dinero de la caja
        </h4>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
          Cuando alguien saca plata de la caja —un retiro del dueño, un pago, un adelanto— tiene que
          quedar escrito. Si no, el cierre lo ve como un faltante y avisa de un robo que no ocurrió.
        </p>

        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 14, borderRadius: 12, border: "1px solid var(--line)", cursor: "pointer" }}>
          <input
            type="checkbox" checked={aprobacion}
            onChange={e => { setAprobacion(e.target.checked); guardar({ cashRequireApproval: e.target.checked }); }}
            disabled={guardando || user.role !== "admin"}
            style={{ marginTop: 3, width: 17, height: 17 }}
          />
          <span>
            <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
              Toda salida necesita aprobación de un admin o un contador
            </span>
            <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>
              El cajero puede anotarla durante su turno (también sin conexión, guardando la hora real),
              pero no queda firme hasta que alguien la aprueba. Recomendado: dejarlo siempre activo.
            </span>
          </span>
        </label>
        {user.role !== "admin" && (
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
            Solo el administrador de la empresa puede cambiar esto.
          </div>
        )}
      </section>
    </div>
  );
};
