import { useState } from "react";
import Icon from "./Icon";
import { btn } from "./primitives";

// ─── TOUR DE BIENVENIDA (onboarding) ───────────────────────────────────────
const TOUR_STEPS = [
  { icon: "pos", title: "¡Bienvenido a CubaGest!", text: "Este es tu panel de gestión. Te mostramos lo esencial en 5 pasos (toca Siguiente para avanzar)." },
  { icon: "pos", title: "Punto de Venta", text: "Cobra desde la pestaña Vender. Si no hay conexión, la venta se guarda en el dispositivo y se envía sola cuando vuelve la red." },
  { icon: "inventario", title: "Inventario multi-ubicación", text: "Tu stock vive en ubicaciones (Almacén Central, cajas). Desde Envíos mandas mercancía entre ellas." },
  { icon: "facturacion", title: "Facturas y exportación", text: "Todas tus facturas quedan en Facturas. Desde allí puedes exportar tus ventas, inventario y gastos a CSV cuando los necesites." },
  { icon: "contabilidad", title: "Configura tu negocio", text: "En el menú de tu perfil (arriba a la derecha): monedas que operas, descuentos, tu plan y más." },
];

export const WelcomeTour = ({ onDone }: { onDone: () => void }) => {
  const [step, setStep] = useState(0);
  const s = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1500, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 20 }} onClick={last ? onDone : undefined}>
      <div style={{ background: "var(--card)", borderRadius: 18, padding: "22px 20px", maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--brand-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={s.icon} size={20} color="var(--brand)" />
          </div>
          <div style={{ fontWeight: 800, fontSize: 16, color: "var(--ink)" }}>{s.title}</div>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>{step + 1}/{TOUR_STEPS.length}</span>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--ink)", lineHeight: 1.6 }}>{s.text}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...btn("ghost"), fontSize: 13 }} onClick={onDone}>Saltar</button>
          <button style={{ ...btn("primary"), flex: 1, justifyContent: "center" }} onClick={() => last ? onDone() : setStep(step + 1)}>
            {last ? "¡Empezar!" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
};
