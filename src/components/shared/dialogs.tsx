import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { btn } from "./primitives";

// ─── DIÁLOGOS GLOBALES (reemplaza alert()/confirm() nativos del navegador) ────
type DialogState =
  | { kind: "alert"; message: string }
  | { kind: "confirm"; message: string; resolve: (ok: boolean) => void }
  | null;

let _setDialog: Dispatch<SetStateAction<DialogState>> | null = null;

// Sustituto de window.alert(): no bloquea, se cierra con "Aceptar".
export function showAlert(message: string) {
  _setDialog?.({ kind: "alert", message });
}

// Sustituto de window.confirm(): usar con `await`. Resuelve true/false
// según el botón que pulse el usuario, igual que el confirm() nativo.
export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    _setDialog?.({ kind: "confirm", message, resolve });
  });
}

// Se monta una única vez en el componente raíz (<App/>).
export const DialogHost = () => {
  const [dialog, setDialog] = useState<DialogState>(null);
  useEffect(() => {
    _setDialog = setDialog;
    return () => { _setDialog = null; };
  }, []);

  if (!dialog) return null;

  const finish = (ok: boolean) => {
    if (dialog.kind === "confirm") dialog.resolve(ok);
    setDialog(null);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}
      onClick={() => finish(false)}>
      <div style={{ background: "var(--card)", borderRadius: 16, padding: 22, maxWidth: 380, width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ whiteSpace: "pre-wrap", fontSize: 15, color: "var(--ink)", lineHeight: 1.5, marginBottom: 20 }}>
          {dialog.message}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {dialog.kind === "confirm" && (
            <button style={btn("secondary")} onClick={() => finish(false)}>Cancelar</button>
          )}
          <button style={btn("primary")} onClick={() => finish(true)} autoFocus>
            {dialog.kind === "confirm" ? "Confirmar" : "Aceptar"}
          </button>
        </div>
      </div>
    </div>
  );
};
