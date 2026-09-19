import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { fmt } from "@/lib/format";
import { useOnlineStatus } from "@/hooks/useOnline";
import { PAY_METHODS, CURRENCY_SYMBOLS } from "@/config/constants";
import { cacheProducts, getOfflineProducts, saveSaleOffline } from "@/offlineDB";
import Icon from "@/components/shared/Icon";
import { Modal, Field, Spinner, btn, inp, sel } from "@/components/shared/primitives";

// ─── POS ──────────────────────────────────────────────────────────────────────
const POS = ({ user, showToast }: { user: any; showToast: (m:string,t:string)=>void }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [cart, setCart]         = useState<any[]>([]);
  const [search, setSearch]     = useState("");
  const [payMethod, setPayMethod] = useState("efectivo");
  const [clientName, setClientName] = useState("");
  const [clientNit, setClientNit]   = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [cashGiven, setCashGiven]   = useState("");
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [processing, setProcessing]   = useState(false);
  const [saleCurrency, setSaleCurrency] = useState("CUP");
  const [currencies, setCurrencies]     = useState<string[]>(["CUP"]);
  const [discounts, setDiscounts]       = useState<any[]>([]);
  const [saleDiscountId, setSaleDiscountId] = useState("");
  const [cameraOpen, setCameraOpen]     = useState(false);
  const [camMsg, setCamMsg]             = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanTimer = useRef<any>(null);
  const online = useOnlineStatus();

  // Config de empresa (monedas habilitadas) + descuentos de tipo venta
  useEffect(() => {
    apiFetch("/settings").then((s: any) => {
      if (s?.currencies?.length) setCurrencies(s.currencies);
    }).catch(() => {});
    apiFetch("/discounts").then((d: any[]) => setDiscounts(d || [])).catch(() => {});
  }, []);

  const subtotal = cart.reduce((a,i)=>a+i.price*i.qty,0);
  const activeSaleDiscount = discounts.find(d=>d.id===saleDiscountId) || null;
  // El descuento solo aplica en línea (el flujo offline no lo soporta aún)
  const saleDiscAmount = online && activeSaleDiscount ? (() => {
    if (activeSaleDiscount.type === "fijo") return Math.min(Number(activeSaleDiscount.value), subtotal);
    return subtotal * Number(activeSaleDiscount.value) / 100;
  })() : 0;
  const total = Math.max(0, subtotal - saleDiscAmount);
  const change   = Number(cashGiven) - total;
  const needsTransferData = payMethod === "transferencia";
  const curSym = CURRENCY_SYMBOLS[saleCurrency] || "$";

  const [myLocationId, setMyLocationId] = useState<string>("");
  const [myLocationName, setMyLocationName] = useState<string>("");

  useEffect(()=>{
    if (online) {
      apiFetch("/locations")
        .then(async (locs: any[]) => {
          const own = user.role === "almacenista" ? locs.find((l:any)=>l.type==="almacen")
            : locs.find((l:any)=>l.ownerUserId===user.id);
          if (!own) { setProducts([]); setLoading(false); return; }
          setMyLocationId(own.id);
          setMyLocationName(own.name);
          const { items } = await apiFetch(`/locations/${own.id}/stock`);
          await cacheProducts(items);
          setProducts(items.filter((p:any)=>p.active && p.stock>0));
          setLoading(false);
        })
        .catch(async (e: any) => {
          // Antes esto siempre decía "Sin conexión", aunque la causa real
          // fuera otra (ej. permisos) — ahora distinguimos.
          if (e?.message === "Sesión expirada") return; // ya se maneja aparte
          const msg = online ? (e?.message || "Error al cargar productos") : "Sin conexión — cargando productos offline";
          showToast(msg, "warning");
          const cached = await getOfflineProducts();
          setProducts(cached.filter(p=>p.localStock>0));
          setLoading(false);
        });
    } else {
      getOfflineProducts().then(cached => {
        setProducts(cached.filter(p=>p.localStock>0));
        setLoading(false);
      });
    }
  },[online]);

  const q = search.trim().toLowerCase();
  const avail = products.filter(p =>
    p.name.toLowerCase().includes(q) ||
    String(p.code||"").toLowerCase().includes(q) ||
    String(p.barcode||"").toLowerCase().includes(q)
  );

  const qtyFor = (id:string) => cart.find(i=>i.id===id)?.qty || 0;

  // Añadir al carrito (clic en lista y escáner)
  const addToCart = (p:any) => {
    const cur = qtyFor(p.id);
    if (cur + 1 > p.stock) { showToast(`Stock insuficiente de ${p.name}`, "warning"); return; }
    setCart(prev => {
      const ex = prev.find(i=>i.id===p.id);
      if (ex) return prev.map(i=>i.id===p.id?{...i, qty:i.qty+1}:i);
      return [...prev, {...p, qty:1}];
    });
  };

  // Lectores USB/Bluetooth: "escriben" el código y dan Enter. Si lo tecleado
  // matchea exactamente un barcode/código, se agrega al carrito y se limpia.
  const tryBarcodeSearch = (raw: string) => {
    const v = raw.trim().toLowerCase();
    if (!v) return false;
    const matches = products.filter(p =>
      String(p.barcode||"").toLowerCase() === v || String(p.code||"").toLowerCase() === v
    );
    if (matches.length === 1) {
      addToCart(matches[0]);
      setSearch("");
      return true;
    }
    return false;
  };

  // ── Escáner por cámara (BarcodeDetector API — sin dependencias) ────────────
  const stopCamera = () => {
    if (scanTimer.current) { clearInterval(scanTimer.current); scanTimer.current = null; }
    const v = videoRef.current;
    const stream = (v?.srcObject as MediaStream | null) || null;
    stream?.getTracks().forEach(t => t.stop());
    if (v) v.srcObject = null;
    setCameraOpen(false);
  };

  const startCamera = async () => {
    const AnyWin = window as any;
    if (!AnyWin.BarcodeDetector) {
      showToast("Este navegador no soporta escaneo por cámara. Usa un lector USB o digita el código.", "warning");
      return;
    }
    setCameraOpen(true);
    setCamMsg("Iniciando cámara...");
    try {
      const detector = new AnyWin.BarcodeDetector({ formats: ["ean_13","ean_8","code_128","code_39","upc_a","upc_e","qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setTimeout(() => {
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        v.setAttribute("playsinline", "true");
        v.play().catch(()=>{});
        setCamMsg("Apunta al código de barras");
        scanTimer.current = setInterval(async () => {
          try {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            const codes = await detector.detect(videoRef.current);
            if (codes?.length) {
              const val = codes[0].rawValue;
              const match = products.find(p => String(p.barcode||"") === val || String(p.code||"") === val);
              if (match) { addToCart(match); showToast(`${match.name} agregado`, "success"); }
              else showToast(`Código ${val} sin producto asociado`, "warning");
            }
          } catch { /* frame inválido, ignorar */ }
        }, 350);
      }, 50);
    } catch {
      setCamMsg("No se pudo acceder a la cámara");
    }
  };

  useEffect(() => () => stopCamera(), []);

  const setQty = (p:any, newQty:number) => {
    if (newQty <= 0) { setCart(prev=>prev.filter(i=>i.id!==p.id)); return; }
    if (newQty > p.stock) { showToast("Stock insuficiente","warning"); return; }
    setCart(prev=>{
      const ex = prev.find(i=>i.id===p.id);
      if (ex) return prev.map(i=>i.id===p.id?{...i,qty:newQty}:i);
      return [...prev,{...p,qty:newQty}];
    });
  };

  const removeFromCart = (id:string) => setCart(prev=>prev.filter(i=>i.id!==id));

  const processSale = async () => {
    if (cart.length===0) return showToast("El carrito está vacío","error");
    if (needsTransferData && (!clientName || !clientNit || !clientPhone)) {
      return showToast("Complete nombre, NIT y teléfono del cliente para transferencia","error");
    }
    setProcessing(true);
    try {
      const saleData = {
        clientName: needsTransferData ? clientName : "Consumidor Final",
        clientNit: needsTransferData ? clientNit : "00000000000",
        clientPhone: needsTransferData ? clientPhone : undefined,
        items: cart.map(i=>({ productId:i.id, name:i.name, qty:i.qty, price:i.price, total:i.price*i.qty })),
        payMethod,
        subtotal,
        total,
        discountId: online && saleDiscountId ? saleDiscountId : undefined,
        currency: saleCurrency,
      };

      if (!online) {
        // Guardar offline
        const offlineSale = await saveSaleOffline(saleData);
        setLastReceipt({ ...offlineSale, id: offlineSale.localId, isOffline: true });
        setCart([]);
        setSearch(""); setCashGiven(""); setSaleDiscountId("");
        setClientName(""); setClientNit(""); setClientPhone("");
        // Actualizar lista con stock local
        const cached = await getOfflineProducts();
        setProducts(cached.filter(p=>p.localStock>0));
        showToast(`Factura ${offlineSale.localId} guardada offline`,"info");
      } else {
        // Online normal
        const invoice = await apiFetch("/sales", { method:"POST", body: saleData });
        // Actualizar cache de productos con el stock de MI ubicación
        if (myLocationId) {
          const { items } = await apiFetch(`/locations/${myLocationId}/stock`);
          await cacheProducts(items);
          setProducts(items.filter((p:any)=>p.active&&p.stock>0));
        }
        setLastReceipt(invoice);
        setCart([]);
        setSearch(""); setCashGiven(""); setSaleDiscountId("");
        setClientName(""); setClientNit(""); setClientPhone("");
        showToast(`Factura ${invoice.id} emitida correctamente`,"success");
      }
    } catch(e:any) { showToast(e.message,"error"); }
    finally { setProcessing(false); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 120px)", gap:0 }}>
      <h2 style={{ margin:"0 0 4px", fontSize:20, fontWeight:800, color:"var(--ink)", flexShrink:0 }}>Punto de Venta</h2>
      {myLocationName && <p style={{ margin:"0 0 12px", fontSize:12, color:"var(--muted)", flexShrink:0 }}>Vendiendo desde: <strong>{myLocationName}</strong></p>}

      {/* Buscador fijo */}
      <div style={{ position:"relative", flexShrink:0, marginBottom:10 }}>
        <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}><Icon name="search" size={15} color="var(--muted)"/></span>
        <input style={{ ...inp, paddingLeft:34, paddingRight:88 }} placeholder="Buscar producto o escanear..." value={search}
          onChange={e=>setSearch(e.target.value)}
          onKeyDown={e=>{ if (e.key==="Enter") { if (tryBarcodeSearch(search)) return; const one = avail.length===1 ? avail[0] : null; if (one) { addToCart(one); setSearch(""); } } }}/>
        <button onClick={startCamera} title="Escanear código de barras" style={{ position:"absolute", right:44, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:4 }}>
          <Icon name="auditoria" size={18} color="#3B82F6"/>
        </button>
        <button onClick={()=>{ if (tryBarcodeSearch(search)) return; const one = avail.length===1 ? avail[0] : null; if (one) { addToCart(one); setSearch(""); } }} title="Agregar coincidencia única" style={{ position:"absolute", right:6, top:"50%", transform:"translateY(-50%)", background:"#EFF6FF", border:"none", borderRadius:8, cursor:"pointer", padding:"4px 7px", color:"#3B82F6", fontWeight:800, fontSize:13 }}>+</button>
      </div>

      {cameraOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={stopCamera}>
          <div style={{ background:"#0F172A", borderRadius:16, padding:14, maxWidth:420, width:"100%" }} onClick={e=>e.stopPropagation()}>
            <video ref={videoRef} style={{ width:"100%", borderRadius:12, background:"#000", minHeight:260 }} muted playsInline/>
            <p style={{ color:"#CBD5E1", fontSize:13, textAlign:"center", margin:"10px 0" }}>{camMsg}</p>
            <button style={{ ...btn("secondary"), width:"100%", justifyContent:"center" }} onClick={stopCamera}>Cerrar cámara</button>
          </div>
        </div>
      )}

      {/* Lista de productos — scroll independiente */}
      <div style={{ flex:1, overflowY:"auto", marginBottom:10, WebkitOverflowScrolling:"touch" as any }}>
        {loading ? <Spinner/> : (
          <div style={{ background:"var(--card)", borderRadius:16, border:"1px solid var(--line)", overflow:"hidden" }}>
            {avail.map((p,idx)=>{
              const q = qtyFor(p.id);
              return (
                <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", borderTop: idx===0?"none":"1px solid var(--line)" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontSize:13, fontWeight:700, color:"var(--ink)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</p>
                    <p style={{ margin:0, fontSize:11, color:"var(--muted)" }}>Stock: {p.stock} {p.unit} · {curSym}{fmt(p.price)}</p>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                    <button onClick={()=>setQty(p, q-1)} disabled={q===0} style={{ width:28, height:28, background:"var(--input-bg)", border:"none", borderRadius:8, cursor:q===0?"default":"pointer", opacity:q===0?0.4:1, display:"flex", alignItems:"center", justifyContent:"center" }}><Icon name="minus" size={13}/></button>
                    <span style={{ width:22, textAlign:"center", fontSize:14, fontWeight:700, color:q>0?"#3B82F6":"var(--ink)" }}>{q}</span>
                    <button onClick={()=>setQty(p, q+1)} style={{ width:28, height:28, background:"#3B82F6", border:"none", borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><Icon name="plus" size={13} color="#ffffff"/></button>
                  </div>
                </div>
              );
            })}
            {avail.length===0 && <div style={{ textAlign:"center", padding:40, color:"var(--muted)", fontSize:14 }}>No hay productos disponibles</div>}
          </div>
        )}
      </div>

      {/* Carrito fijo abajo */}
      <div style={{ flexShrink:0, background:"var(--card)", borderRadius:16, border:"1px solid var(--line)", padding:14, display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <Icon name="cart" size={18} color="#3B82F6"/>
          <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:"var(--ink)" }}>Carrito</h3>
          <span style={{ marginLeft:"auto", background:"#3B82F6", color:"#ffffff", borderRadius:20, padding:"1px 10px", fontSize:12, fontWeight:700 }}>{cart.length}</span>
        </div>

        {cart.length>0 && (
          <div style={{ maxHeight:80, overflowY:"auto", display:"flex", flexDirection:"column", gap:4 }}>
            {cart.map(item=>(
              <div key={item.id} style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                <span style={{ color:"var(--ink)" }}>{item.qty}× {item.name}</span>
                <span style={{ fontWeight:700 }}>${fmt(item.price*item.qty)}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" as any }}>
          <Field label="Moneda">
            <select style={{ ...sel, fontSize:12, padding:"6px 10px" }} value={saleCurrency} onChange={e=>setSaleCurrency(e.target.value)}>
              {currencies.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Pago">
            <select style={{ ...sel, fontSize:12, padding:"6px 10px" }} value={payMethod} onChange={e=>setPayMethod(e.target.value)}>
              {PAY_METHODS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
          {online && discounts.length>0 && (
            <Field label="Descuento">
              <select style={{ ...sel, fontSize:12, padding:"6px 10px" }} value={saleDiscountId} onChange={e=>setSaleDiscountId(e.target.value)}>
                <option value="">—</option>
                {discounts.filter(d=>d.scope==="venta" && d.active!==false).map(d=>(
                  <option key={d.id} value={d.id}>{d.code || d.name} ({d.type==="fijo"?`-${d.value}`:`-${d.value}%`})</option>
                ))}
              </select>
            </Field>
          )}
          {payMethod==="efectivo" && (
            <Field label="Efectivo">
              <input style={{ ...inp, fontSize:12, padding:"6px 10px" }} type="number" value={cashGiven} onChange={e=>setCashGiven(e.target.value)} placeholder="0.00"/>
            </Field>
          )}
        </div>

        {payMethod==="efectivo" && cashGiven && Number(cashGiven)>=total && (
          <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#10B981" }}>Cambio: {curSym}{fmt(change)} {saleCurrency}</p>
        )}

        {saleDiscAmount>0 && (
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#DC2626" }}>
            <span>Descuento ({activeSaleDiscount?.code || activeSaleDiscount?.name}):</span>
            <span>-{curSym}{fmt(saleDiscAmount)}</span>
          </div>
        )}

        {needsTransferData && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <input style={{ ...inp, fontSize:12 }} value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Nombre del cliente *"/>
            <div style={{ display:"flex", gap:8 }}>
              <input style={{ ...inp, fontSize:12, flex:1, fontFamily:"monospace" }} value={clientNit} onChange={e=>setClientNit(e.target.value)} maxLength={11} placeholder="NIT *"/>
              <input style={{ ...inp, fontSize:12, flex:1 }} value={clientPhone} onChange={e=>setClientPhone(e.target.value)} placeholder="Teléfono *"/>
            </div>
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:18, fontWeight:800, color:"var(--ink)" }}>Total: {curSym}{fmt(total)} {saleCurrency}</div>
          <button style={{ ...btn("primary"), padding:"10px 20px", fontSize:14, opacity:processing?0.6:1, background:"#10B981", boxShadow:"0 4px 12px rgba(16,185,129,0.3)" }} onClick={processSale} disabled={cart.length===0||processing}>
            <Icon name="check" size={15}/>{processing?"...":"Cobrar"}
          </button>
        </div>
      </div>

      {lastReceipt && (
        <Modal title="Factura Emitida" onClose={()=>setLastReceipt(null)} width={480}>
          <div style={{ fontFamily:"monospace", fontSize:12, lineHeight:1.8, background:"var(--input-bg)", padding:20, borderRadius:12, border:"1px solid var(--line)" }}>
            {lastReceipt.isOffline && <div style={{ background:"rgba(201,162,39,0.15)", color:"#856404", padding:"6px 10px", borderRadius:8, marginBottom:10, fontSize:11, textAlign:"center" as any }}>⚡ GUARDADA OFFLINE — se sincronizará al recuperar conexión</div>}
            <div style={{ textAlign:"center", marginBottom:16 }}>
              <div style={{ fontWeight:800, fontSize:16 }}>CUBAGEST</div>
              <div style={{ fontWeight:700, fontSize:14, color:"#3B82F6" }}>FACTURA COMERCIAL</div>
              <div>No. <strong>{lastReceipt.id || lastReceipt.localId}</strong> · Fecha: {lastReceipt.date?.split("T")[0]||lastReceipt.syncedAt||new Date().toISOString().split("T")[0]}</div>
            </div>
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"10px 0" }}/>
            <div>Cliente: {lastReceipt.clientName || lastReceipt.client || "Consumidor Final"}</div>
            <div>NIT Cliente: {lastReceipt.clientNit || "00000000000"}</div>
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"10px 0" }}/>
            {(lastReceipt.items||[]).map((item:any,i:number)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between" }}>
                <span>{item.qty}x {(item.name||item.Product?.name||"").slice(0,22)}</span>
                <span>${fmt(item.total||item.price*item.qty)}</span>
              </div>
            ))}
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"10px 0" }}/>
            <div style={{ display:"flex", justifyContent:"space-between", fontWeight:800, fontSize:14, marginTop:4 }}><span>TOTAL:</span><span>{CURRENCY_SYMBOLS[lastReceipt.currency]||"$"}{fmt(lastReceipt.total)} {lastReceipt.currency||"CUP"}</span></div>
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"10px 0" }}/>
            <div style={{ textAlign:"center", fontSize:10, color:"var(--muted)" }}>Gracias por su preferencia</div>
          </div>
          <div style={{ display:"flex", gap:10, marginTop:16, justifyContent:"flex-end" }}>
            <button style={btn("secondary")} onClick={()=>setLastReceipt(null)}><Icon name="check" size={15}/>Listo</button>
            <button style={btn("primary")} onClick={()=>window.print()}><Icon name="print" size={15}/>Imprimir</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default POS;
