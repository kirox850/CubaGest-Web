import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { fmt } from "@/lib/format";
import Icon from "@/components/shared/Icon";
import { Spinner, btn, sel } from "@/components/shared/primitives";

// ─── AUDITORÍA ────────────────────────────────────────────────────────────────
// Convierte cada entrada de auditoría en UNA frase simple, para gente sin
// background técnico — nada de códigos ("product.create") ni JSON crudo.
function describeAuditLog(log: any): string {
  const d = log.detail || {};
  const who = log.userName || "Alguien";
  switch (log.action) {
    case "product.create":
      return `${who} creó el producto "${d.name}"${d.initialStock ? ` con ${d.initialStock} unidades iniciales en el Almacén Central` : ""}`;
    case "product.update":
      return `${who} editó el producto "${d.before?.name || "—"}"`;
    case "product.deactivate":
      return `${who} desactivó el producto "${d.name}"`;
    case "product.reactivate":
      return `${who} reactivó el producto "${d.name}"`;
    case "location.adjust_stock":
      return `${who} registró ${d.type === "entrada" ? "una entrada" : "una salida"} de ${d.qty} de "${d.productName}" en ${d.locationName}${d.reason ? ` — ${d.reason}` : ""}`;
    case "location.auto_return_stock":
      return `Se devolvieron automáticamente ${d.itemsReturned} producto(s) al Almacén Central al ${d.reason === "user_deactivated" ? "dar de baja" : "cambiar el rol"} a ${d.user}`;
    case "transfer.create":
      return `${who} creó un envío de ${d.from} hacia ${d.to} (${(d.items || []).length} producto(s))`;
    case "transfer.approve":
      return `${who} aprobó un envío (${(d.items || []).length} producto(s)) — el stock ya se movió`;
    case "transfer.reject":
      return `${who} rechazó un envío${d.reason ? `: ${d.reason}` : ""}`;
    case "transfer.cancel":
      return `${who} canceló un envío pendiente`;
    case "user.create":
      return `${who} creó al usuario "${d.name}" con rol ${d.role}`;
    case "user.update":
      return `${who} editó al usuario "${d.before?.name || "—"}"`;
    case "user.deactivate":
      return `${who} dio de baja a "${d.name}"`;
    case "user.resend_password_link":
      return `${who} generó un nuevo link de contraseña para "${d.name}"`;
    case "sale.void":
      return `${who} anuló la factura ${d.invoiceNumber} (por $${fmt(d.total)})`;
    case "expense.create":
      return `${who} registró un gasto: "${d.concept}" por $${fmt(d.amount)}`;
    case "expense.update":
      return `${who} editó el gasto "${d.before?.concept || "—"}"`;
    case "expense.delete":
      return `${who} eliminó el gasto "${d.concept}" ($${fmt(d.amount)})`;
    case "closing.take_reading":
      return `${who} tomó una lectura de inventario en ${d.locationName}`;
    case "closing.confirm":
      return `${who} confirmó un cierre de caja — ingreso total $${fmt(d.totalIncome)}${d.hasShortage ? " (con faltantes)" : ""}`;
    default:
      return `${who} realizó una acción (${log.action})`;
  }
}

const AUDIT_ENTITY_ICON: Record<string,string> = {
  product: "inventario", location_stock: "warehouse", stock_transfer: "transferencias",
  inventory_location: "warehouse", user: "usuarios", sale: "facturacion",
  expense: "contabilidad", cash_closing: "cierre", inventory_reading: "cierre",
};

const Auditoria = ({ showToast }: { showToast: (m:string,t:string)=>void }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState("");

  const ENTITY_LABELS: Record<string,string> = {
    product: "Productos", location_stock: "Ajustes de stock", stock_transfer: "Envíos",
    inventory_location: "Ubicaciones", user: "Usuarios", sale: "Ventas",
    expense: "Gastos", cash_closing: "Cierres de caja", inventory_reading: "Lecturas de inventario",
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      if (filterEntity) qs.set("entity", filterEntity);
      const rows = await apiFetch(`/audit?${qs.toString()}`);
      setLogs(rows);
    } catch (e:any) { showToast(e.message, "error"); }
    finally { setLoading(false); }
  }, [filterEntity]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div>
        <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:800, color:"var(--ink)" }}>Auditoría</h2>
        <p style={{ margin:0, fontSize:14, color:"var(--muted)" }}>Registro de todo lo que ha pasado en el sistema — visible para todo el equipo</p>
      </div>

      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        <select style={{...sel, width:"auto"}} value={filterEntity} onChange={e=>setFilterEntity(e.target.value)}>
          <option value="">Todo</option>
          {Object.entries(ENTITY_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}
        </select>
        <button style={btn("secondary")} onClick={load}><Icon name="refresh" size={15}/>Actualizar</button>
      </div>

      {loading ? <Spinner/> : logs.length === 0 ? (
        <div style={{ textAlign:"center", padding:40, color:"var(--muted)", fontSize:14, background:"var(--card)", borderRadius:16, border:"1px solid var(--line)" }}>No hay registros con estos filtros</div>
      ) : (
        <div style={{ background:"var(--card)", borderRadius:16, border:"1px solid var(--line)", overflow:"hidden" }}>
          {logs.map((log:any, idx:number) => (
            <div key={log.id} style={{ display:"flex", gap:12, alignItems:"flex-start", padding:"14px 16px", borderTop: idx===0?"none":"1px solid var(--line)" }}>
              <div style={{ width:34, height:34, borderRadius:10, background:"var(--input-bg)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Icon name={AUDIT_ENTITY_ICON[log.entity] || "doc"} size={16} color="#5a3a1a"/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ margin:0, fontSize:13.5, color:"var(--ink)", lineHeight:1.5 }}>{describeAuditLog(log)}</p>
                <p style={{ margin:"4px 0 0", fontSize:12, color:"var(--muted)" }}>{new Date(log.createdAt).toLocaleString("es-CU")}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Auditoria;
