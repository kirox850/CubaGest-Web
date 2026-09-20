import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import PlatformApp from "./platform/PlatformApp";
import "./index.css";

// /panel es la puerta del super-admin: componente aparte, sin enlaces desde
// la app normal ni del landing. (Cloudflare Access añade su login delante.)
const path = window.location.pathname;
const isPanel = path === "/panel" || path.startsWith("/panel/");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isPanel ? <PlatformApp /> : <App />}
  </StrictMode>
);
