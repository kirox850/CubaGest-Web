import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { fmt } from "@/lib/format";
import Icon from "@/components/shared/Icon";
import { Spinner, Field, btn, inp } from "@/components/shared/primitives";
import { CURRENCY_SYMBOLS } from "@/config/constants";

// ─── EL DINERO DEL CIERRE ────────────────────────────────────────────────────
//
// El cierre anterior solo contaba productos. Esta es la parte que responde a la
// pregunta que de verdad importa al final del día: ¿entró lo que tenía que
// entrar?
//
// La cuenta se muestra EN PIE, como una caja:
//   base + ventas en efectivo + entradas − salidas = lo que debería haber
//
// Y cada moneda va por separado. Si la caja tiene 100 CUP y 2 USD, se compara
// 100 contra los CUP y 2 contra los USD: sumarlos daría "102" contra un total
// en pesos, que no significa absolutamente nada.

export type Cajas = Record<string, number>;

const simboloDe = (cur: string) => CURRENCY_SYMBOLS[cur] || "";

const Linea = ({ k, valor, signo, fuerte }: { k: string; valor: number; signo?: 1 | -1; fuerte?: boolean }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "3px 0" }}>
    <span style={{ fontSize: 13, color: fuerte ? "var(--ink)" : "var(--muted)", fontWeight: fuerte ? 700 : 400 }}>
      {k} {simboloDe(k)}
    </span>
    <span style={{
      fontSize: fuerte ? 15 : 13, fontWeight: fuerte ? 800 : 600,
      fontVariantNumeric: "tabular-nums" as any,
      color: signo === 1 ? "#059669" : signo === -1 ? "#DC2626" : "var(--ink)",
    }}>
      {signo === -1 ? "−" : ""}{fmt(Math.abs(valor))}
    </span>
  </div>
);

export const DineroCierre = ({
  preview, contado, setContado, baseCash,
}: {
  preview: any;
  contado: Cajas;
  setContado: (c: Cajas) => void;
  baseCash: Cajas;
}) => {
  const esperado: Cajas = preview?.cash?.esperado || {};
  const ventas: Cajas = preview?.cash?.ventas || {};
  const entradas: Cajas = preview?.cash?.entradas || {};
  const salidas: Cajas = preview?.cash?.salidas || {};

  // Las monedas que hay que pedir: las del esperado y las que el cajero ya
  // escribió. Si puso una moneda que no se esperaba, se conserva — puede estar
  // contando ese dinero de verdad.
  const monedas = Array.from(new Set([...Object.keys(esperado), ...Object.keys(contado)]));

  if (monedas.length === 0) {
    return (
      <div style={{ padding: 16, borderRadius: 12, background: "var(--input-bg)", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
        Este turno no movió dinero: no hubo ventas en efectivo ni movimientos en la caja.
        Si estás contando dinero y no aparece aquí, revisa que las ventas se hayan
        registrado en esta caja.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {monedas.map((k) => {
        const e = esperado[k] || 0;
        const c = Number(contado[k] || 0);
        const d = Math.round((c - e) * 100) / 100;
        return (
          <div key={k} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "13px 14px" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 9 }}>
              {k} {simboloDe(k)}
            </div>

            <div style={{ marginBottom: 11 }}>
              <Linea k="Fondo al abrir turno" valor={baseCash[k] || 0} />
              <Linea k="Ventas en efectivo" valor={ventas[k] || 0} signo={1} />
              {entradas[k] ? <Linea k="Entradas" valor={entradas[k]} signo={1} /> : null}
              {salidas[k] ? <Linea k="Salidas" valor={salidas[k]} signo={-1} /> : null}
              <div style={{ borderTop: "1px solid var(--line)", marginTop: 6, paddingTop: 5 }}>
                <Linea k="Debería haber" valor={e} fuerte />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 5 }}>
                ¿Cuánto hay contados?
              </label>
              <input
                type="number" inputMode="decimal" min={0} step="0.01"
                value={contado[k] ?? ""}
                onChange={e => setContado({ ...contado, [k]: e.target.value === "" ? (undefined as any) : Number(e.target.value) })}
                placeholder="0"
                style={{ ...inp, fontSize: 17, fontWeight: 700 }}
              />
            </div>

            {contado[k] !== undefined && contado[k] !== null && !Number.isNaN(c) && Math.abs(d) > 0.005 && (
              <div style={{ marginTop: 9, padding: "9px 11px", borderRadius: 10, background: d < 0 ? "rgba(220,38,38,0.07)" : "rgba(5,150,105,0.07)", fontSize: 12.5, fontWeight: 700, color: d < 0 ? "#B91C1C" : "#047857" }}>
                {d < 0 ? `Faltan ${fmt(Math.abs(d))} ${k}` : `Sobran ${fmt(Math.abs(d))} ${k}`}
              </div>
            )}
          </div>
        );
      })}

      {monedas.length > 0 && (
        <button
          onClick={() => {
            const usadas = new Set(monedas);
            let extra = "USD";
            let n = 1;
            while (usadas.has(extra)) extra = `OTRA${n++}`;
            setContado({ ...contado, [extra]: undefined as any });
          }}
          style={{ ...btn("ghost"), fontSize: 12, alignSelf: "flex-start" }}
        >
          <Icon name="plus" size={13} />Contar en otra moneda
        </button>
      )}
    </div>
  );
};

