import { useEffect, useRef, useState, type ReactNode } from "react";
import Icon from "@/components/shared/Icon";
import { LegalModal } from "@/components/shared/LegalModal";
import { PRIVACY_POLICY_MD, TERMS_MD } from "@/legalContent";
import "./landing.css";

const LANDING_PLANS = [
  {
    key: "free",
    label: "Free",
    priceUSD: 0,
    tag: "Para empezar",
    audience: "Para probar CubaGest en tu negocio.",
    features: ["1 usuario", "Hasta 10 productos", "100 ventas al mes", "Reportes básicos"],
  },
  {
    key: "pro",
    label: "Pro",
    priceUSD: 5,
    tag: "El más elegido",
    audience: "Para comercios que ya están vendiendo.",
    features: ["3 usuarios", "Hasta 50 productos", "1.000 ventas al mes", "Cierre de caja e inventario", "Soporte prioritario"],
  },
  {
    key: "empresarial",
    label: "Empresarial",
    priceUSD: 10,
    tag: "Sin límites",
    audience: "Para equipos y negocios en crecimiento.",
    features: ["Usuarios ilimitados", "Productos y ventas ilimitados", "Roles y permisos avanzados", "Backup y exportación"],
  },
];

const LANDING_FEATURES = [
  { icon: "pos", eyebrow: "Ventas", title: "Vende sin internet", text: "El punto de venta guarda cada operación y la sincroniza cuando vuelve la conexión." },
  { icon: "inventario", eyebrow: "Inventario", title: "Sabe qué tienes y dónde está", text: "Controla el stock de tu almacén, tiendas y cajas desde un solo lugar." },
  { icon: "cierre", eyebrow: "Control", title: "Cierra cada día con confianza", text: "Cada cajero responde por su dinero y su mercancía, con una trazabilidad clara." },
  { icon: "facturacion", eyebrow: "Facturación", title: "Facturas listas para tu negocio", text: "Numeración consecutiva, clientes, descuentos y anulaciones con registro." },
  { icon: "contabilidad", eyebrow: "Números", title: "Entiende tu ganancia", text: "Registra gastos, revisa ingresos y conoce el resultado sin ser contador." },
  { icon: "usuarios", eyebrow: "Equipo", title: "Cada persona ve lo suyo", text: "Asigna roles para que cajeros, almacenistas y contadores trabajen con claridad." },
];

const FAQ_ITEMS = [
  { question: "¿CubaGest funciona sin internet?", answer: "Sí. El punto de venta puede registrar operaciones offline y sincronizarlas al recuperar la conexión." },
  { question: "¿Qué incluye la prueba gratis?", answer: "Puedes probar durante 30 días las funciones del plan Empresarial, sin tarjeta de crédito." },
  { question: "¿Cómo se paga el servicio?", answer: "Los planes se muestran en USD y puedes pagar con QvaPay cuando decidas continuar." },
  { question: "¿Puedo trabajar con varias ubicaciones?", answer: "Sí. El inventario y las operaciones pueden organizarse por almacén, tienda o caja." },
];

export const LOGO_URL = "/brand/logo.png";

export const BrandLogo = ({ size = 34 }: { size?: number }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="brand-logo-fallback" style={{ width: size, height: size, borderRadius: size * 0.3 }} aria-hidden="true">
        C
      </span>
    );
  }

  return (
    <img
      src={LOGO_URL}
      alt="CubaGest"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="brand-logo"
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
    />
  );
};

const CtaButton = ({ onClick, children, big = false, variant = "primary" }: {
  onClick: () => void;
  children: ReactNode;
  big?: boolean;
  variant?: "primary" | "secondary" | "light";
}) => (
  <button type="button" onClick={onClick} className={`landing-button landing-button--${variant}${big ? " landing-button--large" : ""}`}>
    {children}
  </button>
);

export const PHONE_SCREENSHOT_URL = "/brand/app-screenshot.png";

