import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import Icon from "@/components/shared/Icon";
import { Modal, Badge, Field, Spinner, btn, inp, sel } from "@/components/shared/primitives";
import { showConfirm } from "@/components/shared/dialogs";

// ─── TRANSFERENCIAS (envíos entre ubicaciones) ────────────────────────────────
const Transferencias = ({ user, showToast }: { user: any; showToast: (m:string,t:string)=>void }) => {
  const [allLocations, setAllLocations] = useState<any[]>([]);
  const [myLocation, setMyLocation] = useState<any>(null);
  const [myProducts, setMyProducts] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [tab, setTab] = useState<"pendientes"|"todos">("pendientes");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null|"new"|"reject">(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [form, setForm] = useState<{ fromLocationId: string; toLocationId: string; items: {productId:string;qty:number}[]; notes: string }>({ fromLocationId:"", toLocationId:"", items:[], notes:"" });
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const isAdmin = user.role === "admin";

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [locs, trs] = await Promise.all([apiFetch("/locations"), apiFetch("/transfers")]);
      setAllLocations(locs);
      const own = isAdmin ? null
        : user.role === "almacenista" ? locs.find((l:any)=>l.type==="almacen")
        : locs.find((l:any)=>l.ownerUserId===user.id);
      setMyLocation(own || null);
      setTransfers(trs);
    } catch (e:any) { showToast(e.message, "error"); }
    finally { setLoading(false); }
  }, [isAdmin, user.role, user.id]);

  useEffect(() => { load(); }, [load]);

  const pending = transfers.filter(t => t.status === "pendiente");
  const visible = tab === "pendientes" ? pending : transfers;
  const locationName = (id:string) => allLocations.find((l:any)=>l.id===id)?.name || "—";
  const canResolve = (t:any) => t.toLocationId === myLocation?.id;
  const canCancel = (t:any) => t.status === "pendiente" && (isAdmin || t.requestedById === user.id) && !canResolve(t);

  const loadProductsFor = async (locationId: string) => {
    if (!locationId) { setMyProducts([]); return; }
    const { items } = await apiFetch(`/locations/${locationId}/stock`);
    setMyProducts(items.filter((p:any)=>p.active));
  };

  const openNew = async () => {
    setProductSearch("");
    if (isAdmin) {
      setMyProducts([]);
      setForm({ fromLocationId:"", toLocationId:"", items:[], notes:"" });
      setModal("new");
      return;
    }
    if (!myLocation) { showToast("No tienes una ubicación propia asignada", "warning"); return; }
    try {
      await loadProductsFor(myLocation.id);
      setForm({ fromLocationId: myLocation.id, toLocationId:"", items:[], notes:"" });
      setModal("new");
    } catch (e:any) { showToast(e.message, "error"); }
  };

  const setItemQty = (productId: string, qty: number, max: number) => {
    const clamped = Math.max(0, Math.min(qty, max));
    setForm(f => {
      const exists = f.items.find(i=>i.productId===productId);
      if (clamped <= 0) return { ...f, items: f.items.filter(i=>i.productId!==productId) };
      if (exists) return { ...f, items: f.items.map(i=>i.productId===productId?{...i,qty:clamped}:i) };
      return { ...f, items: [...f.items, { productId, qty: clamped }] };
    });
  };

  const submitTransfer = async () => {
    if (isAdmin && !form.fromLocationId) return showToast("Selecciona el origen", "error");
    if (!form.toLocationId) return showToast("Selecciona el destino", "error");
    if (form.items.length === 0) return showToast("Agrega al menos un producto", "error");
    setSaving(true);
    try {
      await apiFetch("/transfers", { method:"POST", body: {
        fromLocationId: isAdmin ? form.fromLocationId : undefined,
        toLocationId: form.toLocationId, items: form.items, notes: form.notes || undefined,
      }});
      showToast("Envío creado — queda pendiente de aprobación del destino", "success");
      setModal(null);
      load();
    } catch (e:any) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const approve = async (id: string) => {
    try {
      await apiFetch(`/transfers/${id}/approve`, { method:"POST" });
      showToast("Envío aprobado — stock actualizado", "success");
      load();
    } catch (e:any) { showToast(e.message, "error"); }
  };

  const openReject = (t:any) => { setRejectTarget(t); setRejectReason(""); setModal("reject"); };
  const confirmReject = async () => {
    try {
      await apiFetch(`/transfers/${rejectTarget.id}/reject`, { method:"POST", body:{ reason: rejectReason || undefined } });
      showToast("Envío rechazado", "info");
      setModal(null);
      load();
    } catch (e:any) { showToast(e.message, "error"); }
  };

  const cancelTransfer = async (id: string) => {
    if (!(await showConfirm("¿Cancelar este envío pendiente?"))) return;
    try {
      await apiFetch(`/transfers/${id}/cancel`, { method:"POST" });
      showToast("Envío cancelado", "info");
      load();
    } catch (e:any) { showToast(e.message, "error"); }
  };

  const filteredMyProducts = myProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:800, color:"var(--ink)" }}>Envíos entre ubicaciones</h2>
          <p style={{ margin:0, fontSize:14, color:"var(--muted)" }}>
            {myLocation ? `Tu ubicación: ${myLocation.name}` : isAdmin ? "Vista de administrador — todas las ubicaciones" : ""}
          </p>
        </div>
        <button style={btn("primary")} onClick={openNew}><Icon name="plus" size={16}/>Nuevo envío</button>
      </div>

      <div style={{ display:"flex", gap:8 }}>
        {([["pendientes",`Pendientes (${pending.length})`],["todos","Historial"]] as const).map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} style={{ ...btn(tab===v?"primary":"secondary"), fontSize:13 }}>{l}</button>
        ))}
      </div>

      {loading ? <Spinner/> : visible.length === 0 ? (
        <div style={{ textAlign:"center", padding:40, color:"var(--muted)", fontSize:14, background:"var(--card)", borderRadius:16, border:"1px solid var(--line)" }}>
          {tab === "pendientes" ? "No hay envíos pendientes" : "No hay envíos registrados todavía"}
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {visible.map((t:any) => {
            const statusColor = t.status==="pendiente" ? "#F97316" : t.status==="aprobado" ? "#10B981" : t.status==="rechazado" ? "#DC2626" : "#94A3B8";
            return (
              <div key={t.id} style={{ background:"var(--card)", borderRadius:16, border:"1px solid var(--line)", padding:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8 }}>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" as any }}>
                      <span style={{ fontWeight:700, fontSize:14, color:"var(--ink)" }}>{locationName(t.fromLocationId)}</span>
                      <Icon name="transferencias" size={14} color="var(--muted)"/>
                      <span style={{ fontWeight:700, fontSize:14, color:"var(--ink)" }}>{locationName(t.toLocationId)}</span>
                    </div>
                    <p style={{ margin:0, fontSize:12, color:"var(--muted)" }}>{new Date(t.createdAt).toLocaleString("es-CU")}</p>
                    {t.notes && <p style={{ margin:"4px 0 0", fontSize:12, color:"var(--ink)", fontStyle:"italic" as any }}>"{t.notes}"</p>}
                  </div>
                  <Badge label={t.status} color={statusColor}/>
                </div>
                <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:2 }}>
                  {t.items.map((i:any)=>(
                    <div key={i.id} style={{ fontSize:12, color:"var(--ink)" }}>{i.qty} {i.unit} · {i.productName}</div>
                  ))}
                </div>
                {t.status === "rechazado" && t.rejectReason && (
                  <p style={{ margin:"8px 0 0", fontSize:12, color:"#DC2626" }}>Motivo: {t.rejectReason}</p>
                )}
                {t.status === "pendiente" && (
                  <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" as any }}>
                    {canResolve(t) && <button style={{ ...btn("primary"), fontSize:12, padding:"6px 12px", background:"#10B981" }} onClick={()=>approve(t.id)}><Icon name="check" size={13}/>Aprobar</button>}
                    {canResolve(t) && <button style={{ ...btn("danger"), fontSize:12, padding:"6px 12px" }} onClick={()=>openReject(t)}>Rechazar</button>}
                    {canCancel(t) && <button style={{ ...btn("secondary"), fontSize:12, padding:"6px 12px" }} onClick={()=>cancelTransfer(t.id)}>Cancelar</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal === "new" && (
        <Modal title="Nuevo envío" onClose={()=>setModal(null)} width={520}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {isAdmin && (
              <Field label="Desde" required>
                <select style={sel} value={form.fromLocationId} onChange={async e=>{
                  const from = e.target.value;
                  setForm((f:any)=>({ ...f, fromLocationId: from, items: [] }));
                  await loadProductsFor(from);
                }}>
                  <option value="">Selecciona...</option>
                  {allLocations.map((l:any)=><option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Hacia" required>
              <select style={sel} value={form.toLocationId} onChange={e=>setForm((f:any)=>({...f,toLocationId:e.target.value}))}>
                <option value="">Selecciona...</option>
                {allLocations.filter((l:any)=>l.id!==form.fromLocationId).map((l:any)=><option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="Productos a enviar" required>
              <input style={{...inp, marginBottom:8}} placeholder="Buscar producto..." value={productSearch} onChange={e=>setProductSearch(e.target.value)}/>
              <div style={{ maxHeight:220, overflowY:"auto", border:"1px solid var(--line)", borderRadius:12 }}>
                {filteredMyProducts.map((p:any)=>{
                  const item = form.items.find(i=>i.productId===p.id);
                  return (
                    <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderBottom:"1px solid var(--line)" }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:"var(--ink)" }}>{p.name}</div>
                        <div style={{ fontSize:11, color:"var(--muted)" }}>Disponible: {p.stock} {p.unit}</div>
                      </div>
                      <input type="number" min={0} max={p.stock} style={{ ...inp, width:70, padding:"5px 8px", fontSize:12 }}
                        value={item?.qty ?? ""} onChange={e=>setItemQty(p.id, Number(e.target.value)||0, p.stock)}/>
                    </div>
                  );
                })}
                {filteredMyProducts.length===0 && <div style={{ padding:20, textAlign:"center", fontSize:12, color:"var(--muted)" }}>{form.fromLocationId || !isAdmin ? "No hay productos disponibles en el origen" : "Selecciona primero el origen"}</div>}
              </div>
            </Field>
            <Field label="Nota (opcional)"><input style={inp} value={form.notes} onChange={e=>setForm((f:any)=>({...f,notes:e.target.value}))}/></Field>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button style={btn("secondary")} onClick={()=>setModal(null)}>Cancelar</button>
              <button style={{ ...btn("primary"), opacity:saving?0.6:1 }} onClick={submitTransfer} disabled={saving}>{saving?"Enviando...":"Crear envío"}</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "reject" && rejectTarget && (
        <Modal title="Rechazar envío" onClose={()=>setModal(null)} width={420}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <p style={{ margin:0, fontSize:13, color:"var(--muted)" }}>El stock nunca salió del origen — no hace falta revertir nada, solo se marcará como rechazado.</p>
            <Field label="Motivo (opcional)"><input style={inp} value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Ej: cantidad incorrecta"/></Field>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button style={btn("secondary")} onClick={()=>setModal(null)}>Cancelar</button>
              <button style={btn("danger")} onClick={confirmReject}>Rechazar envío</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Transferencias;
