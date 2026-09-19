import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { ROLES } from "@/config/constants";
import Icon from "@/components/shared/Icon";
import { Modal, Badge, Field, Spinner, btn, inp, sel } from "@/components/shared/primitives";
import { showConfirm } from "@/components/shared/dialogs";

// ─── USUARIOS ─────────────────────────────────────────────────────────────────
const Usuarios = ({ currentUser, showToast }: { currentUser: any; showToast: (m:string,t:string)=>void }) => {
  const [users, setUsers]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [form, setForm]     = useState({ name:"", email:"", role:"cajero" });
  const [saving, setSaving] = useState(false);
  const [linkInfo, setLinkInfo] = useState<{ name:string; url:string; emailSent:boolean } | null>(null);
  const [resendingId, setResendingId] = useState<string|null>(null);

  const load = useCallback(async()=>{
    try { setLoading(true); const list = await apiFetch("/users"); setUsers(list); }
    catch(e:any) { showToast(e.message,"error"); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{ load(); },[load]);

  const openAdd  = () => { setEditUser(null); setForm({ name:"", email:"", role:"cajero" }); setModal(true); };
  const openEdit = (u:any) => { setEditUser(u); setForm({ name:u.name, email:u.email, role:u.role }); setModal(true); };

  const saveUser = async()=>{
    if (!form.name||!form.email) return showToast("Complete todos los campos","error");
    setSaving(true);
    try {
      if (editUser) {
        await apiFetch(`/users/${editUser.id}`, { method:"PUT", body:{ name:form.name, role:form.role } });
        showToast("Usuario actualizado","success");
        setModal(false);
      } else {
        const created = await apiFetch("/users", { method:"POST", body:form });
        setModal(false);
        setLinkInfo({ name: form.name, url: created.setPasswordUrl, emailSent: created.emailSent });
      }
      load();
    } catch(e:any) { showToast(e.message,"error"); }
    finally { setSaving(false); }
  };

  const resendLink = async (u:any) => {
    setResendingId(u.id);
    try {
      const res = await apiFetch(`/users/${u.id}/resend-set-password`, { method:"POST" });
      setLinkInfo({ name: u.name, url: res.setPasswordUrl, emailSent: res.emailSent });
      showToast(res.emailSent ? "Link reenviado por correo" : "Link generado — el correo no se pudo enviar, compártelo a mano", res.emailSent?"success":"warning");
    } catch(e:any) { showToast(e.message,"error"); }
    finally { setResendingId(null); }
  };

  const deleteUser = async(id:string)=>{
    if (!(await showConfirm("¿Dar de baja a este usuario?"))) return;
    try { await apiFetch(`/users/${id}`, { method:"DELETE" }); showToast("Usuario dado de baja","info"); load(); }
    catch(e:any) { showToast(e.message,"error"); }
  };

  const copyLink = async (url:string) => {
    try { await navigator.clipboard.writeText(url); showToast("Link copiado","success"); }
    catch { showToast("No se pudo copiar — selecciónalo manualmente","warning"); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:800, color:"var(--ink)" }}>Usuarios y Roles</h2>
          <p style={{ margin:0, fontSize:14, color:"var(--muted)" }}>{users.filter((u:any)=>u.active!==false).length} usuarios activos de {users.length} registrados</p>
        </div>
        <button style={btn("primary")} onClick={openAdd}><Icon name="plus" size={16}/>Nuevo Usuario</button>
      </div>

      {loading ? <Spinner/> : (
        <div style={{ background:"var(--card)", borderRadius:16, border:"1px solid var(--line)", overflowX:"auto", WebkitOverflowScrolling:"touch" as any }}>
          <table style={{ width:"100%", minWidth:760, borderCollapse:"collapse" }}>
            <thead><tr style={{ background:"var(--input-bg)" }}>
              {["Nombre","Correo","Rol","Estado","Acciones"].map(h=>(
                <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.5px" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {users.map(u=>(
                <tr key={u.id} style={{ borderTop:"1px solid var(--line)" }}>
                  <td style={{ padding:"14px 16px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:36, height:36, borderRadius:50, background:ROLES[u.role]?.color||"#888", color:"#ffffff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700 }}>{u.name?.charAt(0)}</div>
                      <div>
                        <p style={{ margin:0, fontSize:14, fontWeight:700, color:"var(--ink)" }}>{u.name}</p>
                        {u.id===currentUser.id && <span style={{ fontSize:11, color:"#3B82F6", fontWeight:600 }}>← Sesión actual</span>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:"14px 16px", fontSize:13, color:"var(--ink)" }}>{u.email}</td>
                  <td style={{ padding:"14px 16px" }}><Badge label={ROLES[u.role]?.label||u.role} color={ROLES[u.role]?.color||"#888"}/></td>
                  <td style={{ padding:"14px 16px" }}>
                    {/* "Dar de baja" es soft-delete (active=false): el usuario
                        SIGUE existiendo — por eso lo mostramos con su badge —
                        y login lo rechaza. No es un bug de borrado. */}
                    {u.active === false
                      ? <Badge label="Inactivo (baja)" color="#DC2626"/>
                      : u.pending
                        ? <Badge label="Pendiente de activar" color="#F97316"/>
                        : <Badge label="Activo" color="#10B981"/>}
                  </td>
                  <td style={{ padding:"14px 16px" }}>
                    <div style={{ display:"flex", gap:6 }}>
                      <button style={{ ...btn("ghost"), padding:"5px 9px" }} onClick={()=>openEdit(u)}><Icon name="edit" size={14}/></button>
                      <button style={{ ...btn("ghost"), padding:"5px 9px", fontSize:11 }} onClick={()=>resendLink(u)} disabled={resendingId===u.id} title={u.pending?"Reenviar link de activación":"Mandar link para restablecer contraseña"}>
                        {resendingId===u.id ? "..." : "🔗"}
                      </button>
                      {u.id!==currentUser.id && <button style={{ ...btn("danger"), padding:"5px 9px" }} onClick={()=>deleteUser(u.id)}><Icon name="trash" size={14}/></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ background:"var(--input-bg)", borderRadius:16, border:"1px solid var(--line)", padding:20 }}>
        <h3 style={{ margin:"0 0 14px", fontSize:14, fontWeight:700, color:"var(--ink)" }}>Política de seguridad</h3>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:12 }}>
          {[["🔐","Cada quien elige su propia contraseña — admin nunca la ve"],["📋","Registro de auditoría por usuario"],["⏱","Sesión con token JWT expirable"],["🔒","Acceso restringido por rol"],["📊","Registro de auditoría por acceso"],["🛡","Comunicación cifrada HTTPS"]].map(([icon,text])=>(
            <div key={text as string} style={{ display:"flex", gap:10, alignItems:"flex-start", fontSize:13, color:"var(--ink)" }}>
              <span style={{ fontSize:16 }}>{icon}</span>{text as string}
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <Modal title={editUser?"Editar Usuario":"Nuevo Usuario"} onClose={()=>setModal(false)} width={440}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <Field label="Nombre completo" required><input style={inp} value={form.name} onChange={e=>setForm((f:any)=>({...f,name:e.target.value}))}/></Field>
            <Field label="Correo electrónico" required><input style={inp} type="email" value={form.email} onChange={e=>setForm((f:any)=>({...f,email:e.target.value}))} disabled={!!editUser}/></Field>
            <Field label="Rol del sistema" required>
              <select style={sel} value={form.role} onChange={e=>setForm((f:any)=>({...f,role:e.target.value}))}>
                {Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <div style={{ background:"var(--input-bg)", borderRadius:12, padding:12, fontSize:12, color:"var(--ink)" }}>
              <strong>Permisos del rol {ROLES[form.role]?.label}:</strong> {ROLES[form.role]?.perms.join(", ")}
            </div>
            {!editUser && (
              <div style={{ background:"var(--input-bg)", border:"1px solid var(--line)", borderRadius:12, padding:12, fontSize:12.5, color:"var(--ink)" }}>
                No se pide contraseña acá — apenas crees la cuenta, le va a llegar un correo (y también te muestro el link por si acaso) para que la elija él mismo.
              </div>
            )}
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button style={btn("secondary")} onClick={()=>setModal(false)}>Cancelar</button>
              <button style={{ ...btn("primary"), opacity:saving?0.6:1 }} onClick={saveUser} disabled={saving}>{saving?"Guardando...":editUser?"Actualizar":"Crear Usuario"}</button>
            </div>
          </div>
        </Modal>
      )}

      {linkInfo && (
        <Modal title={`Link para ${linkInfo.name}`} onClose={()=>setLinkInfo(null)} width={460}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {linkInfo.emailSent ? (
              <div style={{ background:"rgba(16,185,129,0.10)", border:"1px solid rgba(16,185,129,0.35)", borderRadius:12, padding:12, fontSize:13, color:"#166534" }}>
                ✓ Le mandamos un correo con este link. Aquí lo tienes también por si acaso.
              </div>
            ) : (
              <div style={{ background:"rgba(249,115,22,0.08)", border:"1px solid rgba(249,115,22,0.30)", borderRadius:12, padding:12, fontSize:13, color:"#C2410C" }}>
                ⚠ El correo no se pudo enviar (revisa que Resend esté configurado). Comparte este link a mano — por WhatsApp, por ejemplo.
              </div>
            )}
            <div style={{ background:"var(--input-bg)", borderRadius:10, padding:"10px 12px", fontSize:12, wordBreak:"break-all" as any, color:"var(--ink)", fontFamily:"monospace" }}>
              {linkInfo.url}
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button style={btn("secondary")} onClick={()=>setLinkInfo(null)}>Cerrar</button>
              <button style={btn("primary")} onClick={()=>copyLink(linkInfo.url)}>Copiar link</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Usuarios;
