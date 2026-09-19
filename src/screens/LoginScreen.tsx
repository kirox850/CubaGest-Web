import { useState } from "react";
import { apiFetch, saveToken } from "@/lib/api";
import { Field, btn, inp } from "@/components/shared/primitives";
import Icon from "@/components/shared/Icon";

// ─── LOGIN (con registro y recuperación) ──────────────────────────────────────
const LoginScreen = ({ onLogin, onBackToLanding }: { onLogin: (user: any) => void; onBackToLanding?: () => void }) => {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [regForm, setRegForm]   = useState({ companyName:"", companyNit:"", name:"", email:"", password:"", password2:"", referralCode:"" });
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  const handleForgot = async () => {
    if (!forgotEmail) return;
    setForgotLoading(true);
    try {
      await apiFetch("/auth/forgot-password", { method:"POST", body:{ email: forgotEmail }, auth:false });
      setForgotSent(true);
    } catch {
      // El backend siempre responde igual, pero por si falla la red mostramos lo mismo —
      // no queremos revelar si el correo existe o no.
      setForgotSent(true);
    } finally { setForgotLoading(false); }
  };

  const handleRegister = async () => {
    setRegError("");
    if (!regForm.companyName || !regForm.name || !regForm.email || !regForm.password) {
      setRegError("Complete todos los campos obligatorios."); return;
    }
    if (regForm.password !== regForm.password2) {
      setRegError("Las contraseñas no coinciden."); return;
    }
    if (regForm.password.length < 8) {
      setRegError("La contraseña debe tener al menos 8 caracteres."); return;
    }
    setRegLoading(true);
    try {
      const res = await apiFetch("/auth/register", {
        method: "POST",
        body: { companyName: regForm.companyName, companyNit: regForm.companyNit || undefined, name: regForm.name, email: regForm.email, password: regForm.password, referralCode: (regForm.referralCode||"").trim().toUpperCase() || undefined },
        auth: false,
      });
      const token = res.accessToken || res.token;
      if (!token) throw new Error("No se recibió token del servidor");
      if (res.refreshToken) localStorage.setItem("cubagest_refresh_token", res.refreshToken);
      saveToken(token);
      onLogin(res.user);
    } catch (err: any) {
      setRegError(err.message || "Error al registrar. Intente de nuevo.");
    } finally {
      setRegLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!email || !password) { setError("Ingrese su correo y contraseña."); return; }
    setError(""); setLoading(true);
    try {
      // El backend devuelve { accessToken, refreshToken, user }
      const res = await apiFetch("/auth/login", { method:"POST", body:{ email, password }, auth:false });
      const token = res.accessToken || res.token;
      if (!token) throw new Error("No se recibió token del servidor");
      if (res.refreshToken) localStorage.setItem("cubagest_refresh_token", res.refreshToken);
      saveToken(token);
      onLogin(res.user);
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0F172A 0%,#1E3A5F 50%,#1E293B 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#ffffff", borderRadius:16, padding:"48px 40px", width:"100%", maxWidth:400, boxShadow:"0 30px 80px rgba(0,0,0,0.4)" }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ width:60, height:60, background:"linear-gradient(135deg,#3B82F6,#60A5FA)", borderRadius:16, margin:"0 auto 16px", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M20 12a8 8 0 0 1-8 8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/><path d="M12 4a8 8 0 0 0 0 16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/><circle cx="16" cy="12" r="2" fill="white"/><circle cx="19.5" cy="12" r="2" fill="white"/></svg>
          </div>
          <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:"#1E293B", letterSpacing:"-0.5px" }}>CubaGest</h1>
          <p style={{ margin:"6px 0 0", fontSize:13, color:"#64748B" }}>Sistema de Gestión Empresarial</p>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
          <Field label="Correo electrónico" required>
            <input style={inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="usuario@empresa.cu" onKeyDown={e=>e.key==="Enter"&&handleSubmit()} autoComplete="email"/>
          </Field>
          <Field label="Contraseña" required>
            <input style={inp} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handleSubmit()} autoComplete="current-password"/>
          </Field>
          {error && <div style={{ background:"#fdf0f0", color:"#3B82F6", padding:"10px 14px", borderRadius:12, fontSize:13, display:"flex", gap:8, alignItems:"center" }}><Icon name="alert" size={15} color="#3B82F6"/>{error}</div>}
          <button style={{ ...btn("primary"), justifyContent:"center", padding:"12px", fontSize:15, marginTop:4, opacity:loading?0.7:1 }} onClick={handleSubmit} disabled={loading}>
            {loading ? "Verificando..." : "Iniciar sesión"}
          </button>
          <button style={{ background:"none", border:"none", color:"#3B82F6", fontSize:13, cursor:"pointer", textAlign:"center" as any, padding:4 }} onClick={()=>{ setShowForgot(true); setForgotEmail(email); setForgotSent(false); }}>
            ¿Olvidaste tu contraseña?
          </button>
        </div>
          <button style={{ ...btn("ghost"), width:"100%", justifyContent:"center", marginTop:8, fontSize:13 }} onClick={()=>setShowRegister(true)}>
          Crear mi negocio (primera vez)
        </button>
        <button style={{ background:"none", border:"none", color:"#94A3B8", fontSize:12, cursor:"pointer", marginTop:14 }} onClick={()=>{ onBackToLanding?.(); }}>
          ← Volver al inicio
        </button>
        <p style={{ textAlign:"center", marginTop:16, fontSize:11, color:"#b0a090" }}>Sistema de gestión empresarial · CubaGest</p>
      </div>

      {/* Modal de "olvidé mi contraseña" */}
      {showForgot && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:16, padding:"32px 28px", width:"100%", maxWidth:400, boxShadow:"0 20px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:"#1E293B" }}>Recuperar contraseña</h2>
              <button onClick={()=>setShowForgot(false)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:"#64748B" }}>✕</button>
            </div>
            {forgotSent ? (
              <div style={{ textAlign:"center", padding:"8px 0" }}>
                <p style={{ fontSize:14, color:"#475569", lineHeight:1.6 }}>Si ese correo existe en nuestro sistema, te llegará un link para restablecer tu contraseña. Revisa también spam.</p>
                <button style={{ ...btn("primary"), width:"100%", justifyContent:"center", marginTop:12 }} onClick={()=>setShowForgot(false)}>Entendido</button>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <p style={{ margin:0, fontSize:13, color:"#64748B" }}>Ingresa tu correo y te mandamos un link para elegir una nueva contraseña.</p>
                <Field label="Correo electrónico" required>
                  <input style={inp} type="email" value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleForgot()}/>
                </Field>
                <button style={{ ...btn("primary"), justifyContent:"center", opacity:forgotLoading?0.7:1 }} onClick={handleForgot} disabled={forgotLoading}>
                  {forgotLoading ? "Enviando..." : "Enviar link"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de registro */}
      {showRegister && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:16, padding:"32px 28px", width:"100%", maxWidth:440, boxShadow:"0 20px 60px rgba(0,0,0,0.4)", maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
              <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:"#1E293B" }}>Registrar mi negocio</h2>
              <button onClick={()=>{ setShowRegister(false); setRegError(""); }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:"#64748B" }}>✕</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"#64748B", textTransform:"uppercase" as any, letterSpacing:"0.5px", display:"block", marginBottom:5 }}>Nombre del negocio *</label>
                <input style={inp} value={regForm.companyName} onChange={e=>setRegForm(f=>({...f,companyName:e.target.value}))} placeholder="Ej: Bodega El Progreso"/>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"#64748B", textTransform:"uppercase" as any, letterSpacing:"0.5px", display:"block", marginBottom:5 }}>NIT del negocio <span style={{ fontWeight:400, color:"#94A3B8" }}>(opcional)</span></label>
                <input style={inp} value={regForm.companyNit} onChange={e=>setRegForm(f=>({...f,companyNit:e.target.value}))} placeholder="12345678901" maxLength={11}/>
              </div>
              <div style={{ height:1, background:"#E2E8F0" }}/>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"#64748B", textTransform:"uppercase" as any, letterSpacing:"0.5px", display:"block", marginBottom:5 }}>Código de referido <span style={{ fontWeight:400, color:"#94A3B8" }}>(opcional)</span></label>
                <input style={inp} value={regForm.referralCode} onChange={e=>setRegForm(f=>({...f,referralCode:e.target.value.toUpperCase()}))} placeholder="Si un amigo te invitó, pon su código" maxLength={10}/>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"#64748B", textTransform:"uppercase" as any, letterSpacing:"0.5px", display:"block", marginBottom:5 }}>Su nombre completo *</label>
                <input style={inp} value={regForm.name} onChange={e=>setRegForm(f=>({...f,name:e.target.value}))} placeholder="Ej: Ana García"/>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"#64748B", textTransform:"uppercase" as any, letterSpacing:"0.5px", display:"block", marginBottom:5 }}>Correo electrónico *</label>
                <input style={inp} type="email" value={regForm.email} onChange={e=>setRegForm(f=>({...f,email:e.target.value}))} placeholder="admin@miempresa.cu"/>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"#64748B", textTransform:"uppercase" as any, letterSpacing:"0.5px", display:"block", marginBottom:5 }}>Contraseña * <span style={{ fontWeight:400, color:"#94A3B8" }}>(mín. 8 caracteres)</span></label>
                <input style={inp} type="password" value={regForm.password} onChange={e=>setRegForm(f=>({...f,password:e.target.value}))} placeholder="••••••••"/>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"#64748B", textTransform:"uppercase" as any, letterSpacing:"0.5px", display:"block", marginBottom:5 }}>Confirmar contraseña *</label>
                <input style={inp} type="password" value={regForm.password2} onChange={e=>setRegForm(f=>({...f,password2:e.target.value}))} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handleRegister()}/>
              </div>
              {regError && (
                <div style={{ background:"#FEF2F2", color:"#DC2626", padding:"10px 14px", borderRadius:10, fontSize:13 }}>
                  {regError}
                </div>
              )}
              <div style={{ background:"#EFF6FF", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#1E40AF" }}>
                🎁 Comienzas con <strong>30 días gratis</strong> del plan Empresarial completo.
              </div>
              <button style={{ ...btn("primary"), justifyContent:"center", padding:"12px", fontSize:15, opacity:regLoading?0.7:1 }} onClick={handleRegister} disabled={regLoading}>
                {regLoading ? "Creando cuenta..." : "Crear cuenta y entrar"}
              </button>
              <button style={{ ...btn("ghost"), justifyContent:"center", fontSize:13 }} onClick={()=>{ setShowRegister(false); setRegError(""); }}>
                Ya tengo cuenta — Iniciar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginScreen;
