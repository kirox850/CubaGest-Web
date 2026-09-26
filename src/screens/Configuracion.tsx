import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import Icon from "@/components/shared/Icon";
import { Spinner, Field, btn, inp } from "@/components/shared/primitives";
import Usuarios from "@/screens/Usuarios";
import Auditoria from "@/screens/Auditoria";
import CurrenciesSettings from "@/screens/CurrenciesSettings";
import PlanModal from "@/screens/PlanModal";
import { CajaSettings } from "./CajaSettings";
import DiscountsAdmin from "@/screens/DiscountsAdmin";
import { CajasAdmin } from "@/screens/CajasAdmin";

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
//
// Antes estas cuatro cosas vivían sueltas en el menú de perfil (Mi Plan,
// Usuarios, Auditoría, Monedas y Tasas) y además como módulos sueltos de la
// navegación. Se apiñaban: cuatro entradas parecidas que además hacían cosas
// distintas — unas abrían un modal sobre lo que estabas viendo y otras te
// sacaban de la pantalla.
//
// Aquí entran todas en un modal con pestañas laterales, y la pestaña lateral
// es un botón grande en vez de un dropdown: en un teléfono se llega con el
// pulgar, y se ve de un vistazo cuántas secciones hay.
//
// Las pestañas se montan y desmontan al cambiar (no se ocultan con display),
// así que la tabla de usuarios no sigue repintando mientras el cajero mira la
// de monedas.

type TabId = "cajas" | "caja" | "monedas" | "descuentos" | "usuarios" | "auditoria" | "plan";

const TABS: { id: TabId; label: string; icon: string; roles?: string[]; perms?: string[] }[] = [
  { id: "cajas",     label: "Cajas",     icon: "pos", roles: ["admin"] },
  { id: "caja",      label: "Cierre de caja", icon: "cierre" },
  { id: "monedas",   label: "Monedas y tasas", icon: "contabilidad", roles: ["admin"] },
  { id: "descuentos", label: "Descuentos",   icon: "gift", roles: ["admin"] },
  { id: "usuarios",  label: "Usuarios",  icon: "usuarios", roles: ["admin"] },
  { id: "auditoria", label: "Auditoría", icon: "auditoria", perms: ["auditoria"] },
  { id: "plan",      label: "Mi plan",   icon: "facturacion" },
];

const Configuracion = ({
  user, perms, showToast, onClose, initialTab = "cajas",
}: {
  user: any; perms: string[]; showToast: (m: string, t: string) => void;
  onClose: () => void; initialTab?: TabId;
}) => {
  const [tab, setTab] = useState<TabId>(initialTab);

  // Si el usuario no puede ver una pestaña, se le manda a la primera que sí
  // pueda. Sin esto, un cajero que entre por deep-link a "usuarios" vería un
  // panel vacío en lugar de un mensaje.
  const visibles = TABS.filter(t => {
    if (t.roles && !t.roles.includes(user.role)) return false;
    if (t.perms && !t.perms.some(p => perms.includes(p))) return false;
    return true;
  });
  const activa = visibles.find(t => t.id === tab) || visibles[0];

  // En el teléfono las pestañas van arriba y se scrollean; en pantalla grande
  // van a la izquierda. Se decide por CSS, no por JavaScript, para que no
  // parpadee al rotar el dispositivo.
  const tabBtn = (t: typeof TABS[number]) => {
    const on = activa?.id === t.id;
    return (
      <button
        key={t.id}
        onClick={() => setTab(t.id)}
        aria-current={on ? "page" : undefined}
        className={`cfg-tab${on ? " cfg-tab-on" : ""}`}
      >
        <Icon name={t.icon as any} size={16} color={on ? "var(--brand)" : "var(--muted)"} />
        <span>{t.label}</span>
      </button>
    );
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <style>{`
        /* Todo el layout de las pestañas vive en CSS, no en estilos inline: un
           style="" gana a la media query y el paso a lateral en pantalla
           grande nunca ocurriría. Por eso aquí no hay flexDirection sueltos. */
        .cfg-wrap { display:flex; flex-direction:column; background:var(--card); width:100%; height:100%; }
        .cfg-split { display:flex; flex-direction:column; min-height:0; height:100%; }
        .cfg-tabs { display:flex; flex-direction:row; gap:4px; padding:8px; border-bottom:1px solid var(--line); overflow-x:auto; flex:0 0 auto; -webkit-overflow-scrolling:touch; }
        .cfg-tab { display:inline-flex; align-items:center; gap:7px; padding:9px 14px; border-radius:10px; border:1px solid transparent; background:none; cursor:pointer; font-size:13px; font-weight:600; color:var(--muted); white-space:nowrap; }
        .cfg-tab-on { background:var(--input-bg); border-color:var(--line); color:var(--brand); }
        .cfg-body { flex:1; overflow:auto; padding:18px 16px 28px; }
        @media (min-width: 860px) {
          .cfg-wrap { height:min(86vh, 760px); max-width:1040px; border-radius:16px; overflow:hidden; box-shadow:0 20px 60px rgba(15,23,42,0.25); }
          .cfg-split { flex-direction:row; }
          .cfg-tabs { flex-direction:column; border-bottom:none; border-right:1px solid var(--line); width:216px; padding:12px; gap:2px; overflow-y:auto; }
          .cfg-tab { width:100%; }
          .cfg-body { padding:24px 26px 30px; }
        }
      `}</style>

      <div className="cfg-wrap" onClick={e => e.stopPropagation()}>
        <div className="cfg-split">
          <nav className="cfg-tabs">{visibles.map(tabBtn)}</nav>

          <div className="cfg-body">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>
                {activa?.label}
              </h3>
              <button onClick={onClose} aria-label="Cerrar configuración" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}>
                <Icon name="close" size={18} />
              </button>
            </div>

            {activa?.id === "cajas" && <CajasAdmin showToast={showToast} />}

            {activa?.id === "caja" && <CajaSettings user={user} showToast={showToast} />}

            {activa?.id === "monedas" && (
              // CurrenciesSettings trae su propio pie de "Listo"; aquí el cierre
              // lo pone el modal, así que se le pasa un cierre vacío y quien
              // termina es el botón de la cabecera de arriba.
              <div style={{ margin: "-18px -16px -28px" }}>
                <CurrenciesSettings showToast={showToast} onClose={() => {}} embedded />
              </div>
            )}

            {activa?.id === "descuentos" && (
              <div style={{ margin: "-18px -16px -28px" }}>
                <DiscountsAdmin showToast={showToast} onClose={() => {}} embedded />
              </div>
            )}

            {activa?.id === "usuarios" && <Usuarios currentUser={user} showToast={showToast} embedded />}

            {activa?.id === "auditoria" && <Auditoria showToast={showToast} embedded />}

            {activa?.id === "plan" && (
              <div style={{ margin: "-18px -16px -28px" }}>
                <PlanModal user={user} onClose={() => setTab("caja")} embedded />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Configuracion;
