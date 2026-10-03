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

// ─── Los grupos de Configuración ───────────────────────────────────────────
//
// Antes eran siete pestañas dentro del modal. Ahora la barra de abajo ES la
// navegación de Configuración, y solo caben cinco cosas, así que las que son del
// mismo dominio van juntas: cajas con su cierre —las dos cosas son la caja— y
// usuarios con auditoría —quién puede hacer qué, y quién lo hizo—.
//
// Cada grupo con dos partes lleva un interruptor arriba para cambiar entre ellas
// sin bajar a la barra.
//
// EL GATE VA EN CADA PARTE Y NO EN EL GRUPO A PROPÓSITO: "Usuarios" es de admin y
// "Auditoría" no. Metidas en el mismo grupo las dos siguen teniendo que
// distinguirse — quien tenga permiso de auditoría ve el grupo con SU parte
// dentro, no un grupo entero que no puede abrir.
//
// ESTA TABLA TIENE QUE SEGUIR EN PARIDAD CON `ConfigGrupo.tsx` DEL MÓVIL: hay un
// test en cada repo que compara los gates de uno contra los del otro. Si se añade
// una sección aquí y no allí, el cajero la ve en un sitio y no en el otro.
export const GRUPOS: {
  id: string; label: string; icon: string;
  sub: { id: TabId; label: string; icon: string; roles?: string[]; perms?: string[] }[];
}[] = [
  {
    id: "caja", label: "Cajas y cierres", icon: "pos",
    sub: [
      { id: "cajas", label: "Cajas", icon: "pos", roles: ["admin"] },
      { id: "caja", label: "Cierre", icon: "cierre" },
    ],
  },
  {
    id: "monedas", label: "Monedas y tasas", icon: "contabilidad",
    sub: [
      { id: "monedas", label: "Monedas", icon: "contabilidad", roles: ["admin"] },
    ],
  },
  {
    id: "descuentos", label: "Descuentos", icon: "gift",
    sub: [
      { id: "descuentos", label: "Descuentos", icon: "gift", roles: ["admin"] },
    ],
  },
  {
    id: "acceso", label: "Usuarios y auditoría", icon: "usuarios",
    sub: [
      { id: "usuarios", label: "Usuarios", icon: "usuarios", roles: ["admin"] },
      { id: "auditoria", label: "Auditoría", icon: "auditoria", perms: ["auditoria"] },
    ],
  },
  {
    id: "plan", label: "Mi plan", icon: "facturacion",
    sub: [
      { id: "plan", label: "Mi plan", icon: "facturacion" },
    ],
  },
];

/** ¿Este usuario puede abrir esta parte? */
export const puede = (t: { roles?: string[]; perms?: string[] }, rol: string | undefined, perms: string[]) =>
  (!t.roles || t.roles.includes(rol || '')) && (!t.perms || t.perms.some(p => perms.includes(p)));

const Configuracion = ({
  user, perms, showToast, onClose, initialGrupo,
}: {
  user: any; perms: string[]; showToast: (m: string, t: string) => void;
  onClose: () => void;
  /** Qué grupo abre la barra al entrar. Si no cabe con el rol, se usa el primero. */
  initialGrupo?: string;
}) => {
  // El grupo activo y la parte activa dentro de él.
//
// El grupo lo elige la BARRA —`App` cambia los botones de abajo cuando entra en
// Configuración— y solo se guarda aquí la PARTE, que es lo que no pinta la barra.
// Por eso `grupoId` viene como prop y no se calcula aquí: dos listas que se
// puedan desincronizar acabarían mostrando una cosa yEnabled otra.
const [grupoId] = useState<string | null>(initialGrupo ?? null);
const [parte, setParte] = useState<TabId | null>(null);

// Un grupo con todas sus partes cerradas no aparece: un botón en la barra que no
// lleva a ningún sitio es peor que no tenerlo.
const visibles = GRUPOS
  .map(g => ({ ...g, sub: g.sub.filter(t => puede(t, user.role, perms)) }))
  .filter(g => g.sub.length > 0);

const grupo = visibles.find(g => g.id === grupoId) || visibles[0];

// Si la parte elegida no es visible —el usuario perdió el rol con la pantalla
// abierta— se cae a la primera que quede, en lugar de pintar un panel vacío.
const partes = grupo?.sub ?? [];
const activa = partes.find(t => t.id === parte) || partes[0];

// El interruptor entre las partes de un grupo. Solo aparece si el grupo tiene más
// de una: con una sola no hay nada que conmutar y sería ruido.
const parteBtn = (t: typeof partes[number]) => {
  const on = activa?.id === t.id;
  return (
    <button
      key={t.id}
      onClick={() => setParte(t.id)}
      aria-current={on ? "page" : undefined}
      className={`cfg-tab${on ? " cfg-tab-on" : ""}`}
    >
      <Icon name={t.icon as any} size={15} color={on ? "var(--brand)" : "var(--muted)"} />
      <span>{t.label}</span>
    </button>
  );
};


  return (
    // Pantalla, no modal: opaca y sin velo. Antes era una caja centrada sobre un
    // fondo a medias, y con la barra de abajo cambiando de contenido quedaba medio
    // modal y medio página. El zIndex va por encima del contenido pero POR DEBAJO de
    // la barra flotante, que se pinta desde el shell y tiene que quedar accesible.
    <div style={{ position: "fixed", inset: 0, background: "var(--bg)", zIndex: 900, display: "flex", flexDirection: "column" }}>
      <style>{`
        /* Todo el layout de las pestañas vive en CSS, no en estilos inline: un
           style="" gana a la media query y el paso a lateral en pantalla
           grande nunca ocurriría. Por eso aquí no hay flexDirection sueltos. */
        .cfg-wrap { display:flex; flex-direction:column; background:var(--card); width:100%; height:100%; }
        .cfg-split { display:flex; flex-direction:column; min-height:0; height:100%; }
        .cfg-tabs { display:flex; flex-direction:row; gap:4px; padding:8px; border-bottom:1px solid var(--line); overflow-x:auto; flex:0 0 auto; -webkit-overflow-scrolling:touch; }
        .cfg-tab { display:inline-flex; align-items:center; gap:7px; padding:9px 14px; border-radius:10px; border:1px solid transparent; background:none; cursor:pointer; font-size:13px; font-weight:600; color:var(--muted); white-space:nowrap; }
        .cfg-tab-on { background:var(--input-bg); border-color:var(--line); color:var(--brand); }
        .cfg-body { flex:1; overflow:auto; padding:18px 16px 96px; }
        @media (min-width: 860px) {
          .cfg-wrap { height:min(86vh, 760px); max-width:1040px; border-radius:16px; overflow:hidden; box-shadow:0 20px 60px rgba(15,23,42,0.25); }
          .cfg-split { flex-direction:row; }
          .cfg-tabs { flex-direction:column; border-bottom:none; border-right:1px solid var(--line); width:216px; padding:12px; gap:2px; overflow-y:auto; }
          .cfg-tab { width:100%; }
          .cfg-body { padding:24px 26px 30px; }
        }
      `}</style>

      <div className="cfg-wrap">
        <div className="cfg-split">
          {/* Solo hay interruptor si el grupo tiene más de una parte. La
              navegación entre grupos la hace la barra de abajo, no esta lista. */}
          {partes.length > 1 && (
            <nav className="cfg-tabs">{partes.map(parteBtn)}</nav>
          )}

          <div className="cfg-body">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>
                {activa?.label}
              </h3>
              {/* El cierre lo pone la cabecera global, con la chevron. */}
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
                <PlanModal user={user} onClose={() => setParte("caja")} embedded />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Configuracion;
