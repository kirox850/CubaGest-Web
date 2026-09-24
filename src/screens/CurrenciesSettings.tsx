import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import Icon from "@/components/shared/Icon";
import { Field, Modal, btn, inp } from "@/components/shared/primitives";

// ─── MONEDAS Y TASAS (config de empresa — solo admin) ──────────────────────
const CurrenciesSettings = ({ showToast, onClose }: { showToast: (m:string,t:string)=>void; onClose: () => void }) => {
  const [currencies, setCurrencies] = useState<string[]>(["CUP"]);
  const [rateMode, setRateMode]     = useState("manual");
  const [manualRates, setManualRates] = useState<Record<string,string>>({});
  const [rates, setRates]           = useState<Record<string,number>>({});
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<any>(null);
  const [saving, setSaving]         = useState(false);
  const [testing, setTesting]       = useState(false);

  // Fuerza una consulta fresca a elToque (ignora la caché de 5 min). Sirve
  // para verificar en vivo si el token (ELTOQUE_API_TOKEN) está configurado:
  // si llegan tasas, funciona; si no, el Worker loguea el motivo (401/403).
  const testRates = async () => {
    setTesting(true);
    try {
      const s = await apiFetch("/settings?refresh=1");
      const r = s?.rates || {};
      setRates(r);
      setRatesUpdatedAt(s?.ratesUpdatedAt || null);
      showToast(Object.keys(r).length > 0
        ? `Tasas obtenidas: ${Object.entries(r).map(([k,v])=>`${k}=${v}`).join(" · ")}`
        : "No se pudieron obtener tasas — revisa el token de elToque (ver logs del Worker)",
        Object.keys(r).length > 0 ? "success" : "error");
    } catch(e:any) { showToast(e.message, "error"); }
    finally { setTesting(false); }
  };

  useEffect(() => {
    apiFetch("/settings").then((s:any) => {
      if (s?.currencies) setCurrencies(s.currencies);
      if (s?.rateMode) setRateMode(s.rateMode);
      const mr = s?.manualRates || {};
      setManualRates({ USD:String(mr.USD||""), EUR:String(mr.EUR||""), MLC:String(mr.MLC||"") });
      setRates(s?.rates || {});
      setRatesUpdatedAt(s?.ratesUpdatedAt || null);
    }).catch((e:any)=>showToast(e.message,"error"));
  }, []);

  const toggleCurrency = (m:string) => {
    if (m==="CUP") return; // CUP es la base, siempre activa
    setCurrencies(prev => prev.includes(m) ? prev.filter(x=>x!==m) : [...prev, m]);
  };

  const save = async () => {
    if (currencies.length===0) return showToast("Debe haber al menos una moneda (CUP)", "error");
    setSaving(true);
    try {
      const mr: Record<string, number> = {};
      for (const [k,v] of Object.entries(manualRates)) if (v && Number(v)>0) mr[k] = Number(v);
      await apiFetch("/settings", { method:"PUT", body:{ currencies, rateMode, manualRates: mr } });
      showToast("Configuración de monedas guardada", "success");
      onClose();
    } catch(e:any) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Monedas y Tasas de Cambio" onClose={onClose} width={520}>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div>
          <Field label="Monedas que opera tu negocio" required>
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:4 }}>
              {["CUP","USD","EUR","MLC"].map(m => (
                <label key={m} style={{ display:"flex", alignItems:"center", gap:10, fontSize:14, cursor:m==="CUP"?"default":"pointer", color:m==="CUP"?"var(--muted)":"var(--ink)" }}>
                  <input type="checkbox" checked={currencies.includes(m)} disabled={m==="CUP"} onChange={()=>toggleCurrency(m)}/>
                  <strong>{m}</strong>
                  {m==="CUP" && <span style={{ fontSize:11, color:"var(--muted)" }}>(moneda base — siempre activa)</span>}
                </label>
              ))}
            </div>
          </Field>
          <p style={{ margin:"8px 0 0", fontSize:12, color:"var(--muted)" }}>
            Las monedas seleccionadas estarán disponibles al registrar productos y al vender. Los ingresos se reportan por separado en cada moneda.
          </p>
        </div>

        <div style={{ height:1, background:"var(--line)" }}/>

        <Field label="Tasa de cambio">
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:4 }}>
            <label style={{ display:"flex", alignItems:"center", gap:10, fontSize:14, cursor:"pointer" }}>
              <input type="radio" checked={rateMode==="manual"} onChange={()=>setRateMode("manual")}/>
              <strong>Manual</strong> — yo fijo la tasa y la actualizo cuando quiera
            </label>
            <label style={{ display:"flex", alignItems:"center", gap:10, fontSize:14, cursor:"pointer" }}>
              <input type="radio" checked={rateMode==="eltoque"} onChange={()=>setRateMode("eltoque")}/>
              <strong>elToque (automática)</strong> — se actualiza sola cada 5 min
            </label>
          </div>
        </Field>

        {rateMode==="manual" ? (
          <div style={{ background:"var(--input-bg)", border:"1px solid var(--line)", borderRadius:12, padding:14 }}>
            <p style={{ margin:"0 0 10px", fontSize:12, color:"var(--muted)" }}>Cuántos CUP vale 1 unidad de cada moneda:</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
              {["USD","EUR","MLC"].map(m => (
                <Field key={m} label={m}>
                  <input style={inp} type="number" value={manualRates[m]||""} onChange={e=>setManualRates(r=>({...r,[m]:e.target.value}))} placeholder="0"/>
                </Field>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ background:"var(--input-bg)", borderRadius:12, padding:"12px 14px", fontSize:13, color:"var(--ink)" }}>
            <div style={{ fontWeight:700, marginBottom:6 }}>Tasas actuales (elToque):</div>
            {Object.keys(rates).length>0 ? (
              <div>Tasas cargadas: {Object.entries(rates).map(([k,v])=>`${k}=${v}`).join(" · ")}</div>
            ) : <div>Aún no se han cargado tasas — usa “Probar ahora” para obtenerlas.</div>}
            {ratesUpdatedAt && <div style={{ marginTop:4, fontSize:11, opacity:0.8 }}>Actualizado: {new Date(ratesUpdatedAt).toLocaleString()}</div>}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:10 }}>
              <button onClick={testRates} disabled={testing} style={{ ...btn("secondary"), fontSize:12, opacity:testing?0.6:1 }}>
                {testing ? "Consultando..." : <><Icon name="refresh" size={14}/>Probar ahora</>}
              </button>
              <span style={{ fontSize:11, color:"var(--muted)" }}>Consulta fresca a elToque (ignora la caché)</span>
            </div>
            <div style={{ marginTop:8, fontSize:11, color:"var(--muted)", lineHeight:1.5 }}>
              Si no llegan tasas: la API de elToque exige un token por aplicación
              (se solicita en tasas.eltoque.com/docs). Configúralo en el backend con
              <code style={{ fontFamily:"monospace", background:"var(--line)", borderRadius:4, padding:"1px 5px", margin:"0 4px" }}>npx wrangler secret put ELTOQUE_API_TOKEN</code>
              — sin token, el sistema intenta un raspado de la página pública como respaldo.
            </div>
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button style={btn("secondary")} onClick={onClose}>Cancelar</button>
          <button style={{ ...btn("primary"), opacity:saving?0.6:1 }} onClick={save} disabled={saving}>{saving?"Guardando...":"Guardar"}</button>
        </div>
      </div>
    </Modal>
  );
};

export default CurrenciesSettings;
