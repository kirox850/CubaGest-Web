import { useState, useEffect } from "react";
import { getPendingCount, getPendingClosings, type OfflineAccount } from "@/offlineDB";
import { onNetworkChange } from "@/lib/api";

// ─── OFFLINE HOOKS (extraídos de App.tsx) ─────────────────────────────────────

export function useOnlineStatus() {
  // Son DOS señales, y las dos hacen falta:
  //  - navigator.onLine: el sistema avisa cuando se quita la antena.
  //  - la red real vista por api.ts: detecta el WiFi que "conecta" pero no
  //    lleva a ningún sitio, que es el caso más común en un negocio.
  // Con una sola de las dos la app se equivoca en la mitad de los cortes.
  const [netReal, setNetReal] = useState(true);
  const [delNavegador, setDelNavegador] = useState(navigator.onLine);
  useEffect(() => onNetworkChange(setNetReal), []);
  useEffect(() => {
    const on = () => setDelNavegador(true);
    const off = () => setDelNavegador(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return delNavegador && netReal;
}

// Cuenta las ventas pendientes DE ESTA CUENTA. El namespace es obligatorio: sin
// companyId/userId no se lee nada, para no exponer la cola de otra cuenta.
export function usePendingCount(account: OfflineAccount | null) {
  const [count, setCount] = useState(0);
  const ready = !!(account?.companyId && account?.userId);
  useEffect(() => {
    if (!ready || !account) { setCount(0); return; }
    const update = () => getPendingCount(account).then(setCount).catch(() => setCount(0));
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [ready, account?.companyId, account?.userId]);
  return { count, refresh: () => (account ? getPendingCount(account) : Promise.resolve(0)) };
}


// Cierres contados sin conexión y aún no enviados. Va aparte de las ventas
// porque el banner tiene que poder decir "1 venta y 2 cierres en cola", no un
// número mezclado que no significa nada para quien lo lee.
export function usePendingClosingsCount(account: OfflineAccount | null) {
  const [count, setCount] = useState(0);
  const ready = !!(account?.companyId && account?.userId);
  useEffect(() => {
    if (!ready || !account) { setCount(0); return; }
    const update = () => getPendingClosings(account).then((l) => setCount(l.length)).catch(() => setCount(0));
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [ready, account?.companyId, account?.userId]);
  return count;
}
