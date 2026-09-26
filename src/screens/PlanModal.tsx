import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import Icon from "@/components/shared/Icon";
import { Modal, btn } from "@/components/shared/primitives";
import { showAlert, showConfirm } from "@/components/shared/dialogs";

// ─── PLAN Y SUSCRIPCIÓN (modal desde el perfil) ────────────────────────────────
const PlanModal = ({ onClose, user }: { onClose: () => void; user: any }) => {
  const [planInfo, setPlanInfo]   = useState<any>(null);
  const [loading, setLoading]     = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string|null>(null);

  useEffect(() => {
    apiFetch("/subscription").then(setPlanInfo).catch(()=>{});
    // Detectar si volvió del callback de QvaPay
    const params = new URLSearchParams(window.location.search);
    const planResult = params.get("plan");
    if (planResult === "activated") {
      window.history.replaceState({}, "", window.location.pathname);
      apiFetch("/subscription").then(setPlanInfo).catch(()=>{});
    }
  }, []);

  // Solo se listan características que el producto tiene hoy. No se anuncian
  // reportes en PDF, notificaciones, respaldos automáticos ni "permisos
  // avanzados": esas funciones no existen todavía.
  const plans = [
    {
      key: "free", label: "Free", priceUSD: 0,
      features: ["1 usuario","Hasta 10 productos","100 ventas al mes","Reportes básicos","Soporte por email (48-72 h)"],
      payable: false,
    },
    {
      key: "pro", label: "Pro", priceUSD: 5,
      features: ["3 usuarios","Hasta 50 productos","1.000 ventas al mes","Cierre de caja e inventario","Ventas sin conexión con sincronización","Soporte prioritario (24-48 h)"],
      payable: true,
    },
    {
      key: "empresarial", label: "Empresarial", priceUSD: 10,
      features: ["Usuarios ilimitados","Productos ilimitados","Ventas ilimitadas","Todos los módulos: inventario, POS, facturación, contabilidad, cierre y envíos","Ventas sin conexión con sincronización","Soporte prioritario (< 12 h)"],
      payable: true,
    },
  ];

  const effectivePlan = planInfo?.plan || user?.company?.plan || "free";
  const subStatus     = planInfo?.subscriptionStatus || user?.company?.subscriptionStatus;
  const isTrial       = subStatus === "trial";
  const isFailed      = subStatus === "failed";
  const isCancelled   = subStatus === "cancelled";
  const planExpiry    = user?.company?.planExpiry;
  const daysLeft      = planExpiry ? Math.max(0, Math.ceil((new Date(planExpiry).getTime() - Date.now()) / 86400000)) : null;

  // Programa de referidos — la empresa referente recibe el MISMO plan de
  // regalo 30 días por cada referido que pague; referidos distintos se acumulan.
  const [referralData, setReferralData] = useState<any>(null);
  useEffect(() => {
    apiFetch("/referrals").then((d:any) => setReferralData({ referralCode: d?.code, total: d?.invited, bonified: d?.bonified })).catch(() => {});
  }, []);
  const copyRef = () => {
    if (referralData?.referralCode && navigator.clipboard) {
      navigator.clipboard.writeText(referralData.referralCode).catch(()=>{});
    }
  };

  const handleQvaPay = async (planKey: string) => {
    try {
      setLoading(true);
      setSelectedPlan(planKey);
      const data = await apiFetch("/subscription/authorize", { method:"POST", body:{ plan: planKey } });
      if (data?.url) window.location.href = data.url;
    } catch(e: any) { showAlert("Error al conectar con QvaPay: " + e.message); }
    finally { setLoading(false); setSelectedPlan(null); }
  };

  // Cancelar la suscripción. Antes esto NO existía: el texto de abajo decía
  // "escríbenos y desactivamos la renovación", o sea que para cancelar había
  // que escribir un correo. Ahora hay un botón, que es lo que la app promete.
  const handleCancel = async () => {
    const ok = await showConfirm(
      "¿Cancelar tu suscripción?\n\nNo se te cobra nada más. Conservas el plan hasta que termine el periodo que ya pagaste y después vuelves a Free automáticamente."
    );
    if (!ok) return;
    try {
      setLoading(true);
      await apiFetch("/subscription/cancel", { method: "POST" });
      showAlert("Suscripción cancelada. No se realizará ningún cobro más.");
      apiFetch("/subscription").then(setPlanInfo).catch(() => {});
    } catch (e:any) {
      showAlert("No se pudo cancelar: " + (e.message || "inténtalo de nuevo"));
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsApp = (planKey: string, priceUSD: number) => {
    const p   = plans.find(x => x.key === planKey);
    const company = user?.company?.name || "mi empresa";
    const email   = user?.email || "";
    const msg = encodeURIComponent(
      `Hola, quiero activar el plan *${p?.label}* de CubaGest.\n\n` +
      `Empresa: ${company}\n` +
      `Correo: ${email}\n` +
      `Plan: ${p?.label} — $${priceUSD} USD/mes\n\n` +
      `Por favor indícame cómo proceder con el pago.`
    );
    window.open(`https://wa.me/5354801057?text=${msg}`, "_blank");
  };

  return (
    <Modal title="Planes — CubaGest" onClose={onClose} width={660}>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

        {/* Programa de referidos */}
        {referralData?.referralCode && (
          <div style={{ background:"rgba(16,185,129,0.10)", border:"1px solid rgba(16,185,129,0.35)", borderRadius:12, padding:"12px 14px" }}>
            <div style={{ fontWeight:800, fontSize:13, color:"#166534", marginBottom:4, display:"inline-flex", alignItems:"center", gap:6 }}><Icon name="gift" size={15}/>Invita y gana planes</div>
            <div style={{ fontSize:12, color:"#166534", marginBottom:8 }}>
              Comparte tu código: cuando otro negocio se registre con él y contrate un plan pago, <strong>tú recibes ese mismo plan gratis 30 días</strong>. Cada referido que pague suma un bono.
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <code style={{ background:"rgba(16,185,129,0.15)", borderRadius:8, padding:"6px 12px", fontFamily:"monospace", fontWeight:800, fontSize:14, letterSpacing:1 }}>{referralData.referralCode}</code>
              <button style={{ ...btn("secondary"), fontSize:12 }} onClick={copyRef}>Copiar</button>
              <span style={{ fontSize:12, color:"#166534", marginLeft:"auto" }}>
                Referidos: <strong>{referralData.total||0}</strong> · Bonos activos: <strong>{referralData.bonified||0}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Banner trial */}
        {isTrial && daysLeft !== null && (
          <div style={{ background: daysLeft <= 7 ? "rgba(249,115,22,0.10)" : "var(--input-bg)", border:`1px solid ${daysLeft <= 7 ? "rgba(249,115,22,0.35)" : "var(--line)"}`, borderRadius:12, padding:14 }}>
            <div style={{ fontWeight:700, fontSize:14, color: daysLeft <= 7 ? "#C2410C" : "#1E40AF", display:"inline-flex", alignItems:"center", gap:6 }}>
              <Icon name={daysLeft <= 7 ? "alert" : "gift"} size={15}/><span>Período de prueba — {daysLeft} día{daysLeft !== 1 ? "s" : ""} restante{daysLeft !== 1 ? "s" : ""}</span>
            </div>
            <div style={{ fontSize:12, color:"var(--muted)", marginTop:4 }}>
              Estás usando el plan Empresarial gratis. Al vencer pasarás automáticamente al plan Free.
            </div>
          </div>
        )}

        {/* Banner cancelado */}
        {isCancelled && (
          <div style={{ background:"var(--input-bg)", border:"1px solid var(--line)", borderRadius:12, padding:14 }}>
            <div style={{ fontWeight:700, fontSize:14, color:"var(--ink)", display:"inline-flex", alignItems:"center", gap:6 }}>
              <Icon name="check" size={15}/>Suscripción cancelada
            </div>
            <div style={{ fontSize:12, color:"var(--muted)", marginTop:4 }}>
              No se realizará ningún cobro más. {daysLeft !== null && daysLeft > 0
                ? `Conservas el plan ${daysLeft} día${daysLeft !== 1 ? "s" : ""} más y después vuelves a Free.`
                : "Tu plan volverá a Free al terminar el periodo actual."}
            </div>
          </div>
        )}

        {/* Botón de cancelar: solo para admins con un plan de pago activo */}
        {!isCancelled && user?.role === "admin" && (effectivePlan === "pro" || effectivePlan === "empresarial") && (
          <button
            style={{ ...btn("secondary"), fontSize:12, color:"#DC2626", borderColor:"rgba(220,38,38,0.30)" }}
            onClick={handleCancel}
            disabled={loading}>
            Cancelar suscripción
          </button>
        )}

        {/* Banner pago fallido */}
        {isFailed && (
          <div style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.30)", borderRadius:12, padding:14 }}>
            <div style={{ fontWeight:700, fontSize:14, color:"#DC2626", display:"inline-flex", alignItems:"center", gap:6 }}><Icon name="alert" size={15}/>Pago fallido</div>
            <div style={{ fontSize:12, color:"var(--muted)", marginTop:4 }}>
              No pudimos cobrar tu suscripción. Revisa que QvaPay tenga saldo autorizado o escríbenos para regularizar el pago.
            </div>
          </div>
        )}

        {/* Uso actual */}
        {planInfo && (
          <div style={{ background:"var(--input-bg)", borderRadius:12, padding:14, border:"1px solid var(--line)" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", marginBottom:10, textTransform:"uppercase" as const }}>Uso este mes</div>
            <div style={{ display:"flex", gap:20, flexWrap:"wrap" as const }}>
              {[
                { l:"Usuarios",       v:planInfo.usage.users,          max:planInfo.limits.maxUsers },
                { l:"Productos",      v:planInfo.usage.products,        max:planInfo.limits.maxProducts },
                { l:"Ventas",         v:planInfo.usage.salesThisMonth,  max:planInfo.limits.maxSalesMonth },
              ].map(u => {
                const pct  = u.max ? Math.min(100, Math.round(u.v / u.max * 100)) : 0;
                const warn = u.max && pct >= 80;
                return (
                  <div key={u.l} style={{ flex:1, minWidth:110 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                      <span style={{ color:"var(--ink)", fontWeight:600 }}>{u.l}</span>
                      <span style={{ color: warn?"#F97316":"var(--ink)", fontWeight:700 }}>
                        {u.v}{u.max ? ` / ${u.max}` : ""}
                      </span>
                    </div>
                    {u.max && (
                      <div style={{ height:6, background:"var(--line)", borderRadius:99 }}>
                        <div style={{ height:6, width:`${pct}%`, background: pct>=100?"#DC2626":pct>=80?"#F97316":"var(--brand)", borderRadius:99 }}/>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tarjetas de planes */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12 }}>
          {plans.map(p => {
            const isCurrent = p.key === effectivePlan;
            const isLoading = loading && selectedPlan === p.key;
            return (
              <div key={p.key} style={{ border:`2px solid ${isCurrent?"var(--brand)":"var(--line)"}`, borderRadius:14, padding:16, position:"relative" as const, background:isCurrent?"var(--input-bg)":"var(--card)", display:"flex", flexDirection:"column", gap:8 }}>
                {isCurrent && (
                  <span style={{ position:"absolute" as const, top:-11, left:12, background:"var(--brand)", color:"#fff", fontSize:10, fontWeight:800, padding:"3px 10px", borderRadius:20 }}>
                    {isTrial && p.key === "empresarial" ? "PRUEBA GRATIS" : "PLAN ACTUAL"}
                  </span>
                )}
                <div style={{ fontWeight:800, fontSize:15, color:"var(--ink)" }}>{p.label}</div>
                <div style={{ fontWeight:700, fontSize:18, color: p.priceUSD===0?"#10B981":"var(--brand)", marginBottom:4 }}>
                  {p.priceUSD===0 ? "Gratis" : `$${p.priceUSD} USD`}
                  {p.priceUSD>0 && <span style={{ fontSize:12, fontWeight:400, color:"var(--muted)" }}>/mes</span>}
                </div>
                <div style={{ flex:1 }}>
                  {p.features.map((f:string) => (
                    <div key={f} style={{ display:"flex", gap:6, fontSize:12, color:"var(--ink)", marginBottom:5, alignItems:"flex-start" }}>
                      <Icon name="check" size={12} color="#10B981"/><span>{f}</span>
                    </div>
                  ))}
                </div>

                {/* Botones de pago solo en planes pagos y si no es el plan actual activo */}
                {p.payable && (!isCurrent || isTrial || isFailed) && user?.role === "admin" && (
                  <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:8 }}>
                    <button
                      style={{ background:"#1E293B", color:"#fff", border:"none", borderRadius:10, padding:"8px 10px", fontSize:12, fontWeight:700, cursor:loading?"not-allowed":"pointer", opacity:loading?0.6:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}
                      onClick={() => handleQvaPay(p.key)}
                      disabled={loading}>
                      {isLoading ? "Conectando..." : <><Icon name="credit_card" size={14}/>Pagar con QvaPay</>}
                    </button>
                    <button
                      style={{ background:"#25D366", color:"#fff", border:"none", borderRadius:10, padding:"8px 10px", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}
                      onClick={() => handleWhatsApp(p.key, p.priceUSD)}>
                      <><Icon name="message" size={14}/>Pagar por WhatsApp</>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ fontSize:12, color:"var(--muted)", textAlign:"center" as const }}>
          Los pagos por QvaPay se renuevan automáticamente cada 30 días. Si no quieres renovar, usa el botón "Cancelar suscripción": no se te cobra más y conservas lo que ya pagaste hasta que termine el periodo.
        </div>

        <button style={{ ...btn("secondary"), fontSize:14 }} onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
};

export default PlanModal;