// ─── EXPLICAR UN DESCUADRE ──────────────────────────────────────────────────
//
// Mientras el cierre está provisional, el que cerró el turno puede decir
// cuánto y por qué. Solo se acepta si coincide EXACTO con la diferencia: si
// el cierre dice que faltan 300 y alguien pone 297, no se acepta, porque un
// cierre de caja sirve justamente para que las cuentas cuadren al peso.
export const ExplicarDescuadre = ({
  closing, onResuelto, showToast,
}: {
  closing: any;
  onResuelto: () => void;
  showToast: (m: string, t: string) => void;
}) => {
  const diff: Cajas = closing?.cashDiff || {};
  const [monedaAbierta, setMonedaAbierta] = useState<string | null>(null);
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  const monedas = Object.keys(diff);
  if (monedas.length === 0) return null;

  const explicar = async (cur: string) => {
    const n = Number(monto);
    if (!Number.isFinite(n) || Math.abs(n - Math.abs(diff[cur])) > 0.005) {
      showToast(`La diferencia es de ${fmt(Math.abs(diff[cur]))} ${cur}. Tiene que coincidir exactamente.`, "error");
      return;
    }
    if (!nota.trim()) { showToast("Escribe qué pasó", "error"); return; }
    try {
      setGuardando(true);
      const r = await apiFetch(`/closing/${closing.id}/explain`, {
        method: "POST", body: { currency: cur, amount: n, note: nota.trim() },
      });
      if (r?.status === "resuelto") {
        showToast("Cierre resuelto", "success");
        setMonedaAbierta(null);
        onResuelto();
      } else {
        showToast("Explicación guardada", "success");
        setMonedaAbierta(null); setMonto(""); setNota("");
        onResuelto();
      }
    } catch (e: any) {
      showToast(e.message, "error");
    } finally { setGuardando(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {monedas.map((cur) => {
        const d = diff[cur];
        const estaAbierta = monedaAbierta === cur;
        return (
          <div key={cur} style={{ border: "1px solid rgba(220,38,38,0.28)", background: "rgba(220,38,38,0.04)", borderRadius: 12, padding: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: d < 0 ? "#B91C1C" : "#047857" }}>
                {d < 0 ? `Faltan ${fmt(Math.abs(d))} ${cur}` : `Sobran ${fmt(Math.abs(d))} ${cur}`}
              </span>
              {!estaAbierta && (
                <button onClick={() => { setMonedaAbierta(cur); setMonto(String(Math.abs(d))); }}
                  style={{ ...btn("secondary"), fontSize: 12, padding: "6px 11px" }}>Explicar</button>
              )}
            </div>

            {estaAbierta && (
              <div style={{ marginTop: 11, display: "flex", flexDirection: "column", gap: 9 }}>
                <div>
                  <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>Cantidad</label>
                  <input type="number" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} style={{ ...inp }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>¿Qué pasó?</label>
                  <input
                    value={nota} onChange={e => setNota(e.target.value)}
                    placeholder="Ej: se me quedó una vuelta al cliente / faltó un pedido"
                    style={{ ...inp }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setMonedaAbierta(null)} style={{ ...btn("secondary"), fontSize: 12 }}>Cancelar</button>
                  <button onClick={() => explicar(cur)} disabled={guardando} style={{ ...btn("primary"), fontSize: 12, opacity: guardando ? 0.6 : 1 }}>
                    {guardando ? "Guardando…" : "Guardar explicación"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── POR QUÉ FALTÓ MERCANCÍA ────────────────────────────────────────────────
//
// Esto NO resuelve el cierre. Es el relato de por qué faltaron 3 cigarettes,
// para el día que alguien pregunte. El cierre sigue pendiente hasta que la
// mercancía cuadre, porque escribir por qué no hace que falte menos.
export const NotasMercaderia = ({
  pendientes, notas, closingId, showToast, onGuardado,
}: {
  pendientes: { productId: string; productName: string; unit: string; shortage: number }[];
  notas: { id: string; productId?: string | null; productName?: string | null; qty: number; note: string; autor: string; createdAt: string }[];
  closingId: string;
  showToast: (m: string, t: string) => void;
  onGuardado: () => void;
}) => {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async (productId?: string) => {
    if (!texto.trim()) { showToast("Escribe la nota", "error"); return; }
    try {
      setGuardando(true);
      await apiFetch(`/closing/${closingId}/note`, {
        method: "POST", body: { productId, note: texto.trim() },
      });
      setTexto(""); setAbierta(null);
      showToast("Nota guardada", "success");
      onGuardado();
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setGuardando(false); }
  };

  if (pendientes.length === 0 && notas.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {notas.length > 0 && (
        <div style={{ background: "var(--input-bg)", borderRadius: 12, padding: "11px 13px" }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" as any, marginBottom: 7 }}>
            Notas sobre lo que faltó
          </div>
          {notas.map((n) => (
            <div key={n.id} style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.5, marginBottom: 6 }}>
              {n.productName ? <strong>{n.productName}: </strong> : null}
              {n.note}
              <span style={{ color: "var(--muted)", fontSize: 11 }}> — {n.autor}</span>
            </div>
          ))}
        </div>
      )}

      {pendientes.map((l) => {
        const yaEsta = abierta === l.productId;
        const suyas = notas.filter((n) => n.productId === l.productId);
        return (
          <div key={l.productId} style={{ border: "1px solid rgba(217,119,6,0.30)", background: "rgba(217,119,6,0.04)", borderRadius: 12, padding: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: l.shortage > 0 ? "#B45309" : "#047857" }}>
                {l.shortage > 0 ? "Faltan" : "Sobran"} {Math.abs(Math.round(l.shortage * 100) / 100)} {l.unit || "ud"} de {l.productName}
              </span>
              {!yaEsta && (
                <button onClick={() => { setAbierta(l.productId); setTexto(""); }}
                  style={{ ...btn("secondary"), fontSize: 12, padding: "6px 11px" }}>Explicar por qué</button>
              )}
            </div>
            {suyas.length > 0 && !yaEsta && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 7, lineHeight: 1.5 }}>
                Ya está anotado: {suyas.map((n) => n.note).join(" · ")}
              </div>
            )}

            {yaEsta && (
              <div style={{ marginTop: 11, display: "flex", flexDirection: "column", gap: 9 }}>
                <input value={texto} onChange={(e) => setTexto(e.target.value)}
                  placeholder="Ej: se rompió un paquete al moverlo / lo took un cliente sin pagar"
                  style={inp} />
                <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5 }}>
                  Esto queda anotado en el cierre. No lo resuelve: el cierre
                  sigue pendiente hasta que la mercancía cuadre.
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setAbierta(null)} style={{ ...btn("secondary"), fontSize: 12 }}>Cancelar</button>
                  <button onClick={() => guardar(l.productId)} disabled={guardando}
                    style={{ ...btn("primary"), fontSize: 12, opacity: guardando ? 0.6 : 1 }}>
                    {guardando ? "Guardando…" : "Guardar nota"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
