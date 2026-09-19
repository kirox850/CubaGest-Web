import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { fmt } from "@/lib/format";
import { downloadCSV } from "@/lib/format";
import { useOnlineStatus } from "@/hooks/useOnline";
import { CATEGORIES, UNITS } from "@/config/constants";
import { cacheProducts, getOfflineProducts } from "@/offlineDB";
import Icon from "@/components/shared/Icon";
import { Modal, Badge, Field, Spinner, btn, inp, sel } from "@/components/shared/primitives";
import { showConfirm } from "@/components/shared/dialogs";

// ─── INVENTARIO ───────────────────────────────────────────────────────────────
const Inventario = ({ user, showToast }: { user: any; showToast: (m: string, t: string) => void }) => {
  const [locations, setLocations] = useState<any[]>([]);
  const [locationId, setLocationId] = useState<string>("");
  const [locationInfo, setLocationInfo] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filterCat, setFilterCat] = useState("Todas");
  const [modal, setModal]       = useState<null|"add"|"edit"|"adjust">(null);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm]         = useState<any>({});
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustType, setAdjustType] = useState("entrada");
  const [saving, setSaving]     = useState(false);

  const canManage = ["admin","almacenista"].includes(user.role);
  const isAlmacen = locationInfo?.type === "almacen";
  const [availCurrencies, setAvailCurrencies] = useState<string[]>(["CUP"]);
  useEffect(() => {
    apiFetch("/settings").then((s:any)=>{ if (s?.currencies?.length) setAvailCurrencies(s.currencies); }).catch(()=>{});
  }, []);

  const invOnline = useOnlineStatus();

  const loadLocations = useCallback(async () => {
    try {
      const list = await apiFetch("/locations");
      // /locations devuelve TODAS las ubicaciones de la empresa (hace falta
      // para elegir destino en Envíos) — acá solo nos interesan las que
      // este rol puede realmente ver el stock.
      const accessible = user.role === "admin" ? list
        : user.role === "almacenista" ? list.filter((l:any)=>l.type==="almacen")
        : list.filter((l:any)=>l.ownerUserId===user.id);
      setLocations(accessible);
      // Por defecto mostramos el Almacén Central si está disponible (es donde
      // se crean los productos nuevos); si no, la primera ubicación visible.
      const almacen = accessible.find((l: any) => l.type === "almacen");
      setLocationId(prev => prev || almacen?.id || accessible[0]?.id || "");
    } catch (e: any) { showToast(e.message, "error"); }
  }, [user.role, user.id]);

  useEffect(() => { loadLocations(); }, [loadLocations]);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      setLoading(true);
      if (invOnline) {
        const { location, items } = await apiFetch(`/locations/${locationId}/stock`);
        setLocationInfo(location);
        await cacheProducts(items);
        setProducts(items);
      } else {
        const cached = await getOfflineProducts();
        setProducts(cached as any[]);
        showToast("Mostrando inventario offline","info");
      }
    } catch(e:any) {
      const cached = await getOfflineProducts();
      if (cached.length > 0) {
        setProducts(cached as any[]);
        showToast("Sin conexión — inventario cacheado","warning");
      } else {
        showToast(e.message,"error");
      }
    } finally { setLoading(false); }
  }, [invOnline, locationId]);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter(p =>
    (filterCat==="Todas" || p.category===filterCat) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()) || String(p.barcode||"").toLowerCase().includes(search.toLowerCase()))
  );
  const cats = ["Todas", ...Array.from(new Set(products.map(p=>p.category).filter(Boolean)))];

  const openAdd  = () => { setForm({ code:`P${String(products.length+1).padStart(3,"0")}`, barcode:"", currency:"CUP", name:"", category:"Alimentos", unit:"ud", price:"", cost:"", stock:"", minStock:"10" }); setModal("add"); };
  const openEdit = (p:any) => { setForm({...p, price:String(p.price), cost:String(p.cost||""), stock:String(p.stock), minStock:String(p.minStock||"")}); setSelected(p); setModal("edit"); };
  const openAdjust = (p:any) => { setSelected(p); setAdjustQty(""); setAdjustType("entrada"); setModal("adjust"); };

  const saveProduct = async () => {
    if (!form.name||!form.price) return showToast("Complete los campos requeridos","error");
    setSaving(true);
    try {
      const payload = { code:form.code, barcode:(form.barcode||"").trim() || undefined, currency: form.currency || "CUP", name:form.name, category:form.category, unit:form.unit, price:Number(form.price), cost:Number(form.cost)||0, stock:Number(form.stock)||0, minStock:Number(form.minStock)||0 };
      if (modal==="add") {
        await apiFetch("/products", { method:"POST", body:payload });
        showToast("Producto creado en Almacén Central","success");
      } else {
        await apiFetch(`/products/${selected.id}`, { method:"PUT", body:payload });
        showToast("Producto actualizado","success");
      }
      setModal(null);
      load();
    } catch(e:any) { showToast(e.message,"error"); }
    finally { setSaving(false); }
  };

  const saveAdjust = async () => {
    const qty = Number(adjustQty);
    if (!qty||qty<=0) return showToast("Ingrese una cantidad válida","error");
    setSaving(true);
    try {
      await apiFetch(`/locations/${locationId}/adjust`, { method:"POST", body:{ productId:selected.id, type:adjustType, qty, reason:"Ajuste manual desde web" }});
      showToast(`Ajuste de stock registrado (${adjustType})`, "success");
      setModal(null);
      load();
    } catch(e:any) { showToast(e.message,"error"); }
    finally { setSaving(false); }
  };

  const reactivateProduct = async (id: string) => {
    try {
      await apiFetch(`/products/${id}`, { method:"PUT", body:{ active: true } });
      showToast("Producto reactivado","success");
      load();
    } catch(e:any) { showToast(e.message,"error"); }
  };

  const deleteProduct = async (id: string) => {
    if (!(await showConfirm("¿Desactivar este producto? No se eliminará, solo se ocultará."))) return;
    try {
      await apiFetch(`/products/${id}`, { method:"DELETE" });
      showToast("Producto desactivado","info");
      load();
    } catch(e:any) { showToast(e.message,"error"); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:800, color:"var(--ink)" }}>Inventario</h2>
          <p style={{ margin:0, fontSize:14, color:"var(--muted)" }}>
            {products.filter((p:any)=>p.active!==false).length} productos
            {!invOnline && <span style={{ marginLeft:8, background:"#F97316", color:"#ffffff", borderRadius:20, padding:"1px 8px", fontSize:11, fontWeight:700 }}>OFFLINE</span>}
          </p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={btn("secondary")} onClick={load}><Icon name="refresh" size={15}/>Actualizar</button>
          <button style={btn("secondary")} onClick={() => downloadCSV("inventario", products, [
            { key:"code", label:"Código" },{ key:"name", label:"Producto" },{ key:"category", label:"Categoría" },
            { key:"unit", label:"Unidad" },{ key:"price", label:"Precio" },{ key:"cost", label:"Costo" },
            { key:"stock", label:"Stock" },{ key:"minStock", label:"Mínimo" },{ key:"active", label:"Activo" },
          ])}><Icon name="doc" size={15}/>CSV</button>
          {canManage && isAlmacen && invOnline && <button style={btn("primary")} onClick={openAdd}><Icon name="plus" size={16}/>Nuevo Producto</button>}
          {canManage && !invOnline && <span style={{ fontSize:12, color:"#F97316", padding:"8px 0" }}>Edición requiere conexión</span>}
        </div>
      </div>

      {locations.length > 1 && (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {locations.map((l:any) => (
            <button key={l.id} onClick={()=>setLocationId(l.id)}
              style={{ ...btn(locationId===l.id?"primary":"secondary"), fontSize:13, padding:"7px 14px" }}>
              <Icon name={l.type==="almacen"?"warehouse":"pos"} size={14}/>{l.name}
            </button>
          ))}
        </div>
      )}
      {locationInfo && locationInfo.type === "caja" && (
        <div style={{ background:"var(--input-bg)", border:"1px solid var(--line)", borderRadius:12, padding:"10px 14px", fontSize:13, color:"var(--ink)" }}>
          Este es el inventario propio de <strong>{locationInfo.name}</strong> — independiente del Almacén Central y de las demás cajas. Para agregar productos nuevos aquí, pide un envío desde "Envíos".
        </div>
      )}

      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        <div style={{ position:"relative", flex:1, minWidth:200 }}>
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}><Icon name="search" size={15} color="var(--muted)"/></span>
          <input style={{ ...inp, paddingLeft:34 }} placeholder="Buscar por nombre, código o código de barras..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select style={{ ...sel, width:"auto" }} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
          {cats.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>

      {loading ? <Spinner/> : (
        <div style={{ background:"var(--card)", borderRadius:16, border:"1px solid var(--line)", overflowX:"auto", WebkitOverflowScrolling:"touch" as any }}>
          <table style={{ width:"100%", minWidth:700, borderCollapse:"collapse" }}>
            <thead><tr style={{ background:"var(--input-bg)" }}>
              {["Código","Producto","Categoría","Precio","Costo","Stock aquí","Estado","Acciones"].map(h=>(
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.5px", whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(p=>(
                <tr key={p.id} style={{ borderTop:"1px solid var(--line)", opacity:p.active?1:0.5 }}>
                  <td style={{ padding:"11px 14px", fontSize:12, fontWeight:600, color:"var(--muted)", fontFamily:"monospace" }}>{p.code}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, fontWeight:600, color:"var(--ink)" }}>{p.name} <span style={{ fontSize:11, color:"var(--muted)", fontWeight:400 }}>/{p.unit}</span></td>
                  <td style={{ padding:"11px 14px" }}><Badge label={p.category||"—"} color="#5a3a1a"/></td>
                  <td style={{ padding:"11px 14px", fontSize:13, fontWeight:700 }}>{p.currency==="EUR"?"€":"$"}{fmt(p.price)} <span style={{ fontWeight:400, color:"var(--muted)", fontSize:11 }}>{p.currency||"CUP"}</span></td>
                  <td style={{ padding:"11px 14px", fontSize:13, color:"var(--ink)" }}>${fmt(p.cost)}</td>
                  <td style={{ padding:"11px 14px" }}>
                    <span style={{ fontWeight:700, color:p.stock<=p.minStock?"#F97316":"#10B981", fontSize:14 }}>{p.stock}</span>
                    {p.stock<=p.minStock && <span style={{ marginLeft:6, fontSize:10, color:"#F97316" }}>⚠ BAJO</span>}
                  </td>
                  <td style={{ padding:"11px 14px" }}><Badge label={p.active?"Activo":"Inactivo"} color={p.active?"#10B981":"#888"}/></td>
                  <td style={{ padding:"11px 14px" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      {canManage && <button style={{ ...btn("ghost"), padding:"5px 9px", fontSize:12 }} onClick={()=>openAdjust(p)} title="Ajustar stock en esta ubicación">±</button>}
                      {canManage && isAlmacen && <button style={{ ...btn("ghost"), padding:"5px 9px" }} onClick={()=>openEdit(p)}><Icon name="edit" size={14}/></button>}
                      {canManage && isAlmacen && p.active && <button style={{ ...btn("danger"), padding:"5px 9px" }} onClick={()=>deleteProduct(p.id)}><Icon name="trash" size={14}/></button>}
                      {canManage && isAlmacen && !p.active && <button style={{ ...btn("secondary"), padding:"5px 9px", fontSize:11 }} onClick={()=>reactivateProduct(p.id)}>Activar</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length===0 && <div style={{ padding:40, textAlign:"center", color:"var(--muted)", fontSize:14 }}>No se encontraron productos</div>}
        </div>
      )}

      {(modal==="add"||modal==="edit") && (
        <Modal title={modal==="add"?"Nuevo Producto":"Editar Producto"} onClose={()=>setModal(null)}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <Field label="Código" required><input style={inp} value={form.code||""} onChange={e=>setForm((f:any)=>({...f,code:e.target.value}))} disabled={modal==="edit"}/></Field>
            <Field label="Categoría" required>
              <select style={sel} value={form.category||""} onChange={e=>setForm((f:any)=>({...f,category:e.target.value}))}>
                {CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </Field>
            <div style={{ gridColumn:"1/-1" }}><Field label="Nombre del Producto" required><input style={inp} value={form.name||""} onChange={e=>setForm((f:any)=>({...f,name:e.target.value}))}/></Field></div>
            <Field label="Unidad" required>
              <select style={sel} value={form.unit||""} onChange={e=>setForm((f:any)=>({...f,unit:e.target.value}))}>
                {UNITS.map(u=><option key={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Código de Barras"><input style={inp} value={form.barcode||""} onChange={e=>setForm((f:any)=>({...f,barcode:e.target.value}))} placeholder="Escanea o digita el código (opcional)"/></Field>
            <Field label="Moneda del precio">
              <select style={sel} value={form.currency||"CUP"} onChange={e=>setForm((f:any)=>({...f,currency:e.target.value}))}>
                {availCurrencies.map((m)=> <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label={`Precio Venta (${form.currency||"CUP"})`} required><input style={inp} type="number" value={form.price||""} onChange={e=>setForm((f:any)=>({...f,price:e.target.value}))}/></Field>
            <Field label="Costo (CUP)"><input style={inp} type="number" value={form.cost||""} onChange={e=>setForm((f:any)=>({...f,cost:e.target.value}))}/></Field>
            {modal==="add" && <Field label="Stock Inicial (entra al Almacén Central)"><input style={inp} type="number" value={form.stock||""} onChange={e=>setForm((f:any)=>({...f,stock:e.target.value}))}/></Field>}
            <Field label="Stock Mínimo"><input style={inp} type="number" value={form.minStock||""} onChange={e=>setForm((f:any)=>({...f,minStock:e.target.value}))}/></Field>
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:24 }}>
            <button style={btn("secondary")} onClick={()=>setModal(null)}>Cancelar</button>
            <button style={{ ...btn("primary"), opacity:saving?0.6:1 }} onClick={saveProduct} disabled={saving}>{saving?"Guardando...":"Guardar"}</button>
          </div>
        </Modal>
      )}

      {modal==="adjust" && selected && (
        <Modal title={`Ajuste de Stock — ${selected.name}`} onClose={()=>setModal(null)} width={420}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ background:"var(--input-bg)", borderRadius:12, padding:"12px 16px" }}>
              <p style={{ margin:0, fontSize:13, color:"var(--ink)" }}>Stock actual en {locationInfo?.name}: <strong>{selected.stock} {selected.unit}</strong></p>
            </div>
            <Field label="Tipo de Movimiento">
              <div style={{ display:"flex", gap:10 }}>
                {[["entrada","Entrada (+)"],["salida","Salida (-)"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setAdjustType(v)} style={{ ...btn(adjustType===v?"primary":"secondary"), flex:1, justifyContent:"center", fontSize:13 }}>{l}</button>
                ))}
              </div>
            </Field>
            <Field label="Cantidad" required><input style={inp} type="number" min="1" value={adjustQty} onChange={e=>setAdjustQty(e.target.value)} placeholder="0"/></Field>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button style={btn("secondary")} onClick={()=>setModal(null)}>Cancelar</button>
              <button style={{ ...btn("primary"), opacity:saving?0.6:1 }} onClick={saveAdjust} disabled={saving}>{saving?"Guardando...":"Registrar"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Inventario;
