import { useState, useEffect } from "react";
import { getPendingCount } from "@/offlineDB";

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

export function usePendingCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => getPendingCount().then(setCount);
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, []);
  return { count, refresh: () => getPendingCount().then(setCount) };
}
