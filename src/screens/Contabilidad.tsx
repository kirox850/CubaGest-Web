import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { fmt, today } from "@/lib/format";
import { PAY_METHODS, EXPENSE_CATS, CURRENCY_SYMBOLS } from "@/config/constants";
import Icon from "@/components/shared/Icon";
import { Modal, Badge, Field, Spinner, btn, inp, sel } from "@/components/shared/primitives";

// Impresión: solo el recibo visible, con ancho de ticket.
const contStyles = `
@media print {
  body * { visibility: hidden !important; }
  .cg-receipt-print-area, .cg-receipt-print-area * { visibility: visible !important; }
  .cg-receipt-print-area {
    position: fixed !important; top: 0; left: 0; right: 0;
    width: 80mm !important; margin: 0 auto !important;
    background: #fff !important; color: #000 !important;
    border: none !important; box-shadow: none !important;
  }
}
`;

// Impresión del informe fiscal: solo el informe, ancho completo.
const contPrintStyles = `
@media print {
  body * { visibility: hidden !important; }
  .cg-informe-print, .cg-informe-print * { visibility: visible !important; }
  .cg-informe-print {
    position: fixed !important; top: 0; left: 0; right: 0;
    width: 100% !important; max-width: 100% !important; margin: 0 !important;
    background: #fff !important; color: #000 !important;
    border: none !important; box-shadow: none !important;
  }
}
`;

const thStyle = { textAlign:"left" as any, fontSize:11, textTransform:"uppercase" as any, color:"var(--muted)", padding:"8px 0", borderBottom:"2px solid var(--line)" };
const tdStyle = { padding:"9px 0", borderBottom:"1px solid var(--line)", fontSize:14 };

