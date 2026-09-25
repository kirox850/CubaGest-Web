import { useState, useEffect } from "react";
import { getPendingCount, type OfflineAccount } from "@/offlineDB";

// ─── OFFLINE HOOKS (extraídos de App.tsx) ─────────────────────────────────────

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
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