const IPhoneMockup = () => {
  const [screenshotMissing, setScreenshotMissing] = useState(false);

  return (
    <div className="landing-iphone-stage">
      <div className="landing-iphone" aria-label="Vista de CubaGest en un iPhone">
        <span className="landing-iphone__side-button landing-iphone__side-button--silent" aria-hidden="true" />
        <span className="landing-iphone__side-button landing-iphone__side-button--volume-one" aria-hidden="true" />
        <span className="landing-iphone__side-button landing-iphone__side-button--volume-two" aria-hidden="true" />
        <span className="landing-iphone__side-button landing-iphone__side-button--power" aria-hidden="true" />
        <div className="landing-iphone__screen">
          <div className="landing-iphone__dynamic-island" aria-hidden="true" />
          {screenshotMissing ? (
            <div className="landing-iphone-placeholder">
              <BrandLogo size={42} />
              <strong>Agrega tu captura de la app</strong>
              <span>public/brand/app-screenshot.png</span>
            </div>
          ) : (
            <img
              src={PHONE_SCREENSHOT_URL}
              alt="CubaGest en uso desde un iPhone"
              onError={() => setScreenshotMissing(true)}
            />
          )}
        </div>
      </div>
      <div className="landing-iphone__shadow" aria-hidden="true" />
    </div>
  );
};

