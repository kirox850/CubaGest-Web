import { btn } from "./primitives";
import Icon from "./Icon";

// ─── MODAL DE DOCUMENTOS LEGALES (Política de Privacidad / Términos) ─────────
// Parser de markdown minimalista: solo soporta lo que usan estos documentos
// (encabezados #/##/###, listas "- ", negrita **texto** y párrafos). No se
// instaló ninguna librería externa para esto.
function renderLegalMarkdown(md: string): JSX.Element[] {
  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
    );
  };

  const lines = md.split("\n");
  const blocks: JSX.Element[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} style={{ margin: "4px 0 12px", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
        {listBuffer.map((item, i) => <li key={i} style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.5 }}>{renderInline(item)}</li>)}
      </ul>
    );
    listBuffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("- ")) { listBuffer.push(line.slice(2)); continue; }
    flushList();
    if (!line) continue;
    if (line.startsWith("### ")) blocks.push(<h4 key={blocks.length} style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", margin: "14px 0 4px" }}>{renderInline(line.slice(4))}</h4>);
    else if (line.startsWith("## ")) blocks.push(<h3 key={blocks.length} style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", margin: "18px 0 6px" }}>{renderInline(line.slice(3))}</h3>);
    else if (line.startsWith("# ")) blocks.push(<h2 key={blocks.length} style={{ fontSize: 19, fontWeight: 800, color: "var(--ink)", margin: "0 0 8px" }}>{renderInline(line.slice(2))}</h2>);
    else blocks.push(<p key={blocks.length} style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.6, margin: "4px 0" }}>{renderInline(line)}</p>);
  }
  flushList();
  return blocks;
}

export const LegalModal = ({ title, content, onClose }: { title: string; content: string; onClose: () => void }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: 16 }} onClick={onClose}>
    <div style={{ background: "var(--card)", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{title}</h2>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Icon name="close" size={20} color="var(--muted)" /></button>
      </div>
      <div style={{ padding: "16px 20px", overflowY: "auto" as any }}>
        {renderLegalMarkdown(content)}
      </div>
      <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)" }}>
        <button onClick={onClose} style={{ ...btn("primary"), width: "100%" }}>Cerrar</button>
      </div>
    </div>
  </div>
);
