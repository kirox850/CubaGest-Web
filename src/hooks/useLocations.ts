import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import {
  cacheLocations, getOfflineLocations, cacheReadings, getOfflineReadings,
  getLastLocationId, setLastLocationId,
  type OfflineAccount, type OfflineLocation, type OfflineReading,
} from "@/offlineDB";
import { useOnlineStatus } from "./useOnline";

/**
 * Dónde estoy trabajando, con o sin conexión.
 *
 * Este hook existe por un motivo concreto: TODO lo demás depende de él. El
 * catálogo cacheado vive en un namespace que incluye la ubicación, así que sin
 * resolver la ubicación el POS y el inventario no tienen nada que mostrar. Y la
 * ubicación venía de `/locations`, que sin red no existe. Por eso el modo sin
 * conexión se veía roto entero: no era el inventario ni el POS, era que no
 * hadn't a qué caja belonged.
 *
 * Reglas:
 *  - con red: se pide al servidor y se cachea de paso;
 *  - sin red: se lee de la caché local;
 *  - sin red y sin caché (usuario nuevo): se dice claramente, no se finge.
 */
export function useLocations(user: any) {
  const online = useOnlineStatus();
  // OJO: la empresa vive en user.company.id, NO en user.companyId. Con
  // user.companyId el namespace quedaba vacío, el hook no hacía nada y las
  // lecturas nunca cargaban — justo lo que este hook viene a arreglar.
  const account: OfflineAccount = { companyId: user?.company?.id || "", userId: user?.id || "" };
  const ready = !!(account.companyId && account.userId);

  const [locations, setLocations] = useState<OfflineLocation[]>([]);
  const [locationId, setLocationId] = useState("");
  const [cargando, setCargando] = useState(true);
  const [sinCache, setSinCache] = useState(false);
  // Para no reventar la escritura: si el usuario mueve el selector, se guarda
  // una vez, no en cada render.
  const guardadoRef = useRef(false);

  const cargar = useCallback(async () => {
    if (!ready) return;
    if (online) {
      try {
        const locs = await apiFetch("/locations") as OfflineLocation[];
        setLocations(locs || []);
        await cacheLocations(account, locs || []);
        setSinCache(false);
        if (!guardadoRef.current && locs?.length) {
          // Primera vez con red: se fija la ubicación por defecto.
          const propia = locs.find((l) => l.type === "caja" || l.type === "almacen") || locs[0];
          setLocationId(prev => prev || propia.id);
        }
        return;
      } catch {
        // Con red pero el servidor fallando: se intenta igual con la caché,
        // que puede tener la última versión buena.
      }
    }
    try {
      const cached = await getOfflineLocations(account);
      if (cached.length > 0) {
        setLocations(cached);
        setSinCache(false);
        if (!guardadoRef.current && cached.length) {
          const ultima = await getLastLocationId(account);
          // La última usada manda: si el cajero vuelve a su propia caja, es la
          // suya. Si no, la primera disponible.
          const existe = ultima && cached.some((l) => l.id === ultima);
          setLocationId(prev => prev || (existe ? ultima! : cached[0].id));
        }
      } else {
        setSinCache(true);
        setLocations([]);
        setLocationId("");
      }
    } catch {
      setSinCache(true);
    }
  }, [ready, online, account.companyId, account.userId]);

  useEffect(() => { setCargando(true); cargar().finally(() => setCargando(false)); }, [cargar]);

  // Guardar la última ubicación usada, para el próximo arranque sin red.
  useEffect(() => {
    if (!ready || !locationId) return;
    setLastLocationId(account, locationId).catch(() => {});
  }, [ready, locationId, account.companyId, account.userId]);

  /**
   * Cambia la ubicación de trabajo. Acepta un id o un actualizador (igual que
   * un setState normal) para que las pantallas existentes no tengan que
   * cambiar su forma de llamarlo.
   */
  const elegir = useCallback((id: string | ((prev: string) => string)) => {
    setLocationId((prev) => {
      const next = typeof id === "function" ? id(prev) : id;
      if (next) setLastLocationId(account, next).catch(() => {});
      return next;
    });
  }, [account.companyId, account.userId]);

  return { locations, locationId, elegir, cargando, sinCache, online, onlineStatus: online, refresh: cargar };
}

/**
 * Lecturas de apertura pendientes, con o sin conexión.
 *
 * Son la base del conteo del cierre. Sin copia local no se puede empezar a
 * cerrar sin red, que es justo lo que pasaba.
 */
export function useReadings(user: any) {
  const online = useOnlineStatus();
  const account: OfflineAccount = { companyId: user?.company?.id || "", userId: user?.id || "" };
  const ready = !!(account.companyId && account.userId);

  const [readings, setReadings] = useState<OfflineReading[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!ready) return;
    setError(null);
    if (online) {
      try {
        const list = await apiFetch("/closing/readings") as OfflineReading[];
        setReadings(list || []);
        await cacheReadings(account, list || []);
        setCargando(false);
        return;
      } catch (e: any) {
        // Se cae al caché: se pudo haber usado sin red justo antes.
      }
    }
    try {
      const cached = await getOfflineReadings(account);
      setReadings(cached);
      if (cached.length === 0 && online) setError("No se pudieron cargar las lecturas.");
    } catch {
      setError("No se pudieron cargar las lecturas.");
    }
    setCargando(false);
  }, [ready, online, account.companyId, account.userId]);

  useEffect(() => { setCargando(true); cargar().finally(() => setCargando(false)); }, [cargar]);

  return { readings, cargando, error, refresh: cargar };
}