const Landing = ({ onEnter }: { onEnter: () => void }) => {
  const [legal, setLegal] = useState<null | "privacy" | "terms">(null);
  const [contactOpen, setContactOpen] = useState(false);
  const contactCloseRef = useRef<HTMLButtonElement>(null);

  const goId = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (!contactOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContactOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    contactCloseRef.current?.focus();
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contactOpen]);

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <div className="landing-container landing-nav__inner">
          <button type="button" className="landing-brand" onClick={() => goId("inicio")} aria-label="Volver al inicio">
            <BrandLogo size={36} />
            <span>CubaGest</span>
          </button>

          <nav className="landing-nav__links" aria-label="Navegación principal">
            <button type="button" onClick={() => goId("producto")}>Producto</button>
            <button type="button" onClick={() => goId("como-funciona")}>Cómo funciona</button>
            <button type="button" onClick={() => goId("precios")}>Precios</button>
            <button type="button" onClick={() => goId("preguntas")}>Preguntas</button>
          </nav>

          <div className="landing-nav__actions">
            <button type="button" className="landing-nav__login" onClick={onEnter}>Iniciar sesión</button>
            <CtaButton onClick={onEnter}>Probar gratis</CtaButton>
          </div>
        </div>
      </header>

      <main>
        <section id="inicio" className="landing-hero">
          <div className="landing-hero__orb landing-hero__orb--one" aria-hidden="true" />
          <div className="landing-hero__orb landing-hero__orb--two" aria-hidden="true" />
          <div className="landing-container landing-hero__inner">
            <div className="landing-hero__copy">
              <div className="landing-eyebrow landing-eyebrow--hero">
                <span className="landing-eyebrow__dot" aria-hidden="true" />
                Gestión offline para negocios cubanos
              </div>
              <h1>Vende y controla tu negocio, incluso cuando falla internet.</h1>
              <p className="landing-hero__lead">
                Punto de venta, inventario, facturación y contabilidad en una sola app, diseñada para trabajar con la realidad de tu negocio.
              </p>
              <div className="landing-hero__actions">
                <CtaButton onClick={onEnter} big>Crear mi negocio gratis</CtaButton>
                <CtaButton onClick={() => goId("producto")} big variant="secondary">Ver cómo funciona <span aria-hidden="true">↗</span></CtaButton>
              </div>
              <div className="landing-hero__proof" aria-label="Detalles de la prueba">
                <span><Icon name="check" size={15} color="currentColor" /> Sin tarjeta</span>
                <span><Icon name="check" size={15} color="currentColor" /> 30 días completos</span>
                <span><Icon name="check" size={15} color="currentColor" /> Pago con QvaPay</span>
              </div>
            </div>

            <div className="landing-hero__visual" aria-label="Vista de la experiencia CubaGest">
              <IPhoneMockup />
            </div>
          </div>
        </section>

        <section className="landing-trust" aria-label="Características de CubaGest">
          <div className="landing-container landing-trust__inner">
            <span className="landing-trust__intro">Hecha para la forma real de trabajar de los comercios cubanos</span>
            <span><Icon name="check" size={16} color="currentColor" /> Funciona sin VPN</span>
            <span><Icon name="check" size={16} color="currentColor" /> Diseñada para conectividad intermitente</span>
            <span><Icon name="check" size={16} color="currentColor" /> Desde el celular o la computadora</span>
          </div>
        </section>

        <section id="producto" className="landing-section landing-section--soft">
          <div className="landing-container">
            <div className="landing-section-heading">
              <span className="landing-eyebrow">Una operación más clara</span>
              <h2>Todo lo importante de tu negocio, en el mismo lugar.</h2>
              <p>Menos cuadernos, menos suposiciones y más control sobre cada venta.</p>
            </div>

            <div className="landing-outcomes">
              {LANDING_FEATURES.slice(0, 3).map((feature, index) => (
                <article key={feature.title} className={`landing-outcome landing-outcome--${index + 1}`}>
                  <div className="landing-icon-box"><Icon name={feature.icon} size={22} color="currentColor" /></div>
                  <span className="landing-card-eyebrow">{feature.eyebrow}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                  <button type="button" className="landing-card-link" onClick={() => goId("como-funciona")}>Conoce esta función <span aria-hidden="true">↗</span></button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="landing-section landing-section--white">
          <div className="landing-container">
            <div className="landing-section-heading landing-section-heading--compact">
              <span className="landing-eyebrow">Empieza en minutos</span>
              <h2>De tu primera cuenta a tu primera factura.</h2>
              <p>Un flujo simple para que puedas concentrarte en atender a tus clientes.</p>
            </div>

            <div className="landing-steps">
              {[
                { number: "01", title: "Crea tu cuenta", text: "Registra tu negocio y empieza con 30 días del plan completo." },
                { number: "02", title: "Agrega tus productos", text: "Carga precios y existencias por ubicación, sin complicaciones." },
                { number: "03", title: "Vende y crece", text: "Cobra, factura y entiende tus números con o sin conexión." },
              ].map((step) => (
                <article key={step.number} className="landing-step">
                  <span className="landing-step__number">{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--soft landing-capabilities">
          <div className="landing-container">
            <div className="landing-section-heading landing-section-heading--compact">
              <span className="landing-eyebrow">Más control, menos trabajo manual</span>
              <h2>Las herramientas que tu equipo necesita para avanzar.</h2>
            </div>
            <div className="landing-capability-grid">
              {LANDING_FEATURES.slice(3).map((feature) => (
                <article key={feature.title} className="landing-capability">
                  <div className="landing-capability__icon"><Icon name={feature.icon} size={20} color="currentColor" /></div>
                  <div><span className="landing-card-eyebrow">{feature.eyebrow}</span><h3>{feature.title}</h3><p>{feature.text}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="precios" className="landing-section landing-section--white">
          <div className="landing-container">
            <div className="landing-section-heading">
              <span className="landing-eyebrow">Precios simples</span>
              <h2>Empieza gratis. Crece cuando estés listo.</h2>
              <p>Sin contratos largos, sin cargos sorpresa. Todos los precios están en USD.</p>
            </div>

            <div className="landing-plans">
              {LANDING_PLANS.map((plan) => (
                <article key={plan.key} className={`landing-plan${plan.key === "pro" ? " landing-plan--featured" : ""}`}>
                  {plan.key === "pro" && <span className="landing-plan__badge">{plan.tag}</span>}
                  <div className="landing-plan__header">
                    <div><h3>{plan.label}</h3><span>{plan.key === "pro" ? "Para negocios en movimiento" : plan.tag}</span></div>
                    <div className="landing-plan__price">${plan.priceUSD}<small>/mes</small></div>
                  </div>
                  <p className="landing-plan__audience">{plan.audience}</p>
                  <div className="landing-plan__features">
                    {plan.features.map((feature) => <span key={feature}><Icon name="check" size={15} color="currentColor" /> {feature}</span>)}
                  </div>
                  <button type="button" className="landing-plan__button" onClick={onEnter}>{plan.priceUSD === 0 ? "Empezar gratis" : "Elegir plan"}</button>
                </article>
              ))}
            </div>
            <p className="landing-pricing-note">Prueba el plan Empresarial durante 30 días. No necesitas tarjeta para comenzar.</p>
          </div>
        </section>

        <section id="preguntas" className="landing-section landing-section--soft landing-faq">
          <div className="landing-container landing-faq__inner">
            <div className="landing-section-heading landing-section-heading--left">
              <span className="landing-eyebrow">Preguntas frecuentes</span>
              <h2>Antes de empezar, aclaremos lo importante.</h2>
              <p>Si todavía tienes dudas, nuestro equipo está listo para ayudarte.</p>
              <button type="button" className="landing-text-button" onClick={() => setContactOpen(true)}>Hablar con el equipo <span aria-hidden="true">↗</span></button>
            </div>
            <div className="landing-faq__list">
              {FAQ_ITEMS.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}<span aria-hidden="true">+</span></summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-final-cta">
          <div className="landing-final-cta__orb" aria-hidden="true" />
          <div className="landing-container landing-final-cta__inner">
            <div><span className="landing-eyebrow landing-eyebrow--hero">Tu negocio merece más claridad</span><h2>Empieza a trabajar con más control hoy.</h2></div>
            <div className="landing-final-cta__action"><p>30 días del plan completo. Sin tarjeta. Sin complicaciones.</p><CtaButton onClick={onEnter} big variant="light">Crear mi negocio gratis <span aria-hidden="true">↗</span></CtaButton></div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer__inner">
          <div className="landing-footer__brand"><BrandLogo size={34} /><div><strong>CubaGest</strong><span>Sistema de gestión para negocios cubanos.</span></div></div>
          <div className="landing-footer__links">
            <button type="button" onClick={() => setContactOpen(true)}>Contáctenos</button>
            <button type="button" onClick={() => setLegal("terms")}>Términos y condiciones</button>
            <button type="button" onClick={() => setLegal("privacy")}>Política de privacidad</button>
          </div>
          <div className="landing-footer__meta">© {new Date().getFullYear()} CubaGest</div>
        </div>
      </footer>

      {contactOpen && (
        <div className="landing-modal-backdrop" role="presentation" onMouseDown={() => setContactOpen(false)}>
          <div className="landing-modal" role="dialog" aria-modal="true" aria-labelledby="contact-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="landing-modal__header"><div><span className="landing-eyebrow">Estamos para ayudarte</span><h2 id="contact-title">Contáctenos</h2></div><button ref={contactCloseRef} type="button" className="landing-modal__close" onClick={() => setContactOpen(false)} aria-label="Cerrar contacto"><Icon name="close" size={18} color="currentColor" /></button></div>
            <p className="landing-modal__intro">¿Dudas antes de empezar o necesitas ayuda con tu negocio? Escríbenos, respondemos rápido.</p>
            <div className="landing-modal__options">
              <a href="mailto:soporte@cubagest.dpdns.org"><span className="landing-modal__option-icon"><Icon name="doc" size={18} color="currentColor" /></span><span><small>Correo</small><strong>soporte@cubagest.dpdns.org</strong></span></a>
              <a href="https://wa.me/5350000000" target="_blank" rel="noreferrer"><span className="landing-modal__option-icon landing-modal__option-icon--green"><Icon name="usuarios" size={18} color="currentColor" /></span><span><small>WhatsApp</small><strong>+53 5 000 0000</strong></span></a>
            </div>
            <p className="landing-modal__hours">Atención de lunes a sábado, 8:00–18:00</p>
          </div>
        </div>
      )}

      {legal === "terms" && <LegalModal title="Términos y Condiciones" content={TERMS_MD} onClose={() => setLegal(null)} />}
      {legal === "privacy" && <LegalModal title="Política de Privacidad" content={PRIVACY_POLICY_MD} onClose={() => setLegal(null)} />}
    </div>
  );
};

export default Landing;
