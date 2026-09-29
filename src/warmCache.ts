// ─── WARM CACHE (web): bajar TODO al entrar, sin ir pantalla por pantalla ────
//
// Antes, una caché offline se creaba de rebote: cada pantalla guardaba la suya
// cuando se abría, y solo esa. Un cajero que entraba, visitaba el POS y perdía
// la red un rato después tenía inventario y sí, pero se encontraba la
// pantalla de cierres, la de facturas y la de contabilidad vacías.
//
// `warmCache()` baja y guarda TODAS las colecciones de una vez, para que la app
// sea usable sin red en cuanto la sesión se resuelve. No tiene que hacer nada:
// entrar ya es suficiente.
//
// DOS REGLAS que este archivo no rompe:
//
//  1. NUNCA lanza. Un 500 en una colección no puede abortar las demás, o una
//     sola falla y el cajero se queda sin catálogo además de sin contabilidad.
//     Cada paso va en su propio try y se reporta por separado.
//  2. La caja se resuelve ANTES de bajar el stock. El stock se cachea POR
//     ubicación: bajarlo sin saber en qué caja se trabaja lo escribe en el
//     namespace equivocado, que es la causa clásica de "el POS en blanco al
//     quedarse sin red".

import { apiFetch } from "@/lib/api";
import {
  cacheProducts, cacheLocations, cacheReadings,
  cacheSales, cacheMovements, cacheSettings, cacheDiscounts,
  getLastLocationId, type OfflineAccount,
} from "./offlineDB";

export interface WarmStep {
  nombre: string;
  ok: boolean;
  detalle?: string;
}

export interface WarmResult {
  ok: number;
  fallos: WarmStep[];
  pasos: WarmStep[];
}

export interface WarmOpts {
  account: OfflineAccount | null;
  /** Caja desde la que se trabaja. Opcional: se resuelve aquí si no se pasa. */
  locationId?: string;
}

/**
 * Un paso que falla NO aborta el resto. Cinco colecciones buenas y una mala es
 * un POS que funciona; abortar a la primera es un POS vacío.
 */
async function paso(nombre: string, fn: () => Promise<unknown>): Promise<WarmStep> {
  try {
    await fn();
    return { nombre, ok: true };
  } catch (e: any) {
    return { nombre, ok: false, detalle: e?.message || String(e) };
  }
}

/**
 * Descarga y guarda todas las colecciones. Pensada para correr UNA vez, al
 * entrar con red. Es idempotente: volver a llamarla solo refresca.
 */
export async function warmCache(opts: WarmOpts): Promise<WarmResult> {
  const { account, locationId } = opts;
  const pasos: WarmStep[] = [];
  const registrar = (p: WarmStep) => { pasos.push(p); };

  if (!account || !account.companyId || !account.userId) return { ok: 0, fallos: [], pasos };

  // ── 1. Turno y cajas asignadas ────────────────────────────────────────────
  // Van PRIMERO porque de aquí sale la caja en la que se trabaja. Y la lista de
  // cajas se guarda aunque no haya turno abierto: es lo que permite saber dónde
  // puede vender sin red, que es justamente lo que se perdía.
  let shiftLocationId: string | null = null;
  registrar(await paso('turno', async () => {
    const r = await apiFetch("/shift/current");
    shiftLocationId = r?.shift?.locationId ?? null;
    const cajas = Array.isArray(r?.assignedCajas) ? r.assignedCajas : [];
    // Se usa el mismo registro que escribe `useShift`, para que login y
    // reconexión no dejen dos copias que puedan divergir.
    try {
      localStorage.setItem(
        "cubagest_shift",
        JSON.stringify({ shift: r?.shift ?? null, cajas }),
      );
    } catch { /* almacenamiento lleno: no rompe nada */ }
  }));

  // ── 2. Ubicaciones ────────────────────────────────────────────────────────
  registrar(await paso('ubicaciones', async () => {
    await cacheLocations(account, await apiFetch("/locations"));
  }));

  // ── 3. Catálogo de la caja en la que se trabaja ───────────────────────────
  // El orden para decidir cuál es: el TURNO manda (es la caja en la que de
  // verdad se está vendiendo), luego la última conocida. Es la misma
  // precedencia que usa el POS.
  const caja = locationId || shiftLocationId || (await getLastLocationId(account)) || "";
  if (caja) {
    registrar(await paso('productos', async () => {
      const { items } = await apiFetch(`/locations/${caja}/stock`);
      await cacheProducts({ companyId: account.companyId, userId: account.userId, locationId: caja }, items);
    }));
  }

  // ── 4. El resto, en paralelo. Son independientes entre sí. ────────────────
  const resto = await Promise.all([
    paso('lecturas', async () => { await cacheReadings(account, await apiFetch("/closing/readings")); }),
    paso('ventas', async () => { await cacheSales(account, await apiFetch("/sales")); }),
    paso('movimientos', async () => { await cacheMovements(account, await apiFetch("/cash-movements")); }),
    paso('ajustes', async () => { await cacheSettings(account, await apiFetch("/settings")); }),
    paso('descuentos', async () => { await cacheDiscounts(account, await apiFetch("/discounts")); }),
  ]);
  resto.forEach(registrar);

  const fallos = pasos.filter((p) => !p.ok);
  return { ok: pasos.length - fallos.length, fallos, pasos };
}
