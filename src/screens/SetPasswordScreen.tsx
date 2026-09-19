import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Field, btn, inp } from "@/components/shared/primitives";
import Icon from "@/components/shared/Icon";

// ─── SET PASSWORD (pública, vía link de invitación) ──────────────────────────
const SetPasswordScreen = ({ token, onDone }: { token: string; onDone: () => void }) => {
  const [password, setPassword]   = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);

  const submit = async () => {
    setError("");
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== password2) return setError("Las contraseñas no coinciden.");
    setLoading(true);
    try {
      await apiFetch("/auth/set-password", { method:"POST", body:{ token, password }, auth:false });
      setDone(true);
    } catch (e:any) {
      setError(e.message || "No se pudo establecer la contraseña.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0F172A 0%,#1E3A5F 50%,#1E293B 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#ffffff", borderRadius:16, padding:"40px 36px", width:"100%", maxWidth:400, boxShadow:"0 30px 80px rgba(0,0,0,0.4)" }}>
        {done ? (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✓</div>
            <h2 style={{ margin:"0 0 8px", fontSize:20, fontWeight:800, color:"#1E293B" }}>¡Listo!</h2>
            <p style={{ margin:"0 0 24px", fontSize:14, color:"#64748B" }}>Tu contraseña quedó establecida. Ya puedes iniciar sesión con ella.</p>
            <button style={{ ...btn("primary"), width:"100%", justifyContent:"center" }} onClick={onDone}>Ir a iniciar sesión</button>
          </div>
        ) : (
          <>
            <h2 style={{ margin:"0 0 6px", fontSize:20, fontWeight:800, color:"#1E293B" }}>Establece tu contraseña</h2>
            <p style={{ margin:"0 0 24px", fontSize:13, color:"#64748B" }}>Elige una contraseña que solo tú vas a conocer — ni tu administrador la ve.</p>
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <Field label="Nueva contraseña" required>
                <input style={inp} type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" placeholder="mínimo 8 caracteres"/>
              </Field>
              <Field label="Confirmar contraseña" required>
                <input style={inp} type="password" value={password2} onChange={e=>setPassword2(e.target.value)} autoComplete="new-password" onKeyDown={e=>e.key==="Enter"&&submit()}/>
              </Field>
              {error && <div style={{ background:"#FEF2F2", color:"#EF4444", padding:"10px 14px", borderRadius:12, fontSize:13, display:"flex", gap:8, alignItems:"center" }}><Icon name="alert" size={15} color="#EF4444"/>{error}</div>}
              <button style={{ ...btn("primary"), justifyContent:"center", padding:"12px", fontSize:15, opacity:loading?0.7:1 }} onClick={submit} disabled={loading}>
                {loading ? "Guardando..." : "Establecer contraseña"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SetPasswordScreen;
