import { useState, useEffect, useRef } from "react";
import { apiFetch, isTransportError } from "@/lib/api";
import { fmt } from "@/lib/format";
import { useOnlineStatus } from "@/hooks/useOnline";
import { PAY_METHODS, CURRENCY_SYMBOLS } from "@/config/constants";
import {
  cacheProducts, getOfflineProducts, saveSaleOffline,
  getLastLocationId, setLastLocationId, newClientSaleId,
} from "@/offlineDB";
import Icon from "@/components/shared/Icon";
import { Modal, Field, Spinner, btn, inp, sel } from "@/components/shared/primitives";

// ─── POS ──────────────────────────────────────────────────────────────────────
// Impresión: al imprimir se oculta TODA la app y solo sale el recibo
// (.cg-receipt-print-area), centrado y con ancho de ticket.
const posStyles = `
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
  // Transferencia: nombre + teléfono + carnet son obligatorios (el carnet
  // se valida en el propio campo: se pide solo si está vacío).
  const needsTransferData = payMethod === "transferencia";
  const curSym = CURRENCY_SYMBOLS[saleCurrency] || "$";
  // Moneda del recibo: la venta online devuelve currency; la offline la
  // guardamos al vuelo (antes los items salían con $ aunque fuera CUP).
  const recCur = lastReceipt?.currency || saleCurrency;
  const recSym = CURRENCY_SYMBOLS[recCur] || "$";

  const [myLocationId, setMyLocationId] = useState<string>("");
  const [myLocationName, setMyLocationName] = useState<string>("");

  // Espacio de nombres de los datos locales de ESTA cuenta en ESTA ubicación.
  // El catálogo y el stock cacheados nunca se mezclan con los de otra cuenta ni
  // con los de otra caja/almacén del mismo negocio.
  const account = { companyId: user?.company?.id || "", userId: user?.id || "" };
  const scopeOf = (locationId: string) => ({ ...account, locationId });
  // Última ubicación conocida de esta cuenta. Nunca lanza: un fallo del
  // almacenamiento local no debe tumbar la pantalla ni el cobro.
  const lastKnownLocation = () => getLastLocationId(account).catch(() => undefined);
  // El recibo es LA FACTURA del negocio del cliente, no de CubaGest (el
  // branding propio va solo en un pie discreto). El carnet del comprador
  // aparece solo cuando se capturó (transferencias).
  const companyName = user?.company?.name || "Mi Negocio";

  // Descuentos utilizables desde MI ubicación (el backend re-valida todo):
  // activos, dentro de su vigencia y disponibles en esta location.
  const usableDiscounts = discounts.filter(d =>
    d.active !== false &&
    (!d.startsAt || new Date(d.startsAt) <= new Date()) &&
    (!d.endsAt || new Date(d.endsAt) >= new Date()) &&
    (d.locationScope !== "seleccion" || (d.locationIds || []).includes(myLocationId))
  );
  const productDiscounts = usableDiscounts.filter(d=>d.scope==="producto");
  // ── Descuento por venta (al total) — solo en línea (offline no lo soporta) ──
  const activeSaleDiscount = usableDiscounts.find(d=>d.id===saleDiscountId) || null;
  const saleDiscAmount = online && activeSaleDiscount ? (() => {
    if (activeSaleDiscount.type === "fijo") return Math.min(Number(activeSaleDiscount.value), subtotal);
    return subtotal * Number(activeSaleDiscount.value) / 100;
  })() : 0;
  // ── Descuentos por producto (por línea, mismo cálculo que el backend) ──
  const lineDiscount = (item: any) => {
    if (!online) return 0;
    const d = usableDiscounts.find(x=>x.id===item.discountId);
    if (!d) return 0;
    const base = item.price * item.qty;
    const amount = d.type === "porcentaje" ? base * Number(d.value) / 100 : Number(d.value) * item.qty;
    return Math.max(0, Math.min(amount, base));
  };
  const itemDiscountTotal = cart.reduce((a,i)=>a+lineDiscount(i),0);
  const total = Math.max(0, subtotal - saleDiscAmount - itemDiscountTotal);
  const change = Number(cashGiven) - total;

  useEffect(()=>{
    let cancelled = false;

    // El stock que se muestra y se puede cobrar es el LOCAL: el último stock
    // del servidor menos las ventas de este dispositivo que siguen pendientes.
    // Así, sin conexión o nada más volver de la conexión, nunca se ofrece
    // mercancía que ya se vendió.
    const applyStock = (list: any[]) =>
      list.map(p => ({ ...p, stock: p.stock !== undefined && p.localStock !== undefined ? p.localStock : p.stock }))
          .filter(p => p.stock > 0);

    // Catálogo local de ESTA cuenta en ESTA ubicación.
    const loadFromCache = async (locationId: string) => {
      const cached = locationId ? await getOfflineProducts(scopeOf(locationId)) : [];
      if (cancelled) return;
      setProducts(applyStock(cached as any[]));
      setLoading(false);
    };

    const load = async () => {
      if (!account.companyId || !account.userId) { setProducts([]); setLoading(false); return; }

      if (!online) {
        // Sin conexión no se puede llamar a /locations, pero esta cuenta ya
        // sabe desde cuál ubicación vende: se recuerda la última.
        const lastLoc = await lastKnownLocation();
        if (lastLoc) setMyLocationId(lastLoc);
        await loadFromCache(lastLoc || "");
        return;
      }

      try {
        const locs: any[] = await apiFetch("/locations");
        const own = user.role === "almacenista" ? locs.find((l:any)=>l.type==="almacen")
          : locs.find((l:any)=>l.ownerUserId===user.id);
        if (!own) { setProducts([]); setLoading(false); return; }
        if (cancelled) return;
        setMyLocationId(own.id);
        setMyLocationName(own.name);
        // Se recuerda la ubicación para poder seguir vendiendo sin conexión.
        setLastLocationId(account, own.id).catch(() => {});
        const { items } = await apiFetch(`/locations/${own.id}/stock`);
        await cacheProducts(scopeOf(own.id), items);
        if (cancelled) return;
        await loadFromCache(own.id);
      } catch (e: any) {
        if (cancelled) return;
        // Antes esto siempre decía "Sin conexión", aunque la causa real
        // fuera otra (ej. permisos) — ahora distinguimos.
        if (e?.kind === "auth") return; // ya se maneja aparte
        const msg = online ? (e?.message || "Error al cargar productos") : "Sin conexión — cargando productos offline";
        showToast(msg, "warning");
        const lastLoc = await lastKnownLocation();
        if (lastLoc) setMyLocationId(lastLoc);
        await loadFromCache(lastLoc || "");
      }
    };

    // El .catch evita que un fallo puntual del almacenamiento local quede como
    // una promesa rechazada sin manejar (la pantalla se quedaría cargando).
    load().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
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
      return showToast("Complete nombre, carnet y teléfono del cliente para transferencia","error");
    }
    setProcessing(true);
    // Identidad de la venta: un UUID del dispositivo, el MISMO en cada
    // reintento. Es lo que permite que el servidor devuelva la factura
    // original en vez de crear una segunda si se repite el envío.
    const clientSaleId = newClientSaleId();
    // Ubicación inmutable de la venta. Sin ella no se puede descontar el stock
    // ni sincronizar más adelante. Si la pantalla aún no la conoce (la primera
    // vez que se entra ya sin conexión), se recupera la última de la cuenta.
    // Se lee con .catch para que un fallo del almacenamiento local no deje el
    // botón "Cobrar" colgado sin poder terminar.
    const locationId = myLocationId || (await lastKnownLocation()) || "";
    // El carrito tal como se cobraría. Si la venta acaba guardada en el
    // dispositivo, se guarda EXACTAMENTE lo mismo que se iba a cobrar.
    const saleItems = cart.map(i=>({
      productId: i.id, name: i.name, qty: i.qty, price: i.price, total: i.price*i.qty,
    }));
    const saleData = {
      clientSaleId,
      locationId: locationId || undefined,
      clientName: needsTransferData ? clientName : "Consumidor Final",
      clientNit: needsTransferData ? clientNit : "00000000000",
      clientPhone: needsTransferData ? clientPhone : undefined,
      items: online ? saleItems.map((it, n) => (cart[n].discountId ? { ...it, discountId: cart[n].discountId } : it)) : saleItems,
      payMethod,
      subtotal,
      total,
      discountId: online && saleDiscountId ? saleDiscountId : undefined,
      currency: saleCurrency,
    };
    const hasDiscount = !!saleDiscountId || cart.some(i => !!i.discountId);

    const clearForm = () => {
      setCart([]);
      setSearch(""); setCashGiven(""); setSaleDiscountId("");
      setClientName(""); setClientNit(""); setClientPhone("");
    };

    // Captura local: no necesita servidor. Se guarda con su locationId y su
    // clientSaleId para que la sincronización posterior sea idempotente, y
    // descuenta el stock de esta ubicación en el dispositivo.
    const captureOffline = async () => {
      const offlineSale = await saveSaleOffline(account, { ...saleData, locationId, items: saleItems });
      setLastReceipt({ ...offlineSale, id: offlineSale.localId, isOffline: true });
      clearForm();
      // Refrescar la lista es cosmético: si falla, la venta YA quedó guardada y
      // no se debe reportar un error que haga creer que se perdió.
      try {
        const cached = await getOfflineProducts(scopeOf(locationId));
        setProducts(cached.map(p => ({ ...p, stock: p.localStock })).filter(p => p.stock > 0));
      } catch { /* se corrige en la próxima carga de la pantalla */ }
      return offlineSale;
    };

    try {
      if (!online) {
        const offlineSale = await captureOffline();
        showToast(`Factura ${offlineSale.localId} guardada offline`,"info");
        return;
      }

      // Online normal
      const invoice = await apiFetch("/sales", { method:"POST", body: saleData, timeoutMs: 15000 });

      // A partir de aquí la factura YA existe en el servidor: cualquier fallo
      // posterior es solo de refresco de la lista y NUNCA debe entrar en la
      // captura offline (crearía una venta duplicada en la cola).
      setLastReceipt(invoice);
      clearForm();
      showToast(`Factura ${invoice.id} emitida correctamente`,"success");

      if (locationId) {
        try {
          const { items } = await apiFetch(`/locations/${locationId}/stock`);
          await cacheProducts(scopeOf(locationId), items);
          const cached = await getOfflineProducts(scopeOf(locationId));
          setProducts(cached.map(p => ({ ...p, stock: p.localStock })).filter(p => p.stock > 0));
        } catch { /* la factura está emitida; el stock se refresca en la próxima carga */ }
      }
      return;
    } catch(e:any) {
      // El navegador puede decir "online" mientras el servidor no responde
      // (API caída, proxy colgado, datos móviles). Si el fallo es de red o de
      // tiempo de espera, la venta se guarda en el dispositivo para que el
      // cajero no pierda la operación. Si el servidor SÍ respondió —error de
      // validación o de permisos— no se encola nada: se muestra el error.
      if (isTransportError(e)) {
        if (hasDiscount) {
          // Un descuento se recalcula en el servidor: encolar la venta cambiaría
          // el total de la factura. Se avisa para que el cajero la cobre cuando
          // vuelva la conexión (el carrito sigue intacto).
          showToast("Sin respuesta del servidor y la venta lleva descuento: no se puede guardar pendiente. Inténtalo de nuevo con conexión.","warning");
          return;
        }
        if (locationId) {
          try {
            const offlineSale = await captureOffline();
            showToast(`Sin respuesta del servidor — factura ${offlineSale.localId} guardada offline`,"warning");
            return;
          } catch { /* si tampoco se pudo guardar local, se muestra el error */ }
        }
      }
      showToast(e.message,"error");
    }
    finally { setProcessing(false); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 120px)", gap:0 }}>
      <style>{posStyles}</style>
      <h2 style={{ margin:"0 0 4px", fontSize:20, fontWeight:800, color:"var(--ink)", flexShrink:0 }}>Punto de Venta</h2>
      {myLocationName && <p style={{ margin:"0 0 12px", fontSize:12, color:"var(--muted)", flexShrink:0 }}>Vendiendo desde: <strong>{myLocationName}</strong></p>}

      {/* Buscador fijo */}
      <div style={{ position:"relative", flexShrink:0, marginBottom:10 }}>
        <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}><Icon name="search" size={15} color="var(--muted)"/></span>
        <input style={{ ...inp, paddingLeft:34, paddingRight:88 }} placeholder="Buscar producto o escanear..." value={search}
          onChange={e=>setSearch(e.target.value)}
          onKeyDown={e=>{ if (e.key==="Enter") { if (tryBarcodeSearch(search)) return; const one = avail.length===1 ? avail[0] : null; if (one) { addToCart(one); setSearch(""); } } }}/>
        <button onClick={startCamera} title="Escanear código de barras" style={{ position:"absolute", right:44, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:4 }}>
          <Icon name="auditoria" size={18} color="var(--brand)"/>
        </button>
        <button onClick={()=>{ if (tryBarcodeSearch(search)) return; const one = avail.length===1 ? avail[0] : null; if (one) { addToCart(one); setSearch(""); } }} title="Agregar coincidencia única" style={{ position:"absolute", right:6, top:"50%", transform:"translateY(-50%)", background:"var(--brand-tint)", border:"none", borderRadius:8, cursor:"pointer", padding:"4px 7px", color:"var(--brand)", fontWeight:800, fontSize:13 }}>+</button>
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
                    <span style={{ width:22, textAlign:"center", fontSize:14, fontWeight:700, color:q>0?"var(--brand)":"var(--ink)" }}>{q}</span>
                    <button onClick={()=>setQty(p, q+1)} style={{ width:28, height:28, background:"var(--brand)", border:"none", borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><Icon name="plus" size={13} color="#ffffff"/></button>
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
          <Icon name="cart" size={18} color="var(--brand)"/>
          <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:"var(--ink)" }}>Carrito</h3>
          <span style={{ marginLeft:"auto", background:"var(--brand)", color:"#ffffff", borderRadius:20, padding:"1px 10px", fontSize:12, fontWeight:700 }}>{cart.length}</span>
        </div>

        {cart.length>0 && (
          <div style={{ maxHeight:80, overflowY:"auto", display:"flex", flexDirection:"column", gap:4 }}>
        {cart.map(item=>{
          const ld = lineDiscount(item);
          return (
            <div key={item.id} style={{ display:"flex", flexDirection:"column", gap:2, borderBottom:"1px dashed var(--line)", paddingBottom:4 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                <span style={{ color:"var(--ink)" }}>{item.qty}× {item.name}</span>
                <span style={{ fontWeight:700 }}>{curSym}{fmt(item.price*item.qty)}</span>
              </div>
              {online && productDiscounts.length>0 && (
                <select style={{ ...sel, fontSize:11, padding:"3px 6px" }} value={item.discountId||""}
                  onChange={e=>setCart(prev=>prev.map(i=>i.id===item.id?{...i,discountId:e.target.value||undefined}:i))}>
                  <option value="">Sin descuento</option>
                  {productDiscounts.map(d=><option key={d.id} value={d.id}>{d.code || d.name} ({d.type==="porcentaje"?`${d.value}%`:`${curSym}${d.value}/u`})</option>)}
                </select>
              )}
              {ld>0 && <div style={{ fontSize:11, color:"#DC2626" }}>Descuento: -{curSym}{fmt(ld)}</div>}
            </div>
          );
        })}
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
          {online && usableDiscounts.some(d=>d.scope==="venta") && (
            <Field label="Descuento">
              <select style={{ ...sel, fontSize:12, padding:"6px 10px" }} value={saleDiscountId} onChange={e=>setSaleDiscountId(e.target.value)}>
                <option value="">—</option>
                {usableDiscounts.filter(d=>d.scope==="venta").map(d=>(
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
        {itemDiscountTotal>0 && (
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#DC2626" }}>
            <span>Descuento por producto:</span>
            <span>-{curSym}{fmt(itemDiscountTotal)}</span>
          </div>
        )}

        {needsTransferData && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <input style={{ ...inp, fontSize:12 }} value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Nombre del cliente *"/>
            <div style={{ display:"flex", gap:8 }}>
              <input style={{ ...inp, fontSize:12, flex:1, fontFamily:"monospace" }} value={clientNit} onChange={e=>setClientNit(e.target.value)} maxLength={11} placeholder="Carnet *"/>
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
        <Modal title="Factura Emitida" onClose={()=>setLastReceipt(null)} width={420}>
          <div className="cg-receipt-print-area" style={{ fontFamily:"monospace", fontSize:12, lineHeight:1.8, background:"var(--input-bg)", padding:20, borderRadius:12, border:"1px solid var(--line)" }}>
            {lastReceipt.isOffline && <div style={{ background:"rgba(201,162,39,0.15)", color:"#856404", padding:"6px 10px", borderRadius:8, marginBottom:10, fontSize:11, textAlign:"center" as any, display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}><Icon name="zap" size={13}/>GUARDADA OFFLINE — se sincronizará al recuperar conexión</div>}
            <div style={{ textAlign:"center", marginBottom:12 }}>
              <div style={{ fontWeight:800, fontSize:16, color:"var(--ink)" }}>{companyName}</div>
              <div style={{ fontWeight:700, fontSize:13, color:"var(--muted)" }}>FACTURA</div>
              <div>No. <strong>{lastReceipt.invoiceNumber || lastReceipt.id || lastReceipt.localId}</strong> · Fecha: {lastReceipt.date?.split("T")[0]||lastReceipt.syncedAt||new Date().toISOString().split("T")[0]}</div>
            </div>
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"10px 0" }}/>
            <div>Cliente: {lastReceipt.clientName || lastReceipt.client || "Consumidor Final"}</div>
            {(lastReceipt.clientNit && lastReceipt.clientNit !== "00000000000") && <div>Carnet: {lastReceipt.clientNit}</div>}
            {lastReceipt.clientPhone && <div>Tel: {lastReceipt.clientPhone}</div>}
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"10px 0" }}/>
            {(lastReceipt.items||[]).map((item:any,i:number)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between" }}>
                <span>{item.qty}x {(item.name||item.Product?.name||"").slice(0,22)}</span>
                <span>{recSym}{fmt(item.total||item.price*item.qty)}</span>
              </div>
            ))}
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"10px 0" }}/>
            <div style={{ display:"flex", justifyContent:"space-between", fontWeight:800, fontSize:14, marginTop:4 }}><span>TOTAL:</span><span>{recSym}{fmt(lastReceipt.total)} {recCur}</span></div>
            <hr style={{ border:"none", borderTop:"1px dashed #ccc", margin:"10px 0" }}/>
            <div style={{ textAlign:"center", fontSize:10, color:"var(--ink)" }}>¡Gracias por su compra!</div>
            <div style={{ textAlign:"center", fontSize:8, color:"var(--muted)", marginTop:4 }}>Hecho con CubaGest</div>
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
