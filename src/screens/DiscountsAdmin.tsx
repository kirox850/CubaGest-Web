import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import Icon from "@/components/shared/Icon";
import { Modal, Field, Spinner, btn, inp, sel } from "@/components/shared/primitives";

// ─── DESCUENTOS (panel de administración) ─────────────────────────────────
const DiscountsAdmin = ({ showToast, onClose }: { showToast: (m:string,t:string)=>void; onClose: () => void }) => {
  const [list, setList]       = useState<any[]>([]);
  const [locs, setLocs]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState<any>({
    name:"", code:"", scope:"venta", type:"porcentual", value:"",
    maxUses:"", maxUsesPerSale:"", locationScope:"todas", locations:[] as string[], active:true,
  });

  const load = async () => {
    setLoading(true);
    try {
      const [d, l] = await Promise.all([apiFetch("/discounts"), apiFetch("/locations")]);
      setList(d || []);
      setLocs(l || []);
    } catch(e:any) { showToast(e.message, "error"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name || !form.value) return showToast("Nombre y valor son requeridos", "error");
    if (form.type==="porcentual" && Number(form.value)>100) return showToast("El % no puede ser mayor a 100", "error");
    setSaving(true);
    try {
      await apiFetch("/discounts", { method:"POST", body:{
        name: form.name,
        code: (form.code||"").trim() || undefined,
        scope: form.scope,
        type: form.type,
        value: Number(form.value),
        maxUses: form.maxUses ? Number(form.maxUses) : undefined,
        maxUsesPerSale: form.maxUsesPerSale ? Number(form.maxUsesPerSale) : undefined,
        locationScope: form.locationScope,
        locations: form.locationScope==="algunas" ? form.locations : [],
        active: form.active,
      }});
      showToast("Descuento creado", "success");
      setForm({ name:"", code:"", scope:"venta", type:"porcentual", value:"", maxUses:"", maxUsesPerSale:"", locationScope:"todas", locations:[], active:true });
      load();
    } catch(e:any) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const remove = async (d:any) => {
    if (!(window as any).confirmDialogOK && !window.confirm(`¿Eliminar el descuento "${d.name}"?`)) return;
    try {
      await apiFetch(`/discounts/${d.id}`, { method:"DELETE" });
      showToast("Descuento eliminado", "success");
      load();
    } catch(e:any) { showToast(e.message, "error"); }
  };

  const toggleActive = async (d:any) => {
    try {
      await apiFetch(`/discounts/${d.id}`, { method:"PUT", body:{ active: !d.active } });
      load();
    } catch(e:any) { showToast(e.message, "error"); }
  };

  return (
    <Modal title="Descuentos" onClose={onClose} width={640}>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <p style={{ margin:0, fontSize:13, color:"var(--muted)" }}>
          Los descuentos de tipo <strong>Venta</strong> se aplican al total en el POS; los de <strong>Producto</strong> se aplicarían por línea.
          Solo tú (admin) puedes crearlos o eliminarlos.
        </p>

        {/* Formulario de creación */}
        <div style={{ background:"var(--input-bg)", border:"1px solid var(--line)", borderRadius:14, padding:14, display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Field label="Nombre" required><input style={inp} value={form.name} onChange={e=>setForm((f:any)=>({...f,name:e.target.value}))} placeholder="Ej: Rebaja verano"/></Field>
            <Field label="Código corto"><input style={inp} value={form.code} onChange={e=>setForm((f:any)=>({...f,code:e.target.value}))} placeholder="Ej: VERANO10"/></Field>
            <Field label="Aplica a">
              <select style={sel} value={form.scope} onChange={e=>setForm((f:any)=>({...f,scope:e.target.value}))}>
                <option value="venta">Total de la venta</option>
                <option value="producto">Por producto (línea)</option>
              </select>
            </Field>
            <Field label="Tipo">
              <select style={sel} value={form.type} onChange={e=>setForm((f:any)=>({...f,type:e.target.value}))}>
                <option value="porcentual">Porcentaje (%)</option>
                <option value="fixed">Monto fijo</option>
              </select>
            </Field>
            <Field label={form.type==="porcentual"?"Valor (%)":"Valor (monto)"} required><input style={inp} type="number" value={form.value} onChange={e=>setForm((f:any)=>({...f,value:e.target.value}))}/></Field>
            <Field label="Usos máximos (vacío = ilimitado)"><input style={inp} type="number" value={form.maxUses} onChange={e=>setForm((f:any)=>({...f,maxUses:e.target.value}))} placeholder="∞"/></Field>
          </div>
          <Field label="Disponible en">
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setForm((f:any)=>({...f,locationScope:"todas"}))} style={{ ...btn(form.locationScope==="todas"?"primary":"secondary"), flex:1, justifyContent:"center", fontSize:13 }}>Todas las ubicaciones</button>
              <button onClick={()=>setForm((f:any)=>({...f,locationScope:"algunas"}))} style={{ ...btn(form.locationScope==="algunas"?"primary":"secondary"), flex:1, justifyContent:"center", fontSize:13 }}>Solo algunas</button>
            </div>
          </Field>
          {form.locationScope==="algunas" && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {locs.map(l => {
                const on = form.locations.includes(l.id);
                return (
                  <button key={l.id} onClick={()=>setForm((f:any)=>({...f, locations: on ? f.locations.filter((x:string)=>x!==l.id) : [...f.locations, l.id]}))}
                    style={{ ...btn(on?"primary":"secondary"), fontSize:12, padding:"6px 12px" }}>
                    {on?"✓ ":""}{l.name}
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <button style={{ ...btn("primary"), opacity:saving?0.6:1 }} onClick={create} disabled={saving}><Icon name="plus" size={15}/>Crear descuento</button>
          </div>
        </div>

        {/* Lista */}
        {loading ? <Spinner/> : list.length===0 ? (
          <div style={{ textAlign:"center", color:"var(--muted)", fontSize:14, padding:24 }}>Todavía no hay descuentos creados</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {list.map(d => (
              <div key={d.id} style={{ border:"1px solid var(--line)", borderRadius:12, padding:"10px 14px", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                <div style={{ flex:1, minWidth:180 }}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{d.name} {d.code && <span style={{ fontFamily:"monospace", fontSize:11, background:"var(--input-bg)", borderRadius:6, padding:"1px 6px", marginLeft:6 }}>{d.code}</span>}</div>
                  <div style={{ fontSize:12, color:"var(--muted)" }}>
                    {d.scope==="venta"?"Venta completa":"Por producto"} · {d.type==="fixed"?`−${d.value} fijo`:`−${d.value}%`}
                    · {d.locationScope==="todas"?"Todas las ubicaciones":`${(d.locations||[]).length} ubicación(es)`}
                    · Usos: {d.usedCount||0}{d.maxUses?`/${d.maxUses}`:""}
                    {d.active===false && <span style={{ color:"#DC2626", fontWeight:700 }}> · INACTIVO</span>}
                  </div>
                </div>
                <button style={{ ...btn("secondary"), fontSize:12 }} onClick={()=>toggleActive(d)}>{d.active===false?"Activar":"Desactivar"}</button>
                <button style={{ ...btn("secondary"), fontSize:12, color:"#DC2626" }} onClick={()=>remove(d)}>Eliminar</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default DiscountsAdmin;
