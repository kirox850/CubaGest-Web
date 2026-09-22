import { useState, useEffect, useRef } from "react";
import Icon from "@/components/shared/Icon";
import { LegalModal } from "@/components/shared/LegalModal";
import { PRIVACY_POLICY_MD, TERMS_MD } from "@/legalContent";

// ─── LANDING PAGE (pública, antes del login) ────────────────────────────────
// Diseño premium: revelado al hacer scroll (IntersectionObserver), contadores
// animados, micro-interacciones y parallax. Cero dependencias — todo con
// CSS transitions + un hook propio, así sigue funcionando sin VPN.

const LANDING_PLANS = [
  { key:"free", label:"Free", priceUSD:0, tag:"Para empezar", features:["1 usuario","Hasta 10 productos","100 ventas al mes","Reportes básicos"] },
  { key:"pro", label:"Pro", priceUSD:5, tag:"El más elegido", features:["3 usuarios","Hasta 50 productos","1.000 ventas al mes","Cierre de caja e inventario","Soporte prioritario"] },
  { key:"empresarial", label:"Empresarial", priceUSD:10, tag:"Sin límites", features:["Usuarios ilimitados","Productos y ventas ilimitados","Roles y permisos avanzados","Backup y exportación"] },
];

const LANDING_FEATURES = [
  { icon:"pos", title:"Vende sin internet", text:"El punto de venta funciona offline: las ventas se guardan y sincronizan solas al volver la conexión." },
  { icon:"inventario", title:"Inventario multi-ubicación", text:"Controla el stock de tu almacén central y de cada tienda o caja por separado, con envíos entre ellas." },
  { icon:"facturacion", title:"Facturación con numeración", text:"Facturas con número consecutivo, datos del cliente, descuentos y anulación con registro en auditoría." },
  { icon:"contabilidad", title:"Contabilidad simple", text:"Registra gastos, mira ingresos por método de pago y conoce tu ganancia neta sin ser contador." },
  { icon:"cierre", title:"Cierre de caja", text:"Lecturas de caja con validación de stock: cada cajero responde por su dinero y su mercancía." },
  { icon:"usuarios", title:"Roles y auditoría", text:"Cajero, almacenista y contador solo ven lo suyo. Cada acción queda registrada en el log de auditoría." },
];

// ── LOGO: usa tu logo custom si existe ──────────────────────────────────────
// Sube tu archivo como /public/brand/logo.png (ver public/brand/README.txt).
// Mientras no exista, se muestra el monograma "C" por defecto.
// Los <img> con src roto disparan onError y caen al fallback automáticamente.
// Exportado también para el header de la app (App.tsx).
export const LOGO_URL = "/brand/logo.png";
export const BrandLogo = ({ size = 34 }: { size?: number }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return (
    <div style={{ width:size, height:size, background:"linear-gradient(135deg,var(--brand),var(--brand-light))", borderRadius:size*0.35, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
      <span style={{ color:"#fff", fontWeight:800, fontSize:size*0.5, lineHeight:1 }}>C</span>
    </div>
  );
  return (
    <img src={LOGO_URL} alt="CubaGest" width={size} height={size}
      onError={() => setFailed(true)}
      style={{ width:size, height:size, borderRadius:size*0.28, objectFit:"cover", flexShrink:0, display:"block" }}/>
  );
};

// ── Hook: revelar elementos cuando entran en el viewport ───────────────────
const useReveal = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, visible };
};

