import { useState } from "react";
import { apiFetch, saveToken } from "@/lib/api";
import { Field, btn, inp } from "@/components/shared/primitives";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Icon from "@/components/shared/Icon";
import { BrandLogo } from "@/screens/Landing";

// ─── LOGIN (estilo shadcn: panel de marca + tarjeta) ─────────────────────────
// La lógica (login, registro, recuperación) es exactamente la misma; solo
// cambia la presentación. En pantallas angostas el panel lateral desaparece.

// Oculta el panel visual en móviles (los estilos inline no soportan media
// queries, así que usamos una clase dedicada).
const loginStyles = `
.cg-login-aside { display: flex; }
@media (max-width: 900px) { .cg-login-aside { display: none; } }
`;

const HIGHLIGHTS = [
  "Funciona sin VPN — incluso sin internet",
  "Ventas, inventario y facturación en un solo lugar",
  "Multi-moneda: CUP, USD, MLC, EUR y más",
  "Cierre de caja y contabilidad en un clic",
];

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
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex" }}>
      <style>{loginStyles}</style>

      {/* ── Panel visual de marca (solo desktop) ── */}
      <aside
        className="cg-login-aside"
        style={{
          width:"46%", maxWidth:640, minHeight:"100vh", position:"relative", overflow:"hidden",
          background:"linear-gradient(160deg,#0B1220 0%,#12263F 55%,#1E3A5F 100%)",
          flexDirection:"column", justifyContent:"space-between", padding:"48px 52px",
        }}
      >
        {/* Trama de puntos + halo de luz */}
        <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)", backgroundSize:"22px 22px", pointerEvents:"none" }}/>
        <div style={{ position:"absolute", width:420, height:420, borderRadius:"50%", background:"radial-gradient(circle,rgba(59,130,246,0.35),transparent 65%)", top:-120, right:-100, pointerEvents:"none" }}/>
        <div style={{ position:"absolute", width:300, height:300, borderRadius:"50%", background:"radial-gradient(circle,rgba(16,185,129,0.18),transparent 65%)", bottom:-80, left:-60, pointerEvents:"none" }}/>

        <div style={{ position:"relative" }}>
          <BrandLogo size={40}/>
        </div>

        <div style={{ position:"relative" }}>
          <h2 style={{ margin:0, fontSize:34, fontWeight:800, color:"#F8FAFC", lineHeight:1.2, letterSpacing:"-0.5px" }}>
            El sistema de gestión<br/>para tu negocio en Cuba.
          </h2>
          <div style={{ display:"flex", flexDirection:"column", gap:12, marginTop:28 }}>
            {HIGHLIGHTS.map((h) => (
              <div key={h} style={{ display:"flex", alignItems:"center", gap:10, fontSize:14, color:"rgba(226,232,240,0.92)" }}>
                <span style={{ width:20, height:20, borderRadius:"50%", background:"rgba(16,185,129,0.2)", border:"1px solid rgba(16,185,129,0.45)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                {h}
              </div>
            ))}
          </div>
        </div>

        <p style={{ position:"relative", margin:0, fontSize:12.5, color:"rgba(148,163,184,0.9)" }}>
          30 días gratis del plan Empresarial · Sin tarjeta · Cancela cuando quieras
        </p>
      </aside>

      {/* ── Columna del formulario ── */}
      <main style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20, padding:"32px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span className="cg-login-brand"><BrandLogo size={30}/></span>
          <span style={{ fontSize:15, fontWeight:700, color:"var(--ink)" }}>CubaGest</span>
        </div>
        <style>{`.cg-login-brand { display:none; } @media (max-width: 900px) { .cg-login-brand { display:flex; } }`}</style>

        <Card style={{ width:"100%", maxWidth:400, boxShadow:"0 24px 60px rgba(2,8,23,0.25)" }}>
          <CardHeader style={{ textAlign:"center" }}>
            <CardTitle style={{ fontSize:20 }}>Bienvenido de nuevo</CardTitle>
            <CardDescription>Ingresa a tu negocio para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <Field label="Correo electrónico" required>
                <input style={inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="usuario@empresa.cu" onKeyDown={e=>e.key==="Enter"&&handleSubmit()} autoComplete="email"/>
              </Field>
              <Field label="Contraseña" required>
                <input style={inp} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handleSubmit()} autoComplete="current-password"/>
              </Field>
              {error && (
                <div style={{ background:"rgba(220,38,38,0.10)", border:"1px solid rgba(220,38,38,0.30)", color:"#DC2626", padding:"10px 14px", borderRadius:12, fontSize:13, display:"flex", gap:8, alignItems:"center" }}>
                  <Icon name="alert" size={15} color="#DC2626"/>{error}
                </div>
              )}
              <button style={{ ...btn("primary"), justifyContent:"center", padding:"12px", fontSize:15, opacity:loading?0.7:1 }} onClick={handleSubmit} disabled={loading}>
                {loading ? "Verificando..." : "Iniciar sesión"}
              </button>
              <button style={{ background:"none", border:"none", color:"var(--brand,#3B82F6)", fontSize:13, cursor:"pointer", textAlign:"center" as any, padding:4 }} onClick={()=>{ setShowForgot(true); setForgotEmail(email); setForgotSent(false); }}>
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </CardContent>
        </Card>

        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
          <button style={{ ...btn("secondary"), width:"100%", minWidth:280, justifyContent:"center", fontSize:13 }} onClick={()=>setShowRegister(true)}>
            Crear mi negocio (primera vez)
          </button>
          <button style={{ background:"none", border:"none", color:"var(--muted)", fontSize:12, cursor:"pointer", padding:4 }} onClick={()=>{ onBackToLanding?.(); }}>
            ← Volver al inicio
          </button>
          <p style={{ textAlign:"center", margin:0, fontSize:11, color:"var(--muted)" }}>
            Al continuar aceptas los Términos de Servicio y la Política de Privacidad de CubaGest.
          </p>
        </div>
      </main>

      {/* Modal de "olvidé mi contraseña" */}
      {showForgot && (
        <div style={{ position:"fixed", inset:0, background:"rgba(2,8,23,0.6)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"var(--card)", border:"1px solid var(--line)", borderRadius:16, padding:"32px 28px", width:"100%", maxWidth:400, boxShadow:"0 20px 60px rgba(2,8,23,0.4)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:"var(--ink)" }}>Recuperar contraseña</h2>
              <button onClick={()=>setShowForgot(false)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:"var(--muted)" }}>✕</button>
            </div>
            {forgotSent ? (
              <div style={{ textAlign:"center", padding:"8px 0" }}>
                <p style={{ fontSize:14, color:"var(--ink)", lineHeight:1.6 }}>Si ese correo existe en nuestro sistema, te llegará un link para restablecer tu contraseña. Revisa también spam.</p>
                <button style={{ ...btn("primary"), width:"100%", justifyContent:"center", marginTop:12 }} onClick={()=>setShowForgot(false)}>Entendido</button>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <p style={{ margin:0, fontSize:13, color:"var(--muted)" }}>Ingresa tu correo y te mandamos un link para elegir una nueva contraseña.</p>
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
        <div style={{ position:"fixed", inset:0, background:"rgba(2,8,23,0.6)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"var(--card)", border:"1px solid var(--line)", borderRadius:16, padding:"32px 28px", width:"100%", maxWidth:440, boxShadow:"0 20px 60px rgba(2,8,23,0.4)", maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
              <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:"var(--ink)" }}>Registrar mi negocio</h2>
              <button onClick={()=>{ setShowRegister(false); setRegError(""); }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:"var(--muted)" }}>✕</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"var(--muted)", textTransform:"uppercase" as any, letterSpacing:"0.5px", display:"block", marginBottom:5 }}>Nombre del negocio *</label>
                <input style={inp} value={regForm.companyName} onChange={e=>setRegForm(f=>({...f,companyName:e.target.value}))} placeholder="Ej: Bodega El Progreso"/>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"var(--muted)", textTransform:"uppercase" as any, letterSpacing:"0.5px", display:"block", marginBottom:5 }}>NIT del negocio <span style={{ fontWeight:400, opacity:0.7 }}>(opcional)</span></label>
                <input style={inp} value={regForm.companyNit} onChange={e=>setRegForm(f=>({...f,companyNit:e.target.value}))} placeholder="12345678901" maxLength={11}/>
              </div>
              <div style={{ height:1, background:"var(--line)" }}/>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"var(--muted)", textTransform:"uppercase" as any, letterSpacing:"0.5px", display:"block", marginBottom:5 }}>Código de referido <span style={{ fontWeight:400, opacity:0.7 }}>(opcional)</span></label>
                <input style={inp} value={regForm.referralCode} onChange={e=>setRegForm(f=>({...f,referralCode:e.target.value.toUpperCase()}))} placeholder="Si un amigo te invitó, pon su código" maxLength={10}/>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"var(--muted)", textTransform:"uppercase" as any, letterSpacing:"0.5px", display:"block", marginBottom:5 }}>Su nombre completo *</label>
                <input style={inp} value={regForm.name} onChange={e=>setRegForm(f=>({...f,name:e.target.value}))} placeholder="Ej: Ana García"/>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"var(--muted)", textTransform:"uppercase" as any, letterSpacing:"0.5px", display:"block", marginBottom:5 }}>Correo electrónico *</label>
                <input style={inp} type="email" value={regForm.email} onChange={e=>setRegForm(f=>({...f,email:e.target.value}))} placeholder="admin@miempresa.cu"/>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"var(--muted)", textTransform:"uppercase" as any, letterSpacing:"0.5px", display:"block", marginBottom:5 }}>Contraseña * <span style={{ fontWeight:400, opacity:0.7 }}>(mín. 8 caracteres)</span></label>
                <input style={inp} type="password" value={regForm.password} onChange={e=>setRegForm(f=>({...f,password:e.target.value}))} placeholder="••••••••"/>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"var(--muted)", textTransform:"uppercase" as any, letterSpacing:"0.5px", display:"block", marginBottom:5 }}>Confirmar contraseña *</label>
                <input style={inp} type="password" value={regForm.password2} onChange={e=>setRegForm(f=>({...f,password2:e.target.value}))} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handleRegister()}/>
              </div>
              {regError && (
                <div style={{ background:"rgba(220,38,38,0.10)", border:"1px solid rgba(220,38,38,0.30)", color:"#DC2626", padding:"10px 14px", borderRadius:10, fontSize:13 }}>
                  {regError}
                </div>
              )}
              <div style={{ background:"rgba(59,130,246,0.10)", border:"1px solid rgba(59,130,246,0.25)", borderRadius:10, padding:"10px 14px", fontSize:12.5, color:"var(--ink)" }}>
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
