import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { DineroCierre, ExplicarDescuadre } from "@/components/shared/DineroCierre";
import { MovimientosDinero } from "@/screens/MovimientosDinero";
import { useOnlineStatus } from "@/hooks/useOnline";
import { useLocations, useReadings } from "@/hooks/useLocations";
import {
  saveClosingOffline, getPendingClosings, type PendingClosing,
} from "@/offlineDB";
import { fmt } from "@/lib/format";
import Icon from "@/components/shared/Icon";
import { Badge, Field, Modal, Spinner, btn, inp, sel } from "@/components/shared/primitives";

// ─── CIERRE DE CAJA ───────────────────────────────────────────────────────────
const CierreCaja = ({ user, showToast }: { user: any; showToast: (m: string, t: string) => void }) => {
  const [view, setView]               = useState<"list"|"selectReading"|"validate"|"detail"|"dinero">("list");
  const [closings, setClosings]       = useState<any[]>([]);
  const [pendientes, setPendientes]   = useState<PendingClosing[]>([]);
  const [readingLocationId, setReadingLocationId] = useState("");

  // Ubicaciones y lecturas se resuelven con red O desde la copia local. Sin red
  // esto no se puede hacer un cierre, y antes fallaba justo ahí.
  const online = useOnlineStatus();
  const { locations, locationId } = useLocations(user);
  const { readings } = useReadings(user);
  const account = { companyId: user?.company?.id || "", userId: user?.id || "" };
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [selectedReading, setSelectedReading] = useState<any>(null);
  const [preview, setPreview]         = useState<any>(null);
  // El dinero contado en la caja, por moneda. Se pide al confirmar, porque es
  // un dato del cajero: el servidor solo puede saber cuánto DEBERÍA haber.
  const [contado, setContado]         = useState<Record<string, number>>({});
  const [validatedItems, setValidatedItems]   = useState<Record<string, number>>({});
  const [detailClosing, setDetailClosing]     = useState<any>(null);
  const [confirmReading, setConfirmReading]   = useState(false);
  const [notes, setNotes]             = useState("");

  /**
   * Reconstruye la pantalla de conteo con lo que hay en el móvil.
   *
   * Lo que SÍ se sabe sin conexión: qué productos había, de qué unidad y con
   * cuánto stock arrancó el período (eso viene en la lectura).
   * Lo que NO se sabe: cuánto se vendió, cuál era el esperado y por lo tanto
   * los faltantes. Eso vive en el servidor y el móvil no tiene las ventas ya
   * sincronizadas. Por eso esas columnas salen como "pendiente" y el cálculo se
   * hace al enviarse el cierre.
   */
  const previewSinConexion = (reading: any) => ({
    offline: true,
    periodStart: reading.createdAt ?? reading.date,
    totalSales: null,
    totalIncome: null,
    incomeEfectivo: null,
    incomeTransferencia: null,
    items: ((reading.items ?? []) as any[]).map((it) => ({
      productId: it.productId,
      productCode: it.productCode,
      productName: it.productName,
      unit: it.unit,
      price: 0,
      stockInitial: it.qty,
      stockSold: null,
      stockExpected: null,
      stockValidated: null,
      shortage: null,
      income: null,
    })),
  });

  const isAdmin = user.role === "admin";
  const locationName = (id: string) => locations.find((l:any)=>l.id===id)?.name || "—";

  // Ubicación por defecto para tomar una lectura nueva: el almacén si existe.
  useEffect(() => {
    setReadingLocationId(prev => prev || locations.find((l:any)=>l.type==="almacen")?.id || locations[0]?.id || "");
  }, [locations.length]);

  const loadClosings = useCallback(async () => {
    // Los cierres que se hicieron sin conexión se muestran siempre, estén o
    // no en el servidor: son trabajo real que ya se hizo y no se puede perder.
    getPendingClosings(account).then(setPendientes).catch(() => {});

    if (!online) { setLoading(false); return; }
    try {
      setLoading(true);
      const list = await apiFetch("/closing");
      setClosings(list);
    } catch (e: any) {
      if (online) showToast(e.message, "error");
    }
    finally { setLoading(false); }
  }, [online, account.companyId, account.userId]);

  useEffect(() => { loadClosings(); }, [loadClosings]);

  const startClosing = async () => {
    if (readings.length === 0) {
      showToast(online ? "No hay lecturas disponibles" : "No hay lecturas descargadas. Entra con internet una vez para poder cerrar sin conexión después.", "warning");
    }
    setView("selectReading");
  };

  const selectReading = async (reading: any) => {
    setSelectedReading(reading);
    setSaving(true);
    try {
      const data = online
        ? await apiFetch(`/closing/preview/${reading.id}`)
        // Sin conexión se arma la misma pantalla con lo que trae la lectura
        // (el stock con el que arrancó el período). Vendido / esperado /
        // faltante quedan pendientes: dependen de las ventas, que el móvil no
        // tiene todas, y calcularlos aquí daría cifras inventadas.
        : previewSinConexion(reading);
      setPreview(data);
      const initValidated: Record<string, number> = {};
      for (const item of data.items) initValidated[item.productId] = item.stockValidated ?? 0;
      setValidatedItems(initValidated);
      setView("validate");
    } catch (e: any) {
      showToast(online ? e.message : "Sin conexión y esta lectura no está descargada.", "error");
    }
    finally { setSaving(false); }
  };

  // Tras explicar un descuadre, el cierre cambia de estado en el servidor: sin
  // recargar, la pantalla seguiría diciendo "pendiente" de algo ya resuelto.
  const reloadDetail = async (id: string) => {
    try { setDetailClosing(await apiFetch(`/closing/${id}`)); } catch { /* se queda lo que hay */ }
    loadClosings();
  };

  const confirmClosing = async () => {
    try {
      setSaving(true);
      const items = Object.entries(validatedItems).map(([productId, stockValidated]) => ({ productId, stockValidated }));

      if (!online) {
        // Sin conexión se guarda el CONTEO, no un cierre ya calculado. Al volver
        // la conexión se envía y el servidor calcula vendido/esperado/faltantes
        // con las ventas reales del período.
        const loc = locations.find((l: any) => l.id === selectedReading.locationId);
        await saveClosingOffline(account, {
          initialReadingId: selectedReading.id,
          items,
          countedCash: contado,
          notes,
          locationId: selectedReading.locationId ?? null,
          locationName: loc?.name ?? null,
          // La HORA del conteo, no la de la subida: de esto depende que la
          // ventana para explicar un descuadre no empiece a contar cuando
          // por fin volvió internet.
          timestamp: Date.now(),
        });
        showToast("Cierre guardado en el móvil. Se enviará solo cuando vuelva el internet.", "success");
        setView("list"); setPreview(null); setNotes(""); setContado({});
        setValidatedItems({});
        loadClosings();
        return;
      }

      await apiFetch("/closing/confirm", {
        method: "POST",
        body: {
          initialReadingId: selectedReading.id, items, notes,
          countedCash: contado,
          countedAt: new Date().toISOString(),
        },
      });
      const descuadra = Object.keys(preview?.cash?.esperado || {})
        .some((k) => Math.abs((Number(contado[k] || 0)) - (preview.cash.esperado[k] || 0)) > 0.005);
      showToast(
        descuadra ? "Cierre registrado. Queda pendiente por el descuadre de dinero."
                  : "Cierre registrado correctamente",
        descuadra ? "warning" : "success",
      );
      setView("list"); setPreview(null); setNotes(""); setContado({}); loadClosings();
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const takeReading = async () => {
    if (!readingLocationId) return showToast("Selecciona la ubicación", "error");
    try {
      setSaving(true);
      await apiFetch("/closing/readings", { method: "POST", body: { locationId: readingLocationId, notes: "Lectura de apertura manual" } });
      showToast("Lectura de inventario tomada", "success");
      setConfirmReading(false);
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("es-CU", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });

  const tbl = { width:"100%", borderCollapse:"collapse" as const, fontSize:13 };
  const th  = { padding:"10px 12px", textAlign:"left" as const, fontWeight:700, color:"var(--muted)", fontSize:11, textTransform:"uppercase" as const, borderBottom:"1px solid var(--line)", whiteSpace:"nowrap" as const };
  const td  = (highlight?: boolean) => ({ padding:"10px 12px", borderBottom:"1px solid var(--input-bg)", background: highlight ? "rgba(249,115,22,0.08)" : "var(--card)" });

  // ── Lista ───────────────────────────────────────────────────────────────────
  if (view === "dinero") {
    // La caja activa es la del turno del cajero, o la que tenga seleccionada.
    const loc = locations.find((l: any) => l.id === locationId);
    return (
      <div style={{ maxWidth:900, margin:"0 auto" }}>
        <button style={{ ...btn("ghost"), marginBottom:14, paddingLeft:0 }} onClick={() => setView("list")}>
          ← Volver a cierres
        </button>
        {loc ? (
          <MovimientosDinero
            user={user}
            showToast={showToast}
            locationId={loc.id}
            locationName={loc.name}
          />
        ) : (
          <div style={{ padding:22, borderRadius:12, background:"var(--input-bg)", textAlign:"center", fontSize:13, color:"var(--muted)" }}>
            No hay ninguna caja a la que mirar el dinero.
          </div>
        )}
      </div>
    );
  }

  if (view === "list") return (
    <div style={{ maxWidth:900, margin:"0 auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap" as const, gap:12 }}>
        <div>
          <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:800, color:"var(--ink)" }}>Cierre de Caja</h2>
          <p style={{ margin:0, fontSize:13, color:"var(--muted)" }}>Conciliación de ventas, stock e ingresos</p>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <button style={{ ...btn("secondary"), fontSize:13 }} onClick={() => setView("dinero")}>
            <Icon name="facturacion" size={15}/>Entradas y salidas
          </button>
          {isAdmin && (
            <button style={{ ...btn("secondary"), fontSize:13 }} onClick={() => setConfirmReading(true)}>
              <Icon name="refresh" size={15}/>Lectura de apertura
            </button>
          )}
          <button style={{ ...btn("primary"), fontSize:13 }} onClick={startClosing}>
            <Icon name="check" size={15}/>Iniciar cierre
          </button>
        </div>
      </div>

      {/* Cierres hechos sin conexión: se muestran siempre, para que nadie crea
          que el trabajo se perdió. Cuando hay red se recargan del servidor. */}
      {pendientes.length > 0 && (
        <div style={{ marginBottom:16, display:"flex", flexDirection:"column", gap:10 }}>
          {pendientes.map((p) => (
            <div key={p.key}
              style={{ background:"rgba(249,115,22,0.08)", border:"1px solid rgba(249,115,22,0.30)", borderRadius:14, padding:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap" as const }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14, color:"#C2410C" }}>
                    Conteo guardado sin conexión
                  </div>
                  <div style={{ fontSize:12, color:"#7C2D12", marginTop:3 }}>
                    {p.locationName ? `${p.locationName} · ` : ""}{p.items.length} producto(s) · {fmtDate(new Date(p.timestamp).toISOString())}
                  </div>
                </div>
                <Badge label={online ? "Enviándose…" : "Esperando internet"} color="#F97316"/>
              </div>
              <div style={{ fontSize:12, color:"#7C2D12", marginTop:8 }}>
                El conteo está a salvo en este dispositivo. Los faltantes se calcularán cuando se envíe,
                porque dependen de las ventas reales del período.
              </div>
              {p.error && <div style={{ fontSize:12, color:"#B91C1C", marginTop:6 }}>Último intento: {p.error}</div>}
            </div>
          ))}
        </div>
      )}

      {loading ? <Spinner/> : closings.length === 0 ? (
        <div style={{ textAlign:"center" as const, padding:60, color:"var(--muted)" }}>
          <Icon name="cierre" size={40} color="var(--muted)"/>
          <p style={{ marginTop:12, fontSize:14 }}>
            {online ? "No hay cierres registrados aún" : "Sin conexión: no se pueden ver los cierres ya registrados"}
          </p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {closings.map((c: any) => {
            const hasShortage = c.items?.some((i: any) => i.shortage > 0.001);
            return (
              <div key={c.id} style={{ background:"var(--card)", borderRadius:14, padding:16, boxShadow:"0 1px 6px rgba(15,23,42,0.07)", border:"1px solid var(--line)", cursor:"pointer" }}
                onClick={() => { setDetailClosing(c); setView("detail"); }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap" as const, gap:8 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15, color:"var(--ink)" }}>Cierre — {fmtDate(c.createdAt)}</div>
                    <div style={{ fontSize:12, color:"var(--muted)", marginTop:3 }}>
                      Por {c.closedBy?.name || "—"} · {fmtDate(c.periodStart)} → {fmtDate(c.periodEnd)}
                    </div>
                    {locations.length > 1 && <div style={{ fontSize:12, color:"var(--brand)", marginTop:2, fontWeight:600 }}>{locationName(c.locationId)}</div>}
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    {hasShortage && <Badge label={<><Icon name="alert" size={12}/>Faltantes</>} color="#F97316"/>}
                    <Badge label={`${c.totalSales} ventas`} color="var(--brand)"/>
                  </div>
                </div>
                <div style={{ display:"flex", gap:24, marginTop:12, flexWrap:"wrap" as const }}>
                  {[{ l:"Total ingresos", v:`${fmt(c.totalIncome)} CUP`, c:"#10B981" },
                    { l:"Efectivo", v:`${fmt(c.incomeEfectivo)} CUP`, c:"var(--ink)" },
                    { l:"Transferencia", v:`${fmt(c.incomeTransferencia)} CUP`, c:"var(--ink)" }].map(s=>(
                    <div key={s.l}>
                      <div style={{ fontSize:11, color:"var(--muted)", fontWeight:600, textTransform:"uppercase" as const }}>{s.l}</div>
                      <div style={{ fontSize:15, fontWeight:800, color:s.c }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmReading && (
        <Modal title="Tomar lectura de inventario" onClose={() => setConfirmReading(false)} width={440}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {locations.length > 1 && (
              <Field label="Ubicación" required>
                <select style={sel} value={readingLocationId} onChange={e=>setReadingLocationId(e.target.value)}>
                  {locations.map((l:any)=><option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </Field>
            )}
            <div style={{ background:"rgba(249,115,22,0.08)", border:"1px solid rgba(249,115,22,0.30)", borderRadius:12, padding:14 }}>
              <div style={{ fontWeight:700, color:"#C2410C", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                <Icon name="alert" size={16} color="#C2410C"/>Antes de continuar
              </div>
              <ul style={{ margin:0, paddingLeft:18, fontSize:13, color:"#7C2D12", lineHeight:1.7 }}>
                <li>Registrará el stock actual de esa ubicación como punto de partida del próximo cierre.</li>
                <li>Si hay ventas sin cerrar desde la última lectura, <strong>quedarán fuera del período</strong>.</li>
                <li>Hazlo solo al abrir el negocio o al cambiar de turno.</li>
                <li>No se puede deshacer.</li>
              </ul>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button style={btn("secondary")} onClick={() => setConfirmReading(false)}>Cancelar</button>
              <button style={{ ...btn("primary"), opacity:saving?0.6:1 }} onClick={takeReading} disabled={saving}>
                {saving ? "Tomando lectura..." : "Tomar lectura"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );

  // ── Seleccionar lectura ─────────────────────────────────────────────────────
  if (view === "selectReading") return (
    <div style={{ maxWidth:600, margin:"0 auto" }}>
      <button style={{ ...btn("ghost"), marginBottom:16, paddingLeft:0 }} onClick={() => setView("list")}>← Volver</button>
      <h2 style={{ margin:"0 0 6px", fontSize:20, fontWeight:800, color:"var(--ink)" }}>Iniciar cierre</h2>
      <p style={{ margin:"0 0 20px", fontSize:13, color:"var(--muted)" }}>
        Elige desde cuándo contar las ventas. El stock registrado en esa fecha será el punto de partida.
      </p>
      {readings.length === 0 ? (
        <div style={{ background:"rgba(249,115,22,0.08)", border:"1px solid rgba(249,115,22,0.30)", borderRadius:12, padding:16 }}>
          <div style={{ fontWeight:700, color:"#C2410C", marginBottom:6 }}>No hay lecturas disponibles</div>
          <p style={{ margin:0, fontSize:13, color:"#7C2D12" }}>
            Para hacer el primer cierre el administrador debe tomar una lectura de apertura primero.
          </p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {readings.map((r: any, i: number) => {
            const isRec = i === 0;
            const typeLabel = r.type === "apertura" ? "Lectura de apertura" : "Lectura al cierre anterior";
            return (
              <div key={r.id}
                style={{ border:isRec?"2px solid var(--brand)":"1px solid var(--line)", borderRadius:14, padding:16, background:isRec?"var(--input-bg)":"var(--card)", cursor:saving?"not-allowed":"pointer", opacity:saving?0.6:1 }}
                onClick={() => !saving && selectReading(r)}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14, color:"var(--ink)" }}>{typeLabel}</div>
                    <div style={{ fontSize:12, color:"var(--muted)", marginTop:3 }}>{fmtDate(r.createdAt)}</div>
                    {locations.length > 1 && <div style={{ fontSize:12, color:"var(--brand)", marginTop:2, fontWeight:600 }}>{locationName(r.locationId)}</div>}
                    {r.takenBy && <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>Por {r.takenBy.name}</div>}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    {isRec && <Badge label="Recomendado" color="var(--brand)"/>}
                  </div>
                </div>
                {!isRec && (
                  <div style={{ marginTop:8, fontSize:11, color:"#F97316", fontWeight:600, display:"inline-flex", alignItems:"flex-start", gap:5 }}>
                    <Icon name="alert" size={13}/><span>Usar esta lectura excluirá las ventas entre esta fecha y la más reciente</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Validar stock ───────────────────────────────────────────────────────────
  if (view === "validate" && preview) {
    const sinConexion = !!preview.offline;
    // Sin conexión no hay "esperado" con qué comparar, así que no se resalta
    // ningún faltante: todavía no se sabe si falta nada.
    const itemsWithShortage = sinConexion ? [] : preview.items.filter((i: any) => (i.stockExpected - (validatedItems[i.productId] ?? i.stockValidated)) > 0.001);
    return (
      <div style={{ maxWidth:900, margin:"0 auto" }}>
        <button style={{ ...btn("ghost"), marginBottom:16, paddingLeft:0 }} onClick={() => setView("selectReading")}>← Cambiar lectura</button>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap" as const, gap:12, marginBottom:16 }}>
          <div>
            <h2 style={{ margin:"0 0 4px", fontSize:20, fontWeight:800, color:"var(--ink)" }}>Validar stock del período</h2>
            <p style={{ margin:0, fontSize:13, color:"var(--muted)" }}>
              Desde {fmtDate(preview.periodStart)}
              {sinConexion ? " · sin conexión" : ` · ${preview.totalSales} ventas · ${fmt(preview.totalIncome)} CUP`}
            </p>
          </div>
          <div style={{ display:"flex", gap:12, background:"var(--input-bg)", borderRadius:12, padding:"10px 16px" }}>
            {[{ l:"Efectivo", v:preview.incomeEfectivo },{ l:"Transferencia", v:preview.incomeTransferencia }].map(s=>(
              <div key={s.l} style={{ textAlign:"center" as const }}>
                <div style={{ fontSize:11, color:"var(--brand)", fontWeight:600 }}>{s.l}</div>
                <div style={{ fontSize:15, fontWeight:800, color:"var(--ink)" }}>{sinConexion ? "—" : `${fmt(s.v)} CUP`}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:"var(--input-bg)", border:"1px solid var(--line)", borderRadius:12, padding:12, marginBottom:16, fontSize:13, color:"var(--ink)" }}>
          <strong>Instrucción:</strong> Cuenta físicamente cada producto y escribe la cantidad.
          {sinConexion
            ? " Sin conexión solo se anota tu conteo; el faltante se calcula al enviarse, cuando el servidor tenga las ventas del período."
            : " La diferencia con el esperado quedará registrada como faltante."}
        </div>

        <div style={{ overflowX:"auto" as const, borderRadius:14, border:"1px solid var(--line)" }}>
          <table style={tbl}>
            <thead>
              <tr style={{ background:"var(--input-bg)" }}>
                {(sinConexion
                  ? ["Producto","Stk. inicial","Conteo físico"]
                  : ["Producto","Stk. inicial","Vendido","Esperado","Conteo físico","Faltante","Ingreso"]).map(h=>(
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.items.map((item: any) => {
                const validated = validatedItems[item.productId] ?? item.stockValidated;
                const shortage = parseFloat((item.stockExpected - validated).toFixed(3));
                const hasS = shortage > 0.001;
                return (
                  <tr key={item.productId}>
                    <td style={td(hasS)}><div style={{ fontWeight:600, color:"var(--ink)" }}>{item.productName}</div><div style={{ fontSize:11, color:"var(--muted)" }}>{item.productCode}</div></td>
                    <td style={td(hasS)}>{item.stockInitial} {item.unit}</td>
                    {!sinConexion && <td style={td(hasS)}>{item.stockSold} {item.unit}</td>}
                    {!sinConexion && <td style={{ ...td(hasS), fontWeight:600, color:"var(--ink)" }}>{item.stockExpected} {item.unit}</td>}
                    <td style={td(hasS)}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <input type="number" min={0} step="0.001" value={validated}
                          onChange={e => setValidatedItems(prev => ({ ...prev, [item.productId]: parseFloat(e.target.value)||0 }))}
                          style={{ ...inp, width:80, padding:"5px 8px", textAlign:"right" as const }}/>
                        <span style={{ fontSize:11, color:"var(--muted)" }}>{item.unit}</span>
                      </div>
                    </td>
                    {!sinConexion && <td style={{ ...td(hasS), fontWeight:700, color:hasS?"#F97316":"#10B981" }}>
                      {hasS ? `-${shortage} ${item.unit}` : "✓"}
                    </td>}
                    {!sinConexion && <td style={{ ...td(hasS), color:"#10B981", fontWeight:600 }}>{fmt(item.income)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {itemsWithShortage.length > 0 && (
          <div style={{ background:"rgba(249,115,22,0.08)", border:"1px solid rgba(249,115,22,0.30)", borderRadius:12, padding:12, marginTop:12, fontSize:13, color:"#C2410C", fontWeight:600, display:"inline-flex", alignItems:"flex-start", gap:6 }}>
            <Icon name="alert" size={14}/><span>Se registrarán faltantes en {itemsWithShortage.length} producto(s). Estos quedarán en el historial.</span>
          </div>
        )}

        <div style={{ marginTop:16 }}>
          <Field label="Observaciones (opcional)">
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notas sobre este cierre..."
              style={{ ...inp, minHeight:60, resize:"vertical" as const }}/>
          </Field>
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:16 }}>
          <button style={btn("secondary")} onClick={() => setView("selectReading")}>Cancelar</button>
          <button style={{ ...btn("primary"), opacity:saving?0.6:1 }} onClick={confirmClosing} disabled={saving}>
            {saving ? "Guardando..." : sinConexion ? "Guardar conteo en el móvil" : "Confirmar cierre"}
          </button>
        </div>
      </div>
    );
  }

  // ── Detalle ─────────────────────────────────────────────────────────────────
  if (view === "detail" && detailClosing) {
    const c = detailClosing;
    const hasShortage = c.items?.some((i: any) => i.shortage > 0.001);
    const provisional = c.status === "provisional";
    const hasta = c.provisionalUntil ? new Date(c.provisionalUntil) : null;
    const horasRestantes = hasta
      ? Math.max(0, Math.ceil((hasta.getTime() - Date.now()) / 3_600_000)) : null;
    return (
      <div style={{ maxWidth:900, margin:"0 auto" }}>
        <button style={{ ...btn("ghost"), marginBottom:16, paddingLeft:0 }} onClick={() => setView("list")}>← Volver a cierres</button>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap" as const, gap:12, marginBottom:20 }}>
          <div>
            <h2 style={{ margin:"0 0 4px", fontSize:20, fontWeight:800, color:"var(--ink)" }}>Detalle del cierre</h2>
            <p style={{ margin:0, fontSize:13, color:"var(--muted)" }}>{fmtDate(c.createdAt)} · Cerrado por {c.closedBy?.name || "—"}</p>
          </div>
          <button style={btn("secondary")} onClick={() => window.print()}><Icon name="print" size={15}/>Imprimir</button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:20 }}>
          {[{ l:"Total ingresos", v:`${fmt(c.totalIncome)} CUP`, color:"#10B981" },
            { l:"Efectivo", v:`${fmt(c.incomeEfectivo)} CUP`, color:"var(--ink)" },
            { l:"Transferencia", v:`${fmt(c.incomeTransferencia)} CUP`, color:"var(--ink)" },
            { l:"Ventas realizadas", v:String(c.totalSales), color:"var(--brand)" }].map(s=>(
            <div key={s.l} style={{ background:"var(--card)", borderRadius:12, padding:"12px 16px", border:"1px solid var(--line)", boxShadow:"0 1px 4px rgba(15,23,42,0.05)" }}>
              <div style={{ fontSize:11, color:"var(--muted)", fontWeight:600, textTransform:"uppercase" as const }}>{s.l}</div>
              <div style={{ fontSize:18, fontWeight:800, color:s.color, marginTop:4 }}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize:12, color:"var(--muted)", marginBottom:10 }}>
          Período: {fmtDate(c.periodStart)} → {fmtDate(c.periodEnd)}
          {c.notes && <span> · <em>{c.notes}</em></span>}
        </div>

        {/* ── El dinero ── */}
        {(c.countedCash && Object.keys(c.countedCash).length > 0) || (c.expectedCash && Object.keys(c.expectedCash).length > 0) ? (
          <div style={{ background:"var(--card)", border:"1px solid var(--line)", borderRadius:14, padding:"14px 16px", marginBottom:18 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, gap:10, flexWrap:"wrap" }}>
              <span style={{ fontSize:13, fontWeight:800, color:"var(--ink)" }}>Dinero en la caja</span>
              {c.status === "cerrado"   && <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:999, background:"rgba(5,150,105,0.12)", color:"#047857" }}>Cuadró</span>}
              {provisional               && <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:999, background:"rgba(217,119,6,0.14)", color:"#92400E" }}>Pendiente de explicación</span>}
              {c.status === "resuelto"  && <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:999, background:"rgba(5,150,105,0.12)", color:"#047857" }}>Explicado</span>}
            </div>
            {Object.keys({ ...(c.expectedCash || {}), ...(c.countedCash || {}) }).map((k) => {
              const e = c.expectedCash?.[k] || 0;
              const ct = c.countedCash?.[k] || 0;
              const d = Math.round((ct - e) * 100) / 100;
              return (
                <div key={k} style={{ display:"grid", gridTemplateColumns:"auto 1fr 1fr 1fr", gap:10, alignItems:"baseline", padding:"5px 0", borderBottom:"1px solid var(--line)", fontSize:13 }}>
                  <span style={{ fontWeight:700, color:"var(--ink)" }}>{k}</span>
                  <span style={{ color:"var(--muted)", textAlign:"right" as const }}>Debía: <strong style={{ color:"var(--ink)" }}>{fmt(e)}</strong></span>
                  <span style={{ color:"var(--muted)", textAlign:"right" as const }}>Contado: <strong style={{ color:"var(--ink)" }}>{fmt(ct)}</strong></span>
                  <span style={{ textAlign:"right" as const, fontWeight:800, color: Math.abs(d) > 0.005 ? (d < 0 ? "#B91C1C" : "#047857") : "var(--muted)" }}>
                    {Math.abs(d) > 0.005 ? (d < 0 ? `−${fmt(Math.abs(d))}` : `+${fmt(Math.abs(d))}`) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}

        {provisional && (
          <div style={{ background:"rgba(217,119,6,0.07)", border:"1px solid rgba(217,119,6,0.30)", borderRadius:14, padding:"14px 16px", marginBottom:18 }}>
            <div style={{ fontSize:13.5, fontWeight:800, color:"#92400E", marginBottom:3 }}>Este cierre no cuadró el dinero</div>
            <div style={{ fontSize:12.5, color:"#B45309", lineHeight:1.55, marginBottom:12 }}>
              Queda pendiente hasta que alguien explique el descuadre.
              {horasRestantes !== null && horasRestantes > 0
                ? ` Tienes ${horasRestantes} hora${horasRestantes === 1 ? "" : "s"} para hacerlo.`
                : " Ya se venció la ventana y se cerró con el descuadre tal cual."}
            </div>
            <ExplicarDescuadre
              closing={c}
              showToast={showToast}
              onResuelto={() => reloadDetail(c.id)}
            />
          </div>
        )}

        {hasShortage && (
          <div style={{ background:"rgba(249,115,22,0.08)", border:"1px solid rgba(249,115,22,0.30)", borderRadius:10, padding:10, marginBottom:12, fontSize:13, color:"#C2410C", fontWeight:600, display:"inline-flex", alignItems:"flex-start", gap:6 }}>
            <Icon name="alert" size={14}/><span>Este cierre registra faltantes de inventario</span>
          </div>
        )}

        <div style={{ overflowX:"auto" as const, borderRadius:14, border:"1px solid var(--line)" }}>
          <table style={tbl}>
            <thead>
              <tr style={{ background:"var(--input-bg)" }}>
                {["Producto","Stk. inicial","Vendido","Esperado","Conteo físico","Faltante","Ingreso"].map(h=>(
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(c.items||[]).map((item: any, idx: number) => {
                const hasS = item.shortage > 0.001;
                return (
                  <tr key={idx}>
                    <td style={td(hasS)}><div style={{ fontWeight:600, color:"var(--ink)" }}>{item.productName}</div><div style={{ fontSize:11, color:"var(--muted)" }}>{item.productCode}</div></td>
                    <td style={td(hasS)}>{item.stockInitial} {item.unit}</td>
                    <td style={td(hasS)}>{item.stockSold} {item.unit}</td>
                    <td style={{ ...td(hasS), fontWeight:600, color:"var(--ink)" }}>{item.stockExpected} {item.unit}</td>
                    <td style={td(hasS)}>{item.stockValidated} {item.unit}</td>
                    <td style={{ ...td(hasS), fontWeight:700, color:hasS?"#F97316":"#10B981" }}>
                      {hasS ? `-${item.shortage} ${item.unit}` : "✓"}
                    </td>
                    <td style={{ ...td(hasS), color:"#10B981", fontWeight:600 }}>{fmt(item.income)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return null;
};

export default CierreCaja;
