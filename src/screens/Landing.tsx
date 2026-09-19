import { btn } from "@/components/shared/primitives";
import Icon from "@/components/shared/Icon";

// ─── LANDING PAGE (pública, antes del login) ────────────────────────────────
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

const Landing = ({ onEnter }: { onEnter: () => void }) => (
  <div style={{ minHeight:"100vh", background:"#F8FAFC", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color:"#1E293B" }}>
    {/* Nav */}
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", maxWidth:960, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:34, height:34, background:"linear-gradient(135deg,#3B82F6,#60A5FA)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="19" height="19" viewBox="0 0 32 32" fill="none"><path d="M8 24L16 8L24 24" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M10.5 19h11" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
        </div>
        <span style={{ fontWeight:800, fontSize:17 }}>CubaGest</span>
      </div>
      <button onClick={onEnter} style={{ ...btn("ghost"), fontSize:14 }}>Iniciar sesión</button>
    </div>

    {/* Hero */}
    <div style={{ background:"linear-gradient(135deg,#0F172A 0%,#1E3A5F 55%,#1E293B 100%)", color:"#fff", padding:"56px 24px 64px", textAlign:"center" }}>
      <div style={{ maxWidth:680, margin:"0 auto" }}>
        <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.25)", borderRadius:999, padding:"6px 14px", fontSize:13, fontWeight:600, marginBottom:22 }}>
          ✅ Funciona sin VPN en Cuba
        </div>
        <h1 style={{ margin:"0 0 14px", fontSize:38, lineHeight:1.15, fontWeight:800, letterSpacing:"-1px" }}>
          Gestiona tu negocio<br/>desde el celular
        </h1>
        <p style={{ margin:"0 auto 28px", fontSize:16, lineHeight:1.6, color:"#CBD5E1", maxWidth:520 }}>
          Inventario, punto de venta, facturación y contabilidad en una sola app.
          Diseñada para bodegas, cafeterías y tiendecitas cubanas — <strong style={{color:"#fff"}}>incluso sin internet</strong>.
        </p>
        <button onClick={onEnter} style={{ ...btn("primary"), fontSize:16, padding:"14px 34px", borderRadius:14, boxShadow:"0 10px 30px rgba(59,130,246,0.45)" }}>
          Crear mi negocio — gratis 30 días
        </button>
        <p style={{ margin:"12px 0 0", fontSize:12, color:"#94A3B8" }}>Sin tarjeta · Plan Empresarial completo de prueba · Pago con QvaPay cuando quieras</p>

        {/* Mockup de teléfono */}
        <div style={{ margin:"44px auto 0", width:230, background:"#0B1220", borderRadius:28, border:"6px solid #1E293B", padding:"14px 12px", boxShadow:"0 30px 60px rgba(0,0,0,0.5)", textAlign:"left" }}>
          <div style={{ fontSize:10, color:"#94A3B8", marginBottom:8 }}>Hoy · Resumen</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#fff" }}>$ 12,450</div>
          <div style={{ fontSize:10, color:"#4ADE80", marginBottom:12 }}>▲ 18% vs. ayer</div>
          {[72, 45, 90, 60, 34, 80].map((h, i) => (
            <div key={i} style={{ display:"inline-block", width:18, margin:2, borderRadius:4, background:i===2?"#3B82F6":"#1E3A5F", height:h*0.5, verticalAlign:"bottom" }}/>
          ))}
          <div style={{ marginTop:14, background:"#16233B", borderRadius:10, padding:"8px 10px", fontSize:10, color:"#CBD5E1" }}>
            🧾 Factura #0231 — $1,250 <span style={{ color:"#4ADE80" }}>pagada</span>
          </div>
          <div style={{ marginTop:6, background:"#16233B", borderRadius:10, padding:"8px 10px", fontSize:10, color:"#CBD5E1" }}>
            ⚠️ Refresco La Tropical — quedan 4
          </div>
          <div style={{ marginTop:10, background:"linear-gradient(135deg,#3B82F6,#60A5FA)", borderRadius:10, padding:"9px 0", textAlign:"center", fontSize:11, fontWeight:700, color:"#fff" }}>
            + Vender
          </div>
        </div>
      </div>
    </div>

    {/* Features */}
    <div style={{ maxWidth:960, margin:"0 auto", padding:"52px 20px" }}>
      <h2 style={{ textAlign:"center", fontSize:26, fontWeight:800, margin:"0 0 8px" }}>Todo lo que tu negocio necesita</h2>
      <p style={{ textAlign:"center", color:"#64748B", margin:"0 0 32px", fontSize:14 }}>Sin planillas de Excel, sin cuadernos, sin dolores de cabeza.</p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", gap:14 }}>
        {LANDING_FEATURES.map(f => (
          <div key={f.title} style={{ background:"#fff", borderRadius:16, padding:"22px 20px", border:"1px solid #E2E8F0" }}>
            <div style={{ width:40, height:40, borderRadius:12, background:"#EFF6FF", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}>
              <Icon name={f.icon} size={20} color="#3B82F6"/>
            </div>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:6 }}>{f.title}</div>
            <div style={{ fontSize:13, color:"#64748B", lineHeight:1.55 }}>{f.text}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Cómo funciona */}
    <div style={{ background:"#fff", borderTop:"1px solid #E2E8F0", borderBottom:"1px solid #E2E8F0", padding:"48px 20px" }}>
      <div style={{ maxWidth:820, margin:"0 auto" }}>
        <h2 style={{ textAlign:"center", fontSize:24, fontWeight:800, margin:"0 0 28px" }}>Empieza a vender en 3 pasos</h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:18 }}>
          {[
            { n:1, t:"Crea tu cuenta", d:"Registra tu negocio con tu correo. 30 días del plan completo gratis." },
            { n:2, t:"Agrega tus productos", d:"Carga tu inventario con precios y stock por ubicación. Toma 10 minutos." },
            { n:3, t:"Vende y crece", d:"Cobra, factura y mira tus números. Funciona con o sin internet." },
          ].map(s => (
            <div key={s.n} style={{ textAlign:"center", padding:"0 8px" }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:"#3B82F6", color:"#fff", fontSize:19, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}>{s.n}</div>
              <div style={{ fontWeight:700, marginBottom:6 }}>{s.t}</div>
              <div style={{ fontSize:13, color:"#64748B", lineHeight:1.55 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Precios */}
    <div style={{ maxWidth:960, margin:"0 auto", padding:"52px 20px" }}>
      <h2 style={{ textAlign:"center", fontSize:26, fontWeight:800, margin:"0 0 8px" }}>Precios claros, en USD</h2>
      <p style={{ textAlign:"center", color:"#64748B", margin:"0 0 32px", fontSize:14 }}>Empieza gratis. Paga solo cuando tu negocio lo necesite.</p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:16, maxWidth:860, margin:"0 auto" }}>
        {LANDING_PLANS.map(p => (
          <div key={p.key} style={{ background:p.key==="pro"?"#0F172A":"#fff", color:p.key==="pro"?"#fff":"#1E293B", borderRadius:18, padding:"26px 22px", border:p.key==="pro"?"none":"1px solid #E2E8F0", position:"relative" }}>
            {p.key==="pro" && <div style={{ position:"absolute", top:-11, left:"50%", transform:"translateX(-50%)", background:"#3B82F6", color:"#fff", fontSize:11, fontWeight:700, borderRadius:999, padding:"4px 12px" }}>{p.tag}</div>}
            <div style={{ fontWeight:800, fontSize:17, marginBottom:2 }}>{p.label}</div>
            {p.key!=="pro" && <div style={{ fontSize:12, color:"#94A3B8", marginBottom:8 }}>{p.tag}</div>}
            <div style={{ fontSize:34, fontWeight:800, margin:"8px 0 14px" }}>${p.priceUSD}<span style={{ fontSize:13, fontWeight:400, color:p.key==="pro"?"#94A3B8":"#64748B" }}>/mes</span></div>
            {p.features.map(f => <div key={f} style={{ fontSize:13, padding:"5px 0", color:p.key==="pro"?"#CBD5E1":"#475569" }}>✓ {f}</div>)}
            <button onClick={onEnter} style={{ ...(p.key==="pro"?btn("primary"):btn("ghost")), width:"100%", justifyContent:"center", marginTop:16 }}>{p.priceUSD===0?"Empezar gratis":"Elegir plan"}</button>
          </div>
        ))}
      </div>
    </div>

    {/* CTA final */}
    <div style={{ background:"linear-gradient(135deg,#1E3A5F,#0F172A)", color:"#fff", padding:"52px 24px", textAlign:"center" }}>
      <h2 style={{ margin:"0 0 10px", fontSize:26, fontWeight:800 }}>¿Listo para organizar tu negocio?</h2>
      <p style={{ margin:"0 0 24px", color:"#CBD5E1", fontSize:15 }}>Crea tu cuenta hoy y ten tu primera factura en 10 minutos.</p>
      <button onClick={onEnter} style={{ ...btn("primary"), fontSize:16, padding:"14px 34px", borderRadius:14 }}>Crear mi negocio</button>
    </div>

    {/* Footer */}
    <div style={{ padding:"26px 20px", textAlign:"center", fontSize:12, color:"#94A3B8" }}>
      © {new Date().getFullYear()} CubaGest · Sistema de gestión empresarial
    </div>
  </div>
);

export default Landing;
