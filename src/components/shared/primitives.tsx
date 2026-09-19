import { useEffect } from "react";
import type { ReactNode, CSSProperties } from "react";
import Icon from "./Icon";

// ─── PRIMITIVAS DE UI (tema-aware) ────────────────────────────────────────────
// Las tres primitivas que usa TODA la app ahora leen variables CSS, así que
// el modo oscuro las cubre automáticamente sin tocar las pantallas.

export const inp: CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1px solid var(--input-border)", borderRadius: 12,
  fontSize: 14, color: "var(--ink)", background: "var(--input-bg)", boxSizing: "border-box" as const,
  outline: "none", fontFamily: "inherit",
};
export const sel: CSSProperties = { ...inp };
export const btn = (variant = "primary"): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 12,
  fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none", transition: "all 0.15s",
  ...(variant === "primary"   ? { background: "#3B82F6", color: "#ffffff" } :
      variant === "secondary" ? { background: "var(--input-bg)", color: "var(--ink)", border: "1px solid var(--input-border)" } :
      variant === "ghost"     ? { background: "none", color: "#3B82F6" } :
      variant === "danger"    ? { background: "rgba(220,38,38,0.10)", color: "#DC2626", border: "1px solid rgba(220,38,38,0.35)" } : {}),
});

// ─── TOAST ────────────────────────────────────────────────────────────────────
export const Toast = ({ msg, type, onClose }: { msg: string; type: string; onClose: () => void }) => {
  useEffect(() => { const t = setTimeout(onClose, 3200); return () => clearTimeout(t); }, []);
  const colors: Record<string, string> = { success: "#10B981", error: "#DC2626", info: "#3B82F6", warning: "#C2410C" };
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, background: colors[type] || colors.info, color: "#ffffff", padding: "12px 20px", borderRadius: 12, maxWidth: 340, boxShadow: "0 4px 20px rgba(0,0,0,0.25)", display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 500 }}>
      {msg}
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#ffffff", cursor: "pointer", marginLeft: "auto", opacity: 0.8 }}><Icon name="close" size={14} /></button>
    </div>
  );
};

// ─── MODAL ────────────────────────────────────────────────────────────────────
export const Modal = ({ title, onClose, children, width = 560 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={e => e.target === e.currentTarget && onClose()}>
    <div style={{ background: "var(--card)", borderRadius: 16, width: "100%", maxWidth: width, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(15,23,42,0.2)" }}>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "var(--card)", zIndex: 1 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>{title}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}><Icon name="close" size={18} /></button>
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  </div>
);

// ─── OFFLINE BANNER ──────────────────────────────────────────────────────────
export const OfflineBanner = ({ online, syncing, pending, conflicts }: { online: boolean; syncing: boolean; pending: number; conflicts: number }) => {
  if (online && !syncing && pending === 0 && conflicts === 0) return null;

  const bg = !online ? "#8B1A1A" : syncing ? "#1A5C8B" : conflicts > 0 ? "#c17a00" : "#1A7A3C";
  const msg = !online
    ? `Sin conexión — modo offline${pending > 0 ? ` · ${pending} ventas en cola` : ""}`
    : syncing
    ? "Sincronizando ventas..."
    : conflicts > 0
    ? `${conflicts} venta(s) con conflicto — revisa en Facturas`
    : `✓ ${pending === 0 ? "Todo sincronizado" : `${pending} pendientes`}`;

  return (
    <div style={{ background: bg, color: "#fff", padding: "8px 16px", fontSize: 12, fontWeight: 600, textAlign: "center" as any, flexShrink: 0 }}>
      {msg}
    </div>
  );
};

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────
export const Badge = ({ label, color = "#3B82F6", bg }: { label: string; color?: string; bg?: string }) => (
  <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, color, background: bg || color + "20", letterSpacing: "0.3px" }}>{label}</span>
);

export const Field = ({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.5px", textTransform: "uppercase" }}>{label}{required && <span style={{ color: "#3B82F6" }}> *</span>}</label>
    {children}
  </div>
);

export const Spinner = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
    <div style={{ width: 32, height: 32, border: "3px solid var(--line)", borderTopColor: "#3B82F6", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
  </div>
);
