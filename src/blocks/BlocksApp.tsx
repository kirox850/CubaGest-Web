// Sandbox /blocks — catálogo de los bloques shadcn replicados.
// Rutas: #/blocks (catálogo), #/blocks/dashboard, #/blocks/sidebar,
// #/blocks/login, #/blocks/signup. Aislado de la app normal.
import * as React from "react";
import "./blocks.css";

import Dashboard01Page from "./blocks/dashboard-01/page";
import Sidebar01Page from "./blocks/sidebar-01/page";
import Login02Page from "./blocks/login-02/page";
import Signup02Page from "./blocks/signup-02/page";

type Route = "home" | "dashboard" | "sidebar" | "login" | "signup";

function parseRoute(): Route {
  const h = window.location.hash;
  if (h.includes("/blocks/dashboard")) return "dashboard";
  if (h.includes("/blocks/sidebar")) return "sidebar";
  if (h.includes("/blocks/login")) return "login";
  if (h.includes("/blocks/signup")) return "signup";
  return "home";
}

const items: {
  route: Route;
  name: string;
  desc: string;
  cats: string;
}[] = [
  {
    route: "dashboard",
    name: "dashboard-01",
    desc: "A dashboard with sidebar, charts and data table.",
    cats: "dashboard",
  },
  {
    route: "sidebar",
    name: "sidebar-01",
    desc: "A simple sidebar with navigation grouped by section.",
    cats: "sidebar, dashboard",
  },
  {
    route: "login",
    name: "login-02",
    desc: "A two column login page with a cover image.",
    cats: "authentication, login",
  },
  {
    route: "signup",
    name: "signup-02",
    desc: "A two column signup page with a cover image.",
    cats: "authentication, signup",
  },
];

const cardStyle: React.CSSProperties = {
  textAlign: "left",
  cursor: "pointer",
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 14,
  padding: "18px 20px",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  transition: "transform .15s ease, box-shadow .15s ease, border-color .15s ease",
};

export default function BlocksApp() {
  const [route, setRoute] = React.useState<Route>(parseRoute);
  const [dark, setDark] = React.useState(
    document.documentElement.classList.contains("dark")
  );

  React.useEffect(() => {
    const onHash = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  }

  if (route !== "home") {
    const Page =
      route === "dashboard"
        ? Dashboard01Page
        : route === "sidebar"
          ? Sidebar01Page
          : route === "login"
            ? Login02Page
            : Signup02Page;
    return (
      <>
        <a
          href="#/blocks"
          style={{
            position: "fixed",
            bottom: 14,
            left: 14,
            zIndex: 100,
            background: "var(--card)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
            borderRadius: 999,
            padding: "7px 14px",
            fontSize: 12.5,
            fontWeight: 600,
            textDecoration: "none",
            boxShadow: "0 4px 14px rgba(0,0,0,.18)",
          }}
        >
          ← Bloques
        </a>
        <Page />
      </>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div
        style={{
          maxWidth: 860,
          margin: "0 auto",
          padding: "48px 20px 80px",
          color: "var(--ink)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: "#3b82f6",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            C
          </div>
          <span style={{ fontWeight: 700 }}>CubaGest</span>
          <span
            style={{
              fontSize: 12,
              border: "1px solid var(--line)",
              borderRadius: 999,
              padding: "2px 10px",
              color: "var(--muted)",
            }}
          >
            sandbox
          </span>
          <button
            onClick={toggleTheme}
            style={{
              marginLeft: "auto",
              background: "var(--card)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {dark ? "☀️ Claro" : "🌙 Oscuro"}
          </button>
        </div>

        <h1 style={{ fontSize: 30, fontWeight: 800, margin: "28px 0 6px" }}>
          Bloques shadcn/ui
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: 28 }}>
          Réplicas de los bloques oficiales, adaptadas al tema de CubaGest.
          Datos de demostración — nada de esto toca la app ni el backend.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          {items.map((it) => (
            <a
              key={it.name}
              href={`#/blocks/${it.route}`}
              style={{ textDecoration: "none" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 22px rgba(0,0,0,.12)";
                e.currentTarget.style.borderColor = "#3b82f6";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow = "";
                e.currentTarget.style.borderColor = "var(--line)";
              }}
            >
              <div style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong style={{ fontSize: 16 }}>{it.name}</strong>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 11.5,
                      color: "var(--muted)",
                    }}
                  >
                    {it.cats}
                  </span>
                </div>
                <span style={{ fontSize: 13.5, color: "var(--muted)" }}>
                  {it.desc}
                </span>
              </div>
            </a>
          ))}
        </div>

        <p style={{ marginTop: 32, fontSize: 13, color: "var(--muted)" }}>
          <a href="/" style={{ color: "#3b82f6" }}>
            ← Volver a la app
          </a>
        </p>
      </div>
    </div>
  );
}
