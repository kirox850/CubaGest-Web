import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import Icon from "@/components/shared/Icon";
import { Spinner, btn, inp } from "@/components/shared/primitives";

// ─── CAJAS ───────────────────────────────────────────────────────────────────
//
// Las cajas son del NEGOCIO, no de un cajero. El admin las crea y decide qué
// cajeros pueden usar cada una. Ese cambio es la diferencia entre tener un
// mostrador con tres personas rotando (una caja) y tener tres cajas con tres
// copias del mismo inventario.
//
// Y aquí está el aviso que hay que leer antes de tocar nada: una caja NO puede
// tener dos turnos abiertos a la vez. Si está en uso, quien intente tomarla
// tiene que esperar o elegir otra.

export const CajasAdmin = ({ showToast, embedded }: { showToast: (m: string, t: string) => void; embedded?: boolean }) => {
  const [cajas, setCajas] = useState<any[]>([]);
  const [cajeros, setCajeros] = useState<any[]>([]);
  const [asignadas, setAsignadas] = useState<Record<string, string[]>>({});
  const [cargando, setCargando] = useState(true);
  const [nueva, setNueva] = useState("");
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const [loc, usrs] = await Promise.all([
        apiFetch("/locations"),
        apiFetch("/users"),
      ]);
      const c = (loc as any[]).filter((l: any) => l.type === "caja");
      setCajas(c);
      setCajeros((usrs as any[]).filter((u: any) => u.role === "cajero" && u.active !== false));
      // Las asignaciones se piden por cajero: el endpoint es por usuario.
      const todas: Record<string, string[]> = {};
      for (const u of (usrs as any[]).filter((x: any) => x.role === "cajero")) {
        try {
          const r = await apiFetch(`/shift/assignments/${u.id}`);
          todas[u.id] = (r as any[]).map((a: any) => a.id);
        } catch { todas[u.id] = []; }
      }
      setAsignadas(todas);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const crear = async () => {
    if (!nueva.trim()) return;
    try {
      setCreando(true);
      await apiFetch("/locations", { method: "POST", body: { name: nueva.trim(), type: "caja" } });
      setNueva("");
      showToast("Caja creada", "success");
      await cargar();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally { setCreando(false); }
  };

  const alternar = async (userId: string, locationId: string) => {
    const actual = asignadas[userId] || [];
    const siguiente = actual.includes(locationId)
      ? actual.filter((x) => x !== locationId)
      : [...actual, locationId];
    setAsignadas({ ...asignadas, [userId]: siguiente });   // optimista: se siente rápido
    setGuardando(true);
    try {
      const r = await apiFetch(`/shift/assignments/${userId}`, { method: "PUT", body: { locationIds: siguiente } });
      setAsignadas({ ...asignadas, [userId]: (r as any[]).map((a: any) => a.id) });
    } catch (e: any) {
      setAsignadas({ ...asignadas, [userId]: actual });   // se revierte: no se miente al admin
      showToast(e.message, "error");
    } finally { setGuardando(false); }
  };

  if (cargando) return <Spinner />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

      {/* ── Crear caja ── */}
      <section>
        <h4 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Cajas de tu negocio</h4>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
          Una caja por mostrador o por mostradores, no por empleado. Si tres personas
          rotan en el mismo mostrador, usan la misma caja: así el inventario se cuenta una vez.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={nueva} onChange={e => setNueva(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") crear(); }}
            placeholder="Ej: Caja 1, Mostrador 2, Kiosco…"
            style={{ ...inp, flex: 1, minWidth: 200 }}
          />
          <button onClick={crear} disabled={creando || !nueva.trim()} style={{ ...btn("primary"), opacity: (!nueva.trim() || creando) ? 0.6 : 1 }}>
            {creando ? "Creando…" : <><Icon name="plus" size={15} />Crear caja</>}
          </button>
        </div>

        {cajas.length > 0 && (
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {cajas.map((c) => (
              <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 999, background: "var(--input-bg)", border: "1px solid var(--line)", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                <Icon name="pos" size={14} color="#64748B" />{c.name}
                {!c.active && <span style={{ fontSize: 11, color: "#C2410C" }}>(desactivada)</span>}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ── Asignar ── */}
      <section style={{ borderTop: "1px solid var(--line)", paddingTop: 20 }}>
        <h4 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Quién puede usar cada caja</h4>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
          Marca las cajas de cada cajero. Al abrir su turno él elige con cuál trabaja,
          así que puede tener varias asignadas. Todos los marcados pueden usar la misma
          caja, pero no al mismo tiempo: mientras uno tenga el turno abierto, los demás
          tienen que usar otra.
        </p>

        {cajeros.length === 0 ? (
          <div style={{ padding: 16, borderRadius: 12, background: "var(--input-bg)", fontSize: 13, color: "var(--muted)" }}>
            Todavía no hay ningún cajero en la empresa. Crea uno desde la pestaña Usuarios.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cajeros.map((u) => (
              <div key={u.id} style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
                <button
                  onClick={() => setEditando(editando === u.id ? null : u.id)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: editando === u.id ? "var(--input-bg)" : "transparent", border: "none", cursor: "pointer", textAlign: "left" as any }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{u.name}</span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>
                      {(asignadas[u.id] || []).length === 0
                        ? "Sin cajas asignadas — no podrá abrir turno"
                        : `${(asignadas[u.id] || []).length} caja${(asignadas[u.id] || []).length === 1 ? "" : "s"}`}
                    </span>
                  </span>
                  <Icon name={editando === u.id ? "minus" : "plus"} size={15} color="#64748B" />
                </button>

                {editando === u.id && (
                  <div style={{ padding: "0 14px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {cajas.length === 0 ? (
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>Primero crea una caja arriba.</span>
                    ) : cajas.map((c) => {
                      const marcado = (asignadas[u.id] || []).includes(c.id);
                      return (
                        <button
                          key={c.id} onClick={() => alternar(u.id, c.id)} disabled={guardando}
                          style={{
                            ...btn(marcado ? "primary" : "secondary"),
                            fontSize: 12, padding: "7px 12px",
                            opacity: c.active ? 1 : 0.5,
                            cursor: c.active ? "pointer" : "not-allowed",
                          }}
                        >
                          {marcado && <Icon name="check" size={12} />}{c.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
