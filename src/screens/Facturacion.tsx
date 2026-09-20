import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { fmt, downloadCSV } from "@/lib/format";
import { useOnlineStatus } from "@/hooks/useOnline";
import { PAY_METHODS } from "@/config/constants";
import {
  getAllOfflineSales, updateSaleStatus, restoreLocalStock,
  type OfflineSale,
} from "@/offlineDB";
import Icon from "@/components/shared/Icon";
import { Modal, Badge, Field, Spinner, btn, inp, sel } from "@/components/shared/primitives";
import { showConfirm, showAlert } from "@/components/shared/dialogs";
import { CURRENCY_SYMBOLS } from "@/config/constants";

// Impresión: solo el recibo visible, con ancho de ticket.
const factStyles = `
@media print {
  body * { visibility: hidden !important; }
  .cg-receipt-print-area, .cg-receipt-print-area * { visibility: visible !important; }
  .cg-receipt-print-area {
    position: fixed !important; top: 0; left: 0; right: 0;
    width: 80mm !important; margin: 0 auto !important;
    background: #fff !important; color: #000 !important;
    border: none !important; box-shadow: none !important;
  }
}
`;

// ─── FACTURACIÓN (cajero + admin) ────────────────────────────────────────────
const Facturacion = ({ user, showToast, onSyncRefresh, onManualSync, syncing }: { user: any; showToast: (m:string,t:string)=>void; onSyncRefresh?: ()=>void; onManualSync?: ()=>void; syncing?: boolean }) => {
  const [sales, setSales]     = useState<any[]>([]);
  const [offlineSales, setOfflineSales] = useState<OfflineSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [viewInv, setViewInv] = useState<any>(null);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm]   = useState<any>({});
  const [saving, setSaving]   = useState(false);
  const [showOffline, setShowOffline] = useState(true);
  const facOnline = useOnlineStatus();

  const load = useCallback(async()=>{
    try {
      setLoading(true);
      // Cargar facturas offline siempre
      const offline = await getAllOfflineSales();
      setOfflineSales(offline);
      // Cargar del servidor si hay conexión
      if (facOnline) {
        const list = await apiFetch("/sales");
        setSales(list);
      }
    } catch(e:any) { showToast(e.message,"error"); }
    finally { setLoading(false); }
  },[facOnline]);
  useEffect(()=>{ load(); },[load]);

  const filtered = sales.filter(s=>
    (s.invoiceNumber||s.id||"").toLowerCase().includes(search.toLowerCase()) ||
    (s.clientName||s.client||"").toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (s:any) => {
    setEditForm({
      clientName: s.clientName || s.client || "",
      clientNit:  s.clientNit  || "",
      clientPhone:s.clientPhone|| "",
      payMethod:  s.payMethod  || "efectivo",
    });
    setEditModal(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await apiFetch(`/sales/${viewInv.id}`, { method:"PUT", body: editForm });
      showToast("Factura actualizada","success");
      setEditModal(false);
      load();
      setViewInv(null);
    } catch(e:any) { showToast(e.message,"error"); }
    finally { setSaving(false); }
  };

  const voidSale = async (id:string) => {
    if (!(await showConfirm("¿Anular esta factura? El stock se repondrá automáticamente."))) return;
    try {
      await apiFetch(`/sales/${id}/void`, { method:"POST" });
      showToast("Factura anulada. Stock repuesto.","warning");
      setViewInv(null);
      load();
    } catch(e:any) { showToast(e.message,"error"); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:800, color:"var(--ink)" }}>Facturas</h2>
          <p style={{ margin:0, fontSize:14, color:"var(--muted)" }}>
            {sales.filter(s=>s.status==="emitida").length} emitidas · ${fmt(sales.filter(s=>s.status==="emitida").reduce((a,s)=>a+Number(s.total),0))} CUP
            {offlineSales.filter(s=>s.status==="pending").length > 0 && <span style={{ marginLeft:8, background:"#F97316", color:"#ffffff", borderRadius:20, padding:"1px 8px", fontSize:11, fontWeight:700 }}>{offlineSales.filter(s=>s.status==="pending").length} offline</span>}
            {offlineSales.filter(s=>s.status==="conflict").length > 0 && <span style={{ marginLeft:4, background:"#3B82F6", color:"#ffffff", borderRadius:20, padding:"1px 8px", fontSize:11, fontWeight:700 }}>{offlineSales.filter(s=>s.status==="conflict").length} conflicto</span>}
          </p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={btn("secondary")} onClick={load}><Icon name="refresh" size={15}/>Actualizar</button>
          <button style={btn("secondary")} onClick={() => downloadCSV("ventas", sales.map((s:any) => ({ ...s, itemsCount: s.items?.length ?? "" })), [
            { key:"invoiceNumber", label:"Factura" },{ key:"date", label:"Fecha" },{ key:"clientName", label:"Cliente" },
            { key:"subtotal", label:"Subtotal" },{ key:"discountTotal", label:"Descuento" },{ key:"tax", label:"Impuesto" },
            { key:"total", label:"Total" },{ key:"currency", label:"Moneda" },{ key:"payMethod", label:"Método de pago" },
            { key:"status", label:"Estado" },{ key:"itemsCount", label:"Líneas" },
          ])}><Icon name="doc" size={15}/>CSV</button>
        </div>
      </div>

      {/* Ventas offline pendientes */}
      {offlineSales.filter(s=>s.status==="pending"||s.status==="conflict").length > 0 && (
        <div style={{ background:"rgba(249,115,22,0.08)", border:"1px solid rgba(249,115,22,0.30)", borderRadius:16, padding:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:"#C2410C" }}>⚡ Ventas offline</h3>
            <div style={{ display:"flex", gap:8 }}>
              <button style={{ ...btn("secondary"), fontSize:12, padding:"4px 10px", opacity: syncing?0.7:1 }} disabled={syncing} onClick={onManualSync}>
                {syncing ? "Sincronizando..." : "🔄 Sincronizar ahora"}
              </button>
              <button style={{ ...btn("ghost"), fontSize:12, padding:"4px 10px" }} onClick={()=>setShowOffline(v=>!v)}>{showOffline?"Ocultar":"Mostrar"}</button>
            </div>
          </div>
          {showOffline && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {offlineSales.filter(s=>s.status==="pending"||s.status==="conflict").map(s=>(
                <div key={s.localId} style={{ background:"var(--card)", borderRadius:12, padding:"12px 14px", border:`1px solid ${s.status==="conflict"?"rgba(220,38,38,0.35)":"rgba(249,115,22,0.35)"}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                    <div>
                      <span style={{ fontWeight:700, fontSize:13, fontFamily:"monospace", color:"#3B82F6" }}>{s.localId}</span>
                      <span style={{ fontSize:11, color:"var(--muted)", marginLeft:8 }}>{new Date(s.timestamp).toLocaleString("es-CU")}</span>
                    </div>
                    <Badge label={s.status==="conflict"?"Conflicto":"Pendiente"} color={s.status==="conflict"?"#3B82F6":"#F97316"}/>
                  </div>
                  <div style={{ fontSize:12, color:"var(--ink)", marginBottom:4 }}>
                    {s.client} · <strong>${fmt(s.total)}</strong> · {s.items.map((i:any)=>`${i.qty}x ${i.name}`).join(", ")}
                  </div>
                  {s.status==="conflict" && (
                    <div style={{ fontSize:11, color:"#3B82F6", marginBottom:8 }}>⚠ {s.conflictReason}</div>
                  )}
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" as any, marginTop:6 }}>
                    {s.status==="conflict" && (
                      <button style={{ ...btn("primary"), fontSize:11, padding:"5px 10px" }}
                        onClick={async()=>{
                          // Reintentar manualmente
                          const { updateSaleStatus: upd } = await import("@/offlineDB");
                          await upd(s.localId, "pending");
                          load();
                          if(onSyncRefresh) onSyncRefresh();
                        }}>
                        ↺ Reintentar
                      </button>
                    )}
                    <button style={{ ...btn("danger"), fontSize:11, padding:"5px 10px" }}
                      onClick={async()=>{
                        if(!(await showConfirm(`¿Descartar la venta ${s.localId}? El stock local ya fue restaurado.`))) return;
                        const { updateSaleStatus: upd, restoreLocalStock: rls } = await import("@/offlineDB");
                        if(s.status==="pending") await rls(s.items);
                        await upd(s.localId, "synced"); // marcar como procesada para ocultarla
                        load();
                        if(onSyncRefresh) onSyncRefresh();
                      }}>
                      🗑 Descartar
                    </button>
                    <button style={{ ...btn("secondary"), fontSize:11, padding:"5px 10px" }}
                      onClick={()=>{
                        const lines = ["Venta: " + s.localId, "Cliente: " + s.client, "Total: $" + fmt(s.total), "Productos:"];
                        s.items.forEach((i:any) => lines.push("  - " + i.qty + "x " + i.name + " @ $" + fmt(i.price)));
                        if (s.conflictReason) lines.push("", "Error: " + s.conflictReason);
                        showAlert(lines.join("\n"));
                      }}>
                      👁 Ver detalle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ position:"relative" as any }}>
        <span style={{ position:"absolute" as any, left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" as any }}><Icon name="search" size={15} color="var(--muted)"/></span>
        <input style={{ ...inp, paddingLeft:34 }} placeholder="Buscar por No. factura o cliente..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {loading ? <Spinner/> : (
        <div style={{ background:"var(--card)", borderRadius:16, border:"1px solid var(--line)", overflowX:"auto", WebkitOverflowScrolling:"touch" as any }}>
          <table style={{ width:"100%", minWidth:700, borderCollapse:"collapse" }}>
            <thead><tr style={{ background:"var(--input-bg)" }}>
              {["No. Factura","Fecha","Cliente","Total","Método","Estado",""].map(h=>(
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase" as any, whiteSpace:"nowrap" as any }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(s=>(
                <tr key={s.id} style={{ borderTop:"1px solid var(--line)", opacity:s.status==="anulada"?0.5:1 }}>
                  <td style={{ padding:"11px 14px", fontSize:12, fontWeight:700, color:"#3B82F6", fontFamily:"monospace" }}>{s.invoiceNumber||s.id}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, color:"var(--ink)" }}>{(s.date||s.createdAt||"").split("T")[0]}</td>
                  <td style={{ padding:"11px 14px", fontSize:13 }}>{s.clientName||s.client}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, fontWeight:700 }}>${fmt(s.total)}</td>
                  <td style={{ padding:"11px 14px" }}><Badge label={PAY_METHODS.find(p=>p.id===s.payMethod)?.label||s.payMethod} color="#3B82F6"/></td>
                  <td style={{ padding:"11px 14px" }}><Badge label={s.status==="emitida"?"Emitida":"Anulada"} color={s.status==="emitida"?"#10B981":"#3B82F6"}/></td>
                  <td style={{ padding:"11px 14px" }}>
                    <button style={{ ...btn("ghost"), padding:"5px 10px", fontSize:12 }} onClick={()=>setViewInv(s)}>
                      <Icon name="eye" size={14}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length===0 && <div style={{ padding:40, textAlign:"center", color:"var(--muted)" }}>No hay facturas</div>}
        </div>
      )}

      {viewInv && (
        <Modal title={`Factura ${viewInv.invoiceNumber||viewInv.id}`} onClose={()=>setViewInv(null)} width={520}>
          <style>{factStyles}</style>
          <div className="cg-receipt-print-area" style={{ fontFamily:"monospace", fontSize:12, lineHeight:1.9, background:"var(--input-bg)", padding:20, borderRadius:12, border:"1px solid var(--line)" }}>
            <div style={{ textAlign:"center", marginBottom:14 }}>
              <div style={{ fontWeight:800, fontSize:15, color:"var(--ink)" }}>{user?.company?.name || "Mi Negocio"}</div>
              <div>FACTURA No. <strong style={{ color:"#3B82F6" }}>{viewInv.invoiceNumber||viewInv.id}</strong></div>
              {viewInv.status==="anulada" && <div style={{ color:"#DC2626", fontWeight:800 }}>⚠ ANULADA</div>}
            </div>
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"8px 0" }}/>
            <div>Fecha: {(viewInv.date||viewInv.createdAt||"").split("T")[0]}</div>
            <div>Cliente: {viewInv.clientName||viewInv.client}</div>
            {(viewInv.clientNit && viewInv.clientNit !== "00000000000") && <div>Carnet: {viewInv.clientNit}</div>}
            {viewInv.clientPhone && <div>Teléfono: {viewInv.clientPhone}</div>}
            <div>Método: {PAY_METHODS.find(p=>p.id===viewInv.payMethod)?.label||viewInv.payMethod}</div>
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"8px 0" }}/>
            {(viewInv.items||viewInv.SaleItems||[]).map((item:any,i:number)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between" }}>
                <span>{item.qty}x {item.name}</span>
                <span>{CURRENCY_SYMBOLS[viewInv.currency]||"$"}{fmt(item.total||item.price*item.qty)}</span>
              </div>
            ))}
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"8px 0" }}/>
            <div style={{ display:"flex", justifyContent:"space-between", fontWeight:800, fontSize:14 }}><span>TOTAL:</span><span>{CURRENCY_SYMBOLS[viewInv.currency]||"$"}{fmt(viewInv.total)} {viewInv.currency||"CUP"}</span></div>
            <div style={{ textAlign:"center", fontSize:8, color:"var(--muted)", marginTop:10 }}>Hecho con CubaGest</div>
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:16, flexWrap:"wrap" as any }}>
            {viewInv.status==="emitida" && (
              <>
                <button style={btn("danger")} onClick={()=>voidSale(viewInv.id)}>Anular</button>
                <button style={btn("secondary")} onClick={()=>openEdit(viewInv)}><Icon name="edit" size={14}/>Editar datos</button>
              </>
            )}
            <button style={btn("secondary")} onClick={()=>setViewInv(null)}>Cerrar</button>
            <button style={btn("primary")} onClick={()=>window.print()}><Icon name="print" size={15}/>Imprimir</button>
          </div>
        </Modal>
      )}

      {editModal && viewInv && (
        <Modal title="Editar datos de factura" onClose={()=>setEditModal(false)} width={440}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ background:"rgba(249,115,22,0.08)", border:"1px solid rgba(249,115,22,0.30)", borderRadius:12, padding:12, fontSize:12, color:"#C2410C" }}>
              ⚠ Solo se pueden editar los datos del cliente y método de pago. Los productos y totales no cambian.
            </div>
            <Field label="Nombre del cliente"><input style={inp} value={editForm.clientName} onChange={e=>setEditForm((f:any)=>({...f,clientName:e.target.value}))}/></Field>
            <Field label="Carnet"><input style={inp} value={editForm.clientNit} onChange={e=>setEditForm((f:any)=>({...f,clientNit:e.target.value}))} maxLength={11}/></Field>
            <Field label="Teléfono"><input style={inp} value={editForm.clientPhone} onChange={e=>setEditForm((f:any)=>({...f,clientPhone:e.target.value}))}/></Field>
            <Field label="Método de pago">
              <select style={sel} value={editForm.payMethod} onChange={e=>setEditForm((f:any)=>({...f,payMethod:e.target.value}))}>
                {PAY_METHODS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Field>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button style={btn("secondary")} onClick={()=>setEditModal(false)}>Cancelar</button>
              <button style={{ ...btn("primary"), opacity:saving?0.6:1 }} onClick={saveEdit} disabled={saving}>{saving?"Guardando...":"Guardar"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Facturacion;