// ─── CONTABILIDAD ─────────────────────────────────────────────────────────────
const Contabilidad = ({ user, showToast }: { user: any; showToast: (m:string,t:string)=>void }) => {
  const [sales, setSales]       = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("ingresos");
  const [modal, setModal]       = useState(false);
  const [viewInv, setViewInv]   = useState<any>(null);  const [form, setForm]       = useState({ date:today(), concept:"", amount:"", category:"Compras", method:"efectivo" });
  const [saving, setSaving]     = useState(false);
  // El informe fiscal se muestra como capa a pantalla completa DENTRO de la
  // pantalla (no en una pestaña nueva): siempre se puede volver con "Volver".
  const [showInforme, setShowInforme] = useState(false);

  const load = useCallback(async()=>{
    try {
      setLoading(true);
      const [s,e] = await Promise.all([apiFetch("/sales"), apiFetch("/accounting/expenses")]);
      setSales(s); setExpenses(e);
    } catch(err:any) { showToast(err.message,"error"); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{ load(); },[load]);

  const totalIncome = sales.filter(s=>s.status==="emitida").reduce((a,s)=>a+Number(s.total),0);
  const totalExp    = expenses.reduce((a,e)=>a+Number(e.amount),0);
  const net         = totalIncome - totalExp;

  const exportarInforme = () => {
    const TAX_RATE = 0.10;
    const totalIncome = sales.filter((s:any)=>s.status==="emitida").reduce((a:number,s:any)=>a+Number(s.total),0);
    const totalExp    = expenses.reduce((a:number,e:any)=>a+Number(e.amount),0);
    const totalTax    = Math.round(totalIncome * TAX_RATE);
    const net         = totalIncome - totalExp;
    const mes = new Date().toLocaleString("es-CU",{month:"long",year:"numeric"});
    return { mes, totalIncome, totalExp, totalTax, net };
  };

  // Datos calculados UNA vez por render del informe (la capa se monta solo
  // cuando showInforme=true, así los números no se recalculan en cada tick).
  const informe = showInforme ? buildInforme() : null;

  const addExpense = async()=>{
    if (!form.concept||!form.amount) return showToast("Complete los campos requeridos","error");
    setSaving(true);
    try {
      await apiFetch("/accounting/expenses", { method:"POST", body:{ ...form, amount:Number(form.amount) }});
      showToast("Gasto registrado","success");
      setModal(false);
      setForm({ date:today(), concept:"", amount:"", category:"Compras", method:"efectivo" });
      load();
    } catch(e:any) { showToast(e.message,"error"); }
    finally { setSaving(false); }
  };

  if (loading) return <Spinner/>;

  // ── Capa del Informe Fiscal (pantalla completa dentro del módulo) ──
  // En el teléfono el ancho es el del propio dispositivo, así nunca hay
  // scroll horizontal. Se sale con "← Volver" (o imprimiendo).
  if (showInforme && informe) {
    const { mes, totalIncome: ti, totalExp: te, net: nt } = informe as any;
    return (
      <div style={{ minHeight:"100%", background:"var(--bg)", display:"flex", flexDirection:"column" }}>
        <style>{contPrintStyles}</style>
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"2px 0 12px", flexShrink:0 }}>
          <button onClick={()=>setShowInforme(false)} style={{ ...btn("secondary"), flexShrink:0 }}>
            ← Volver
          </button>
          <span style={{ fontSize:13, color:"var(--muted)", fontWeight:600 }}>Informe Fiscal · {mes}</span>
        </div>
        <div className="cg-informe-print" style={{ background:"var(--card)", border:"1px solid var(--line)", borderRadius:16, padding:"24px 20px", maxWidth:640, width:"100%", margin:"0 auto" }}>
          <h1 style={{ color:"var(--brand)", fontSize:20, margin:"0 0 4px" }}>CubaGest — Informe Fiscal</h1>
          <p style={{ color:"var(--muted)", fontSize:13, margin:"0 0 24px" }}>Período: {mes} · Generado: {new Date().toLocaleDateString("es-CU")}</p>
          <div style={{ border:"1px solid var(--line)", borderRadius:10, padding:16, marginBottom:20 }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <tr><th style={thStyle}>Concepto</th><th style={{ ...thStyle, textAlign:"right" as any }}>Monto (CUP)</th></tr>
              <tr><td style={tdStyle}>Ingresos brutos por ventas</td><td style={{ ...tdStyle, textAlign:"right" as any }}>{fmt(ti)}</td></tr>
              <tr><td style={{ ...tdStyle, color:"#DC2626" }}>Total egresos registrados</td><td style={{ ...tdStyle, color:"#DC2626", textAlign:"right" as any }}>{fmt(te)}</td></tr>
              <tr><td style={{ ...tdStyle, fontWeight:800, color: nt>=0?"#1A7A3C":"#DC2626" }}>Utilidad neta</td><td style={{ ...tdStyle, fontWeight:800, color: nt>=0?"#1A7A3C":"#DC2626", textAlign:"right" as any }}>{fmt(nt)}</td></tr>
            </table>
          </div>
          <h3 style={{ fontSize:14, margin:"0 0 10px" }}>Detalle de Egresos</h3>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <tr><th style={thStyle}>Fecha</th><th style={thStyle}>Concepto</th><th style={thStyle}>Categoría</th><th style={{ ...thStyle, textAlign:"right" as any }}>Monto</th></tr>
            {expenses.map((e:any)=>(
              <tr key={e.id}><td style={tdStyle}>{(e.date||e.createdAt||"").split("T")[0]}</td><td style={tdStyle}>{e.concept}</td><td style={tdStyle}>{e.category}</td><td style={{ ...tdStyle, textAlign:"right" as any }}>{fmt(Number(e.amount))}</td></tr>
            ))}
          </table>
          <p style={{ fontSize:11, color:"var(--muted)", marginTop:24, borderTop:"1px solid var(--line)", paddingTop:12 }}>
            Este informe es generado automáticamente por CubaGest para uso interno.<br/>
            Los datos son orientativos. Consulte con su contador para la declaración oficial.
          </p>
          <button onClick={()=>window.print()} style={{ background:"var(--brand)", color:"#fff", border:"none", padding:"10px 20px", borderRadius:10, cursor:"pointer", fontSize:14, fontWeight:600, marginTop:14 }}>
            🖨 Imprimir / Guardar PDF
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:800, color:"var(--ink)" }}>Contabilidad</h2>
          <p style={{ margin:0, fontSize:14, color:"var(--muted)" }}>Registro contable</p>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" as any }}>
          <button style={btn("secondary")} onClick={load}><Icon name="refresh" size={15}/>Actualizar</button>
          <button style={btn("secondary")} onClick={()=>setShowInforme(true)}><Icon name="print" size={15}/>Informe Fiscal</button>
          <button style={btn("primary")} onClick={()=>setModal(true)}><Icon name="plus" size={16}/>Registrar Gasto</button>
        </div>
      </div>

      <div style={{ display:"flex", gap:4, background:"var(--input-bg)", borderRadius:12, padding:4, width:"fit-content" }}>
        {[["ingresos","Ingresos"],["gastos","Egresos"],["facturas","Facturas"]].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} style={{ ...btn(tab===v?"primary":"ghost"), padding:"7px 16px", fontSize:13, borderRadius:7 }}>{l}</button>
        ))}
      </div>

      {tab==="ingresos" && (
        <div style={{ background:"var(--card)", borderRadius:16, border:"1px solid var(--line)", overflowX:"auto", WebkitOverflowScrolling:"touch" as any }}>
          <table style={{ width:"100%", minWidth:750, borderCollapse:"collapse" }}>
            <thead><tr style={{ background:"var(--input-bg)" }}>
              {["No. Factura","Fecha","Cliente","NIT","Teléfono","Total","Método"].map(h=>(
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {sales.filter(s=>s.status==="emitida").map(s=>(
                <tr key={s.id} onClick={()=>setViewInv(s)} style={{ borderTop:"1px solid var(--line)", cursor:"pointer" }}>
                  <td style={{ padding:"11px 14px", fontSize:13, fontWeight:600, color:"var(--brand)", fontFamily:"monospace" }}>{s.id}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, color:"var(--ink)" }}>{(s.date||s.createdAt||"").split("T")[0]}</td>
                  <td style={{ padding:"11px 14px", fontSize:13 }}>{s.client}</td>
                  <td style={{ padding:"11px 14px", fontSize:12, color:"var(--muted)", fontFamily:"monospace" }}>{s.clientNit || "—"}</td>
                  <td style={{ padding:"11px 14px", fontSize:12, color:"var(--muted)" }}>{s.clientPhone || "—"}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, fontWeight:700 }}>${fmt(s.total)}</td>
                  <td style={{ padding:"11px 14px" }}><Badge label={PAY_METHODS.find(p=>p.id===s.payMethod)?.label||s.payMethod} color="var(--brand)"/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==="gastos" && (
        <div style={{ background:"var(--card)", borderRadius:16, border:"1px solid var(--line)", overflowX:"auto", WebkitOverflowScrolling:"touch" as any }}>
          <table style={{ width:"100%", minWidth:500, borderCollapse:"collapse" }}>
            <thead><tr style={{ background:"var(--input-bg)" }}>
              {["Fecha","Concepto","Categoría","Método","Monto"].map(h=>(
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {expenses.map(e=>(
                <tr key={e.id} style={{ borderTop:"1px solid var(--line)" }}>
                  <td style={{ padding:"11px 14px", fontSize:13, color:"var(--ink)" }}>{(e.date||e.createdAt||"").split("T")[0]}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, fontWeight:600 }}>{e.concept}</td>
                  <td style={{ padding:"11px 14px" }}><Badge label={e.category} color="#5a3a1a"/></td>
                  <td style={{ padding:"11px 14px" }}><Badge label={PAY_METHODS.find(p=>p.id===e.method)?.label||e.method} color="var(--brand)"/></td>
                  <td style={{ padding:"11px 14px", fontSize:14, fontWeight:700, color:"var(--brand)" }}>${fmt(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {expenses.length===0 && <div style={{ padding:40, textAlign:"center", color:"var(--muted)" }}>No hay egresos registrados</div>}
        </div>
      )}

      {tab==="facturas" && (
        <div style={{ background:"var(--card)", borderRadius:16, border:"1px solid var(--line)", overflowX:"auto", WebkitOverflowScrolling:"touch" as any }}>
          <table style={{ width:"100%", minWidth:800, borderCollapse:"collapse" }}>
            <thead><tr style={{ background:"var(--input-bg)" }}>
              {["No. Factura","Fecha","Cliente","NIT","Teléfono","Total","Método","Estado"].map(h=>(
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase" as any, whiteSpace:"nowrap" as any }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {sales.filter((s:any)=>s.status==="emitida").map((s:any)=>(
                <tr key={s.id} onClick={()=>setViewInv(s)} style={{ borderTop:"1px solid var(--line)", cursor:"pointer" }}>
                  <td style={{ padding:"11px 14px", fontSize:13, fontWeight:600, color:"var(--brand)", fontFamily:"monospace" }}>{s.id}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, color:"var(--ink)" }}>{(s.date||s.createdAt||"").split("T")[0]}</td>
                  <td style={{ padding:"11px 14px", fontSize:13 }}>{s.client}</td>
                  <td style={{ padding:"11px 14px", fontSize:12, color:"var(--muted)", fontFamily:"monospace" }}>{s.clientNit || "—"}</td>
                  <td style={{ padding:"11px 14px", fontSize:12, color:"var(--muted)" }}>{s.clientPhone || "—"}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, fontWeight:700 }}>${fmt(s.total)}</td>
                  <td style={{ padding:"11px 14px" }}><Badge label={PAY_METHODS.find((p:any)=>p.id===s.payMethod)?.label||s.payMethod} color="var(--brand)"/></td>
                  <td style={{ padding:"11px 14px" }}><Badge label="Emitida" color="#10B981"/></td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.filter((s:any)=>s.status==="emitida").length===0 && <div style={{ padding:40, textAlign:"center", color:"var(--muted)" }}>No hay facturas emitidas</div>}
        </div>
      )}

      {viewInv && (
        <Modal title={`Factura ${viewInv.id}`} onClose={()=>setViewInv(null)} width={520}>
          <style>{contStyles}</style>
          <div className="cg-receipt-print-area" style={{ fontFamily:"monospace", fontSize:12, lineHeight:1.9, background:"var(--input-bg)", padding:20, borderRadius:12, border:"1px solid var(--line)" }}>
            <div style={{ textAlign:"center", marginBottom:14 }}>
              <div style={{ fontWeight:800, fontSize:15, color:"var(--ink)" }}>{user?.company?.name || "Mi Negocio"}</div>
              <div>FACTURA No. <strong style={{ color:"var(--brand)", fontSize:15 }}>{viewInv.invoiceNumber||viewInv.id}</strong></div>
              {viewInv.status==="anulada" && <div style={{ color:"#DC2626", fontWeight:800 }}>⚠ ANULADA</div>}
            </div>
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"8px 0" }}/>
            <div>Fecha: {(viewInv.date||viewInv.createdAt||"").split("T")[0]}</div>
            <div>Cliente: {viewInv.clientName||viewInv.client||"Consumidor Final"}</div>
            {(viewInv.clientNit && viewInv.clientNit !== "00000000000") && <div>Carnet: {viewInv.clientNit}</div>}
            {viewInv.clientPhone && <div>Teléfono: {viewInv.clientPhone}</div>}
            <div>Método: {PAY_METHODS.find(p=>p.id===viewInv.payMethod)?.label||viewInv.payMethod}</div>
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"8px 0" }}/>
            {(viewInv.items||viewInv.SaleItems||[]).map((item:any,i:number)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between" }}>
                <span>{item.qty}x {item.name||item.Product?.name}</span>
                <span>{CURRENCY_SYMBOLS[viewInv.currency]||"$"}{fmt(item.total||item.price*item.qty)}</span>
              </div>
            ))}
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"8px 0" }}/>
            <div style={{ display:"flex", justifyContent:"space-between", fontWeight:800, fontSize:14, marginTop:4 }}><span>TOTAL:</span><span>{CURRENCY_SYMBOLS[viewInv.currency]||"$"}{fmt(viewInv.total)} {viewInv.currency||"CUP"}</span></div>
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"8px 0" }}/>
            <div style={{ textAlign:"center", fontSize:10, color:"var(--ink)" }}>¡Gracias por su compra!</div>
            <div style={{ textAlign:"center", fontSize:8, color:"var(--muted)", marginTop:4 }}>Hecho con CubaGest</div>
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:16 }}>
            <button style={btn("secondary")} onClick={()=>setViewInv(null)}>Cerrar</button>
            <button style={btn("primary")} onClick={()=>window.print()}><Icon name="print" size={15}/>Imprimir</button>
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title="Registrar Egreso" onClose={()=>setModal(false)} width={460}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <Field label="Fecha" required><input style={inp} type="date" value={form.date} onChange={e=>setForm((f:any)=>({...f,date:e.target.value}))}/></Field>
              <Field label="Categoría" required>
                <select style={sel} value={form.category} onChange={e=>setForm((f:any)=>({...f,category:e.target.value}))}>
                  {EXPENSE_CATS.map(c=><option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Concepto" required><input style={inp} value={form.concept} onChange={e=>setForm((f:any)=>({...f,concept:e.target.value}))}/></Field>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <Field label="Monto (CUP)" required><input style={inp} type="number" value={form.amount} onChange={e=>setForm((f:any)=>({...f,amount:e.target.value}))}/></Field>
              <Field label="Método de Pago">
                <select style={sel} value={form.method} onChange={e=>setForm((f:any)=>({...f,method:e.target.value}))}>
                  {PAY_METHODS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button style={btn("secondary")} onClick={()=>setModal(false)}>Cancelar</button>
              <button style={{ ...btn("primary"), opacity:saving?0.6:1 }} onClick={addExpense} disabled={saving}>{saving?"Guardando...":"Guardar"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Contabilidad;
