import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { fmt, today, downloadCSV } from "@/lib/format";
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

// ─── CONTABILIDAD ─────────────────────────────────────────────────────────────
const Contabilidad = ({ user, showToast }: { user: any; showToast: (m:string,t:string)=>void }) => {
  const [sales, setSales]       = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("ingresos");
  const [modal, setModal]       = useState(false);
  const [viewInv, setViewInv]   = useState<any>(null);
  const [form, setForm]         = useState({ date:today(), concept:"", amount:"", category:"Compras", method:"efectivo" });
  const [saving, setSaving]     = useState(false);

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
    const mes         = new Date().toLocaleString("es-CU",{month:"long",year:"numeric"});
    const win = window.open("","_blank","width=700,height=900");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
      <title>Informe Fiscal CubaGest</title>
      <style>
        body{font-family:Arial,sans-serif;padding:40px;color:#1a1410;max-width:600px;margin:0 auto}
        h1{color:#8B1A1A;font-size:20px;margin-bottom:4px}
        .sub{color:#8a7060;font-size:13px;margin-bottom:32px}
        table{width:100%;border-collapse:collapse;margin-bottom:24px}
        th{text-align:left;font-size:11px;text-transform:uppercase;color:#8a7060;padding:8px 0;border-bottom:2px solid #e8e0d8}
        td{padding:10px 0;border-bottom:1px solid #f0ebe4;font-size:14px}
        .total{font-weight:800;font-size:16px}
        .red{color:#8B1A1A} .green{color:#1A7A3C}
        .box{border:1px solid #e8e0d8;border-radius:8px;padding:16px;margin-bottom:16px}
        .note{font-size:11px;color:#8a7060;margin-top:32px;border-top:1px solid #e8e0d8;padding-top:12px}
        @media print{button{display:none}}
      </style></head><body>
      <h1>CubaGest — Informe Fiscal</h1>
      <p class="sub">Período: ${mes} · Generado: ${new Date().toLocaleDateString("es-CU")}</p>
      <div class="box">
        <table>
          <tr><th>Concepto</th><th style="text-align:right">Monto (CUP)</th></tr>
          <tr><td>Ingresos brutos por ventas</td><td style="text-align:right">${fmt(totalIncome)}</td></tr>
          <tr><td class="red">Total egresos registrados</td><td class="red" style="text-align:right">${fmt(totalExp)}</td></tr>
          <tr class="total"><td class="${net>=0?"green":"red"}">Utilidad neta</td><td class="${net>=0?"green":"red"}" style="text-align:right">${fmt(net)}</td></tr>
        </table>
      </div>
      <h3 style="font-size:14px;margin-bottom:12px">Detalle de Egresos</h3>
      <table>
        <tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th style="text-align:right">Monto</th></tr>
        ${expenses.map((e:any)=>"<tr><td>"+(e.date||e.createdAt||"").split("T")[0]+"</td><td>"+e.concept+"</td><td>"+e.category+"</td><td style=\"text-align:right\">"+fmt(Number(e.amount))+"</td></tr>").join("")}
      </table>
      <p class="note">Este informe es generado automáticamente por CubaGest para uso interno.<br/>
      Los datos son orientativos. Consulte con su contador para la declaración oficial.</p>
      <br/><button onclick="window.print()" style="background:#8B1A1A;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:14px">🖨 Imprimir / Guardar PDF</button>
    </body></html>`);
    win.document.close();
  };

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

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ margin:"0 0 4px", fontSize:22, fontWeight:800, color:"var(--ink)" }}>Contabilidad</h2>
          <p style={{ margin:0, fontSize:14, color:"var(--muted)" }}>Registro contable</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={btn("secondary")} onClick={load}><Icon name="refresh" size={15}/>Actualizar</button>
          <button style={btn("secondary")} onClick={exportarInforme}><Icon name="print" size={15}/>Informe Fiscal</button>
          <button style={btn("secondary")} onClick={() => downloadCSV("gastos", expenses, [
            { key:"date", label:"Fecha" },{ key:"category", label:"Categoría" },{ key:"concept", label:"Concepto" },
            { key:"amount", label:"Monto" },{ key:"method", label:"Método de pago" },
          ])}><Icon name="doc" size={15}/>CSV</button>
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
                  <td style={{ padding:"11px 14px", fontSize:13, fontWeight:600, color:"#3B82F6", fontFamily:"monospace" }}>{s.id}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, color:"var(--ink)" }}>{(s.date||s.createdAt||"").split("T")[0]}</td>
                  <td style={{ padding:"11px 14px", fontSize:13 }}>{s.client}</td>
                  <td style={{ padding:"11px 14px", fontSize:12, color:"var(--muted)", fontFamily:"monospace" }}>{s.clientNit || "—"}</td>
                  <td style={{ padding:"11px 14px", fontSize:12, color:"var(--muted)" }}>{s.clientPhone || "—"}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, fontWeight:700 }}>${fmt(s.total)}</td>
                  <td style={{ padding:"11px 14px" }}><Badge label={PAY_METHODS.find(p=>p.id===s.payMethod)?.label||s.payMethod} color="#3B82F6"/></td>
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
                  <td style={{ padding:"11px 14px" }}><Badge label={PAY_METHODS.find(p=>p.id===e.method)?.label||e.method} color="#3B82F6"/></td>
                  <td style={{ padding:"11px 14px", fontSize:14, fontWeight:700, color:"#3B82F6" }}>${fmt(e.amount)}</td>
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
                  <td style={{ padding:"11px 14px", fontSize:13, fontWeight:600, color:"#3B82F6", fontFamily:"monospace" }}>{s.id}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, color:"var(--ink)" }}>{(s.date||s.createdAt||"").split("T")[0]}</td>
                  <td style={{ padding:"11px 14px", fontSize:13 }}>{s.client}</td>
                  <td style={{ padding:"11px 14px", fontSize:12, color:"var(--muted)", fontFamily:"monospace" }}>{s.clientNit || "—"}</td>
                  <td style={{ padding:"11px 14px", fontSize:12, color:"var(--muted)" }}>{s.clientPhone || "—"}</td>
                  <td style={{ padding:"11px 14px", fontSize:13, fontWeight:700 }}>${fmt(s.total)}</td>
                  <td style={{ padding:"11px 14px" }}><Badge label={PAY_METHODS.find((p:any)=>p.id===s.payMethod)?.label||s.payMethod} color="#3B82F6"/></td>
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
              <div>FACTURA No. <strong style={{ color:"#3B82F6", fontSize:15 }}>{viewInv.invoiceNumber||viewInv.id}</strong></div>
              {viewInv.status==="anulada" && <div style={{ color:"#DC2626", fontWeight:800 }}>⚠ ANULADA</div>}
            </div>
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"8px 0" }}/>
            <div>Fecha: {(viewInv.date||viewInv.createdAt||"").split("T")[0]}</div>
            <div>Cliente: {viewInv.clientName||viewInv.client||"Consumidor Final"}</div>
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