// Contenedor con fade+slide al entrar en viewport (con delay escalonado)
const Reveal = ({ children, delay = 0, y = 28 }: { children: any; delay?: number; y?: number }) => {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : `translateY(${y}px)`,
      transition: `opacity 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      willChange: "opacity, transform",
    }}>{children}</div>
  );
};

// Contador que anima de 0 a target cuando se hace visible
const CountUp = ({ to, suffix = "", duration = 1400 }: { to: number; suffix?: string; duration?: number }) => {
  const { ref, visible } = useReveal();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3)))); // easeOutCubic
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, to, duration]);
  return <span ref={ref as any}>{n.toLocaleString("es")}{suffix}</span>;
};

// Botón CTA con brillo deslizante (shine) al pasar el mouse
const CtaButton = ({ onClick, children, big = false }: { onClick: () => void; children: any; big?: boolean }) => (
  <button onClick={onClick} className="cta-shine" style={{
    position:"relative", overflow:"hidden", border:"none", cursor:"pointer",
    background:"linear-gradient(135deg,var(--brand),var(--brand-dark))", color:"#fff", fontWeight:700,
    fontSize:big?16:15, padding:big?"15px 36px":"12px 26px", borderRadius:14,
    boxShadow:"0 10px 30px rgba(var(--brand-rgb),0.45)",
    transition:"transform 0.2s cubic-bezier(0.22,1,0.36,1), box-shadow 0.2s",
  }}
  onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.transform="translateY(-2px) scale(1.02)"; (e.currentTarget as HTMLElement).style.boxShadow="0 16px 40px rgba(var(--brand-rgb),0.55)"; }}
  onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.transform="none"; (e.currentTarget as HTMLElement).style.boxShadow="0 10px 30px rgba(var(--brand-rgb),0.45)"; }}
  >{children}</button>
);

// Mockup del teléfono con leve efecto parallax al mover el mouse
const PhoneMockup = () => {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  return (
    <div
      onMouseMove={e => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setTilt({ x: ((e.clientX - r.left) / r.width - 0.5) * 10, y: ((e.clientY - r.top) / r.height - 0.5) * -10 });
      }}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      style={{ perspective: 800, display:"inline-block" }}>
      <div style={{
        margin:"44px auto 0", width:230, background:"#0B1220", borderRadius:28, border:"6px solid #1E293B",
        padding:"14px 12px", boxShadow:"0 30px 60px rgba(0,0,0,0.5)", textAlign:"left",
        transform:`rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)`,
        transition:"transform 0.25s ease-out", willChange:"transform",
      }}>
        <div style={{ fontSize:10, color:"#94A3B8", marginBottom:8 }}>Hoy · Resumen</div>
        <div style={{ fontSize:20, fontWeight:800, color:"#fff" }}>$ <CountUp to={12450}/></div>
        <div style={{ fontSize:10, color:"#4ADE80", marginBottom:12 }}>▲ 18% vs. ayer</div>
        {[72, 45, 90, 60, 34, 80].map((h, i) => (
          <div key={i} className="bar-grow" style={{ display:"inline-block", width:18, margin:2, borderRadius:4,
            background:i===2?"var(--brand)":"#1E3A5F", height:h*0.5, verticalAlign:"bottom", animationDelay:`${300 + i*90}ms` }}/>
        ))}
        <div style={{ marginTop:14, background:"#16233B", borderRadius:10, padding:"8px 10px", fontSize:10, color:"#CBD5E1" }}>
          🧾 Factura #0231 — $1,250 <span style={{ color:"#4ADE80" }}>pagada</span>
        </div>
        <div style={{ marginTop:6, background:"#16233B", borderRadius:10, padding:"8px 10px", fontSize:10, color:"#CBD5E1" }}>
          ⚠️ Refresco La Tropical — quedan 4
        </div>
        <div style={{ marginTop:10, background:"linear-gradient(135deg,var(--brand),var(--brand-light))", borderRadius:10, padding:"9px 0", textAlign:"center", fontSize:11, fontWeight:700, color:"#fff" }}>
          + Vender
        </div>
      </div>
    </div>
  );
};

const Landing = ({ onEnter }: { onEnter: () => void }) => {
  // Modales legales (mismo contenido que dentro de la app) + contacto
  const [legal, setLegal] = useState<null | "privacy" | "terms" >(null);
  const [contactOpen, setContactOpen] = useState(false);
  const goId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior:"smooth", block:"start" });

  return (
  <div style={{ minHeight:"100vh", background:"#F8FAFC", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color:"#1E293B", overflowX:"hidden" }}>
    <style>{`
      /* Brillo que cruza el botón CTA */
      .cta-shine::after {
        content:""; position:absolute; top:0; left:-80%; width:50%; height:100%;
        background:linear-gradient(105deg, transparent, rgba(255,255,255,0.35), transparent);
        transform:skewX(-20deg); animation:ctaShine 3.2s ease-in-out infinite;
      }
      @keyframes ctaShine { 0%,60% { left:-80%; } 100% { left:160%; } }
      /* Barras del mockup: crecen al montar */
      .bar-grow { transform-origin:bottom; animation:barGrow 0.7s cubic-bezier(0.22,1,0.36,1) both; }
      @keyframes barGrow { from { transform:scaleY(0); } to { transform:scaleY(1); } }
      /* Card de feature interactiva */
      .feature-card { transition:transform 0.25s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s, border-color 0.25s; }
      .feature-card:hover { transform:translateY(-6px); box-shadow:0 18px 40px rgba(15,23,42,0.10); border-color:var(--brand-tint-b) !important; }
      .feature-card:hover .feature-icon { transform:scale(1.12) rotate(-4deg); }
      .feature-icon { transition:transform 0.25s cubic-bezier(0.22,1,0.36,1); }
      /* Plan destacado con flotación suave */
      .plan-float { animation:planFloat 4.5s ease-in-out infinite; }
      @keyframes planFloat { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
      /* Hero: entrada inicial */
      .hero-in { animation:heroIn 0.9s cubic-bezier(0.22,1,0.36,1) both; }
      @keyframes heroIn { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
      .pulse-dot { animation:pulseDot 2s ease-in-out infinite; }
      @keyframes pulseDot { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
      /* Enlaces de la barra superior */
      .lnk { background:none; border:none; cursor:pointer; font-size:13.5px; font-weight:600; color:#334155; padding:8px 10px; border-radius:10px; transition:color 0.2s; }
      .lnk:hover { color:var(--brand); }
      @media (prefers-reduced-motion: reduce) {
        .cta-shine::after, .plan-float, .hero-in, .bar-grow, .pulse-dot { animation:none !important; }
      }
    `}</style>

    {/* Nav — el paddingTop con env(safe-area-inset-top) baja la barra por
        debajo del reloj/batería cuando se instala como PWA en iOS */}
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap" as any, padding:"calc(10px + env(safe-area-inset-top)) 20px 10px", maxWidth:960, margin:"0 auto", position:"sticky", top:0, zIndex:50, background:"rgba(248,250,252,0.85)", backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <BrandLogo size={34}/>
        <span style={{ fontWeight:800, fontSize:17 }}>CubaGest</span>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:2, flexWrap:"wrap" as any }}>
        <button className="lnk" onClick={()=>goId("precios")}>Precios</button>
        <button className="lnk" onClick={()=>setContactOpen(true)}>Contáctenos</button>
        <button onClick={onEnter} style={{ background:"var(--brand)", border:"none", cursor:"pointer", color:"#fff", fontSize:13.5, fontWeight:700, padding:"8px 16px", borderRadius:10, marginLeft:4, boxShadow:"0 4px 14px rgba(var(--brand-rgb),0.35)", transition:"transform 0.15s, box-shadow 0.2s" }}
          onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.transform="translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow="0 8px 20px rgba(var(--brand-rgb),0.45)"; }}
          onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.transform="none"; (e.currentTarget as HTMLElement).style.boxShadow="0 4px 14px rgba(var(--brand-rgb),0.35)"; }}>
          Iniciar sesión
        </button>
      </div>
    </div>

    {/* Hero — navy de marca (mismo tono que el splash del Brand Kit) */}
    <div style={{ background:"linear-gradient(135deg,#0B1220 0%,#0D3B75 55%,#0B1220 100%)", color:"#fff", padding:"56px 24px 64px", textAlign:"center", position:"relative", overflow:"hidden" }}>
      {/* Halos decorativos con blur */}
      <div style={{ position:"absolute", width:420, height:420, borderRadius:"50%", background:"radial-gradient(circle,rgba(var(--brand-rgb),0.22),transparent 65%)", top:-140, right:-120, pointerEvents:"none" }}/>
      <div style={{ position:"absolute", width:360, height:360, borderRadius:"50%", background:"radial-gradient(circle,rgba(var(--brand-rgb-light),0.14),transparent 65%)", bottom:-160, left:-120, pointerEvents:"none" }}/>
      <div style={{ maxWidth:680, margin:"0 auto", position:"relative" }}>
        <div className="hero-in" style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.25)", borderRadius:999, padding:"6px 14px", fontSize:13, fontWeight:600, marginBottom:22 }}>
          <span className="pulse-dot" style={{ width:8, height:8, borderRadius:"50%", background:"#4ADE80", display:"inline-block" }}/>
          Funciona sin VPN en Cuba
        </div>
        <h1 className="hero-in" style={{ animationDelay:"0.1s", margin:"0 0 14px", fontSize:38, lineHeight:1.15, fontWeight:800, letterSpacing:"-1px" }}>
          Gestiona tu negocio<br/>desde el celular
        </h1>
        <p className="hero-in" style={{ animationDelay:"0.2s", margin:"0 auto 28px", fontSize:16, lineHeight:1.6, color:"#CBD5E1", maxWidth:520 }}>
          Inventario, punto de venta, facturación y contabilidad en una sola app.
          Diseñada para bodegas, cafeterías y tiendecitas cubanas — <strong style={{color:"#fff"}}>incluso sin internet</strong>.
        </p>
        <div className="hero-in" style={{ animationDelay:"0.3s" }}>
          <CtaButton onClick={onEnter} big>Crear mi negocio — gratis 30 días</CtaButton>
        </div>
        <p className="hero-in" style={{ animationDelay:"0.4s", margin:"12px 0 0", fontSize:12, color:"#94A3B8" }}>Sin tarjeta · Plan Empresarial completo de prueba · Pago con QvaPay cuando quieras</p>

        <div className="hero-in" style={{ animationDelay:"0.5s" }}>
          <PhoneMockup/>
        </div>
      </div>
    </div>

    {/* Cinta de métricas con contadores animados */}
    <div style={{ background:"#fff", borderBottom:"1px solid #E2E8F0" }}>
      <div style={{ maxWidth:860, margin:"0 auto", padding:"30px 20px", display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, textAlign:"center" }}>
        {[
          { n:1200, suffix:"+", label:"ventas registradas" },
          { n:99, suffix:"%", label:"disponibilidad del servicio" },
          { n:10, suffix:" min", label:"para tu primera factura" },
        ].map((m, i) => (
          <Reveal key={m.label} delay={i*120}>
            <div style={{ fontSize:26, fontWeight:800, color:"#1E293B" }}><CountUp to={m.n} suffix={m.suffix}/></div>
            <div style={{ fontSize:12, color:"#64748B", marginTop:2 }}>{m.label}</div>
          </Reveal>
        ))}
      </div>
    </div>

    {/* Features */}
    <div style={{ maxWidth:960, margin:"0 auto", padding:"52px 20px" }}>
      <Reveal>
        <h2 style={{ textAlign:"center", fontSize:26, fontWeight:800, margin:"0 0 8px" }}>Todo lo que tu negocio necesita</h2>
        <p style={{ textAlign:"center", color:"#64748B", margin:"0 0 32px", fontSize:14 }}>Sin planillas de Excel, sin cuadernos, sin dolores de cabeza.</p>
      </Reveal>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", gap:14 }}>
        {LANDING_FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={(i % 3) * 100}>
            <div className="feature-card" style={{ background:"#fff", borderRadius:16, padding:"22px 20px", border:"1px solid #E2E8F0", height:"100%", boxSizing:"border-box" }}>
              <div className="feature-icon" style={{ width:40, height:40, borderRadius:12, background:"var(--brand-tint)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}>
                <Icon name={f.icon} size={20} color="var(--brand)"/>
              </div>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:6 }}>{f.title}</div>
              <div style={{ fontSize:13, color:"#64748B", lineHeight:1.55 }}>{f.text}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>

    {/* Cómo funciona */}
    <div style={{ background:"#fff", borderTop:"1px solid #E2E8F0", borderBottom:"1px solid #E2E8F0", padding:"48px 20px" }}>
      <div style={{ maxWidth:820, margin:"0 auto" }}>
        <Reveal><h2 style={{ textAlign:"center", fontSize:24, fontWeight:800, margin:"0 0 28px" }}>Empieza a vender en 3 pasos</h2></Reveal>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:18 }}>
          {[
            { n:1, t:"Crea tu cuenta", d:"Registra tu negocio con tu correo. 30 días del plan completo gratis." },
            { n:2, t:"Agrega tus productos", d:"Carga tu inventario con precios y stock por ubicación. Toma 10 minutos." },
            { n:3, t:"Vende y crece", d:"Cobra, factura y mira tus números. Funciona con o sin internet." },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i*140}>
              <div style={{ textAlign:"center", padding:"0 8px" }}>
                <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,var(--brand),var(--brand-dark))", color:"#fff", fontSize:19, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px", boxShadow:"0 8px 20px rgba(var(--brand-rgb),0.35)" }}>{s.n}</div>
                <div style={{ fontWeight:700, marginBottom:6 }}>{s.t}</div>
                <div style={{ fontSize:13, color:"#64748B", lineHeight:1.55 }}>{s.d}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>

    {/* Precios */}
    <div id="precios" style={{ maxWidth:960, margin:"0 auto", padding:"52px 20px", scrollMarginTop:80 }}>
      <Reveal>
        <h2 style={{ textAlign:"center", fontSize:26, fontWeight:800, margin:"0 0 8px" }}>Precios claros, en USD</h2>
        <p style={{ textAlign:"center", color:"#64748B", margin:"0 0 32px", fontSize:14 }}>Empieza gratis. Paga solo cuando tu negocio lo necesite.</p>
      </Reveal>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:16, maxWidth:860, margin:"0 auto", alignItems:"stretch" }}>
        {LANDING_PLANS.map((p, i) => (
          <Reveal key={p.key} delay={i*120}>
            <div className={p.key==="pro" ? "plan-float" : ""} style={{
              background:p.key==="pro"?"#0F172A":"#fff", color:p.key==="pro"?"#fff":"#1E293B",
              borderRadius:18, padding:"26px 22px", border:p.key==="pro"?"2px solid var(--brand)":"1px solid #E2E8F0",
              position:"relative", height:"100%", boxSizing:"border-box",
              boxShadow:p.key==="pro"?"0 20px 50px rgba(15,23,42,0.25)":"none",
              transition:"transform 0.25s, box-shadow 0.25s",
            }}
            onMouseEnter={e=>{ if(p.key!=="pro"){ (e.currentTarget as HTMLElement).style.transform="translateY(-4px)"; (e.currentTarget as HTMLElement).style.boxShadow="0 14px 34px rgba(15,23,42,0.10)"; } }}
            onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.transform="none"; (e.currentTarget as HTMLElement).style.boxShadow=p.key==="pro"?"0 20px 50px rgba(15,23,42,0.25)":"none"; }}>
              {p.key==="pro" && <div style={{ position:"absolute", top:-11, left:"50%", transform:"translateX(-50%)", background:"var(--brand)", color:"#fff", fontSize:11, fontWeight:700, borderRadius:999, padding:"4px 12px", whiteSpace:"nowrap" }}>{p.tag}</div>}
              <div style={{ fontWeight:800, fontSize:17, marginBottom:2 }}>{p.label}</div>
              {p.key!=="pro" && <div style={{ fontSize:12, color:"#94A3B8", marginBottom:8 }}>{p.tag}</div>}
              <div style={{ fontSize:34, fontWeight:800, margin:"8px 0 14px" }}>${p.priceUSD}<span style={{ fontSize:13, fontWeight:400, color:p.key==="pro"?"#94A3B8":"#64748B" }}>/mes</span></div>
              {p.features.map(f => <div key={f} style={{ fontSize:13, padding:"5px 0", color:p.key==="pro"?"#CBD5E1":"#475569" }}>✓ {f}</div>)}
              <button onClick={onEnter} style={{
                width:"100%", justifyContent:"center", marginTop:16, cursor:"pointer",
                border:p.key==="pro"?"none":"1px solid #CBD5E1", borderRadius:12, padding:"11px 0",
                fontSize:14, fontWeight:700,
                background:p.key==="pro"?"linear-gradient(135deg,var(--brand),var(--brand-dark))":"transparent",
                color:p.key==="pro"?"#fff":"#1E293B",
                transition:"opacity 0.2s, transform 0.15s",
              }}
              onMouseEnter={e=>((e.currentTarget as HTMLElement).style.opacity="0.85")}
              onMouseLeave={e=>((e.currentTarget as HTMLElement).style.opacity="1")}>
                {p.priceUSD===0?"Empezar gratis":"Elegir plan"}
              </button>
            </div>
          </Reveal>
        ))}
      </div>
    </div>

    {/* CTA final */}
    <div style={{ background:"linear-gradient(135deg,#0D3B75,#0B1220)", color:"#fff", padding:"52px 24px", textAlign:"center", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", width:380, height:380, borderRadius:"50%", background:"radial-gradient(circle,rgba(var(--brand-rgb),0.18),transparent 65%)", top:-120, left:"50%", transform:"translateX(-50%)", pointerEvents:"none" }}/>
      <Reveal>
        <h2 style={{ margin:"0 0 10px", fontSize:26, fontWeight:800, position:"relative" }}>¿Listo para organizar tu negocio?</h2>
        <p style={{ margin:"0 0 24px", color:"#CBD5E1", fontSize:15, position:"relative" }}>Crea tu cuenta hoy y ten tu primera factura en 10 minutos.</p>
        <div style={{ position:"relative" }}><CtaButton onClick={onEnter} big>Crear mi negocio</CtaButton></div>
      </Reveal>
    </div>

    {/* Footer */}
    <div style={{ padding:"26px 20px", textAlign:"center", fontSize:12, color:"#94A3B8" }}>
      © {new Date().getFullYear()} CubaGest · Sistema de gestión empresarial
      <div style={{ marginTop:8, display:"flex", gap:6, justifyContent:"center", flexWrap:"wrap" as any }}>
        <button className="lnk" style={{ fontSize:12, color:"#94A3B8" }} onClick={()=>setContactOpen(true)}>Contáctenos</button>
        <span>·</span>
        <button className="lnk" style={{ fontSize:12, color:"#94A3B8" }} onClick={()=>setLegal("terms")}>Términos y Condiciones</button>
        <span>·</span>
        <button className="lnk" style={{ fontSize:12, color:"#94A3B8" }} onClick={()=>setLegal("privacy")}>Política de Privacidad</button>
      </div>
    </div>

    {/* Modal de contacto */}
    {contactOpen && (
      <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={()=>setContactOpen(false)}>
        <div style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:420, padding:"28px 26px", boxShadow:"0 24px 70px rgba(2,8,23,0.35)" }} onClick={e=>e.stopPropagation()}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
            <h3 style={{ margin:0, fontSize:19, fontWeight:800, color:"#0F172A" }}>Contáctenos</h3>
            <button onClick={()=>setContactOpen(false)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:"#94A3B8" }}>✕</button>
          </div>
          <p style={{ margin:"0 0 18px", fontSize:13.5, color:"#64748B", lineHeight:1.55 }}>¿Dudas antes de empezar o necesitas ayuda con tu negocio? Escríbenos, respondemos rápido.</p>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <a href="mailto:soporte@cubagest.dpdns.org" style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 15px", background:"var(--brand-tint, #EAF4FE)", borderRadius:14, textDecoration:"none" }}>
              <span style={{ width:36, height:36, borderRadius:10, background:"var(--brand)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m22 7-10 6L2 7"/></svg>
              </span>
              <span>
                <span style={{ display:"block", fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:"0.5px" }}>Correo</span>
                <span style={{ fontSize:14, fontWeight:600, color:"var(--brand-dark, #026ACE)" }}>soporte@cubagest.dpdns.org</span>
              </span>
            </a>
            <a href="https://wa.me/5350000000" target="_blank" rel="noreferrer" style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 15px", background:"#F0FDF4", borderRadius:14, textDecoration:"none" }}>
              <span style={{ width:36, height:36, borderRadius:10, background:"#16A34A", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </span>
              <span>
                <span style={{ display:"block", fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:"0.5px" }}>WhatsApp</span>
                <span style={{ fontSize:14, fontWeight:600, color:"#15803D" }}>+53 5 000 0000</span>
              </span>
            </a>
            <div style={{ fontSize:12, color:"#94A3B8", textAlign:"center", padding:"4px 0 2px" }}>Atención de lunes a sábado, 8:00–18:00</div>
          </div>
        </div>
      </div>
    )}

    {/* Modales legales (mismo contenido que dentro de la app) */}
    {legal==="terms" && <LegalModal title="Términos y Condiciones" content={TERMS_MD} onClose={()=>setLegal(null)}/>}
    {legal==="privacy" && <LegalModal title="Política de Privacidad" content={PRIVACY_POLICY_MD} onClose={()=>setLegal(null)}/>}
  </div>
  );
};

export default Landing;
