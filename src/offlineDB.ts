// ─── CUBAGEST OFFLINE DATABASE ───────────────────────────────────────────────
// Wrapper sobre IndexedDB para manejar datos offline

const DB_NAME = 'cubagest_offline';
const DB_VERSION = 1;

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'conflict';

export interface OfflineProduct {
  id: string;
  code: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
  localStock: number; // stock descontado localmente
  unit: string;
  category: string;
  active: boolean;
  cachedAt: number;
}

export interface OfflineSaleItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  total: number;
}

export interface OfflineSale {
  localId: string;       // ID local temporal (LOCAL-001)
  serverId?: string;     // ID del servidor tras sync
  timestamp: number;     // Para ordenar en sincronización
  status: SyncStatus;
  client: string;
  clientNit: string;
  clientPhone?: string;
  payMethod: string;
  items: OfflineSaleItem[];
  subtotal: number;
  total: number;
  conflictReason?: string;
  syncedAt?: number;
}

export interface SyncLog {
  id: string;
  timestamp: number;
  salesSynced: number;
  salesConflict: number;
  error?: string;
}

// ── Helpers de promisificación ─────────────────────────────────────────────
// Convierte un IDBRequest en una Promise que resuelve con su resultado.
function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Espera a que una transacción termine de verdad (oncomplete), no solo a que
// se haya encolado la última petición. Esto es lo que garantiza que los
// datos ya quedaron escritos en el disco antes de continuar.
function txDone(t: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onabort = () => reject(t.error || new Error('Transacción de IndexedDB abortada'));
    t.onerror = () => reject(t.error || new Error('Error en transacción de IndexedDB'));
  });
}

// ── Abrir DB ──────────────────────────────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('products')) {
        const ps = db.createObjectStore('products', { keyPath: 'id' });
        ps.createIndex('active', 'active');
      }
      if (!db.objectStoreNames.contains('sales_queue')) {
        const ss = db.createObjectStore('sales_queue', { keyPath: 'localId' });
        ss.createIndex('status', 'status');
        ss.createIndex('timestamp', 'timestamp');
      }
      if (!db.objectStoreNames.contains('sync_log')) {
        db.createObjectStore('sync_log', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('app_meta')) {
        db.createObjectStore('app_meta', { keyPath: 'key' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db: IDBDatabase, stores: string[], mode: IDBTransactionMode = 'readonly') {
  return db.transaction(stores, mode);
}

// ── Productos ─────────────────────────────────────────────────────────────────
export async function cacheProducts(products: any[]): Promise<void> {
  const db = await openDB();
  const t = tx(db, ['products', 'app_meta'], 'readwrite');
  const store = t.objectStore('products');

  // Limpiar cache anterior
  store.clear();

  for (const p of products) {
    store.put({
      id: p.id,
      code: p.code || '',
      name: p.name,
      price: Number(p.price),
      cost: Number(p.cost || 0),
      stock: Number(p.stock),
      localStock: Number(p.stock),
      unit: p.unit || 'ud',
      category: p.category || '',
      active: p.active !== false,
      cachedAt: Date.now(),
    } as OfflineProduct);
  }

  t.objectStore('app_meta').put({ key: 'lastProductSync', value: Date.now() });

  // Esperamos a que la transacción confirme (oncomplete) antes de resolver,
  // para no dar por hecho el guardado antes de que ocurra de verdad.
  await txDone(t);
}

export async function getOfflineProducts(): Promise<OfflineProduct[]> {
  const db = await openDB();
  const req = tx(db, ['products']).objectStore('products').getAll();
  const all = await reqToPromise(req) as OfflineProduct[];
  return all.filter(p => p.active);
}

export async function decrementLocalStock(productId: string, qty: number): Promise<void> {
  const db = await openDB();
  const t = tx(db, ['products'], 'readwrite');
  const store = t.objectStore('products');

  // get() y put() dentro de la MISMA transacción: o se aplican los dos, o
  // ninguno (si algo falla, la transacción se aborta entera).
  const p = await reqToPromise(store.get(productId)) as OfflineProduct | undefined;
  if (p) {
    p.localStock = Math.max(0, p.localStock - qty);
    store.put(p);
  }

  await txDone(t);
}

export async function restoreLocalStock(items: OfflineSaleItem[]): Promise<void> {
  const db = await openDB();
  const t = tx(db, ['products'], 'readwrite');
  const store = t.objectStore('products');

  // Todos los items se restauran dentro de la misma transacción: o se
  // restauran todos, o ninguno.
  for (const item of items) {
    const p = await reqToPromise(store.get(item.productId)) as OfflineProduct | undefined;
    if (p) {
      p.localStock += item.qty;
      store.put(p);
    }
  }

  await txDone(t);
}

// ── Cola de ventas ─────────────────────────────────────────────────────────────

// Genera el siguiente ID local (LOCAL-0001, LOCAL-0002...) leyendo y
// escribiendo el contador dentro de UNA SOLA transacción readwrite, para que
// dos ventas casi simultáneas nunca puedan leer el mismo valor.
async function getNextLocalIdInTx(t: IDBTransaction): Promise<string> {
  const metaStore = t.objectStore('app_meta');
  const current = await reqToPromise(metaStore.get('localCounter')) as { key: string; value: number } | undefined;
  const val = (current?.value || 0) + 1;
  metaStore.put({ key: 'localCounter', value: val });
  return `LOCAL-${String(val).padStart(4, '0')}`;
}

// Se mantiene exportada por compatibilidad, pero ahora es atómica: get+put
// ocurren en la misma transacción antes de resolver.
export async function getNextLocalId(): Promise<string> {
  const db = await openDB();
  const t = tx(db, ['app_meta'], 'readwrite');
  const id = await getNextLocalIdInTx(t);
  await txDone(t);
  return id;
}

export async function saveSaleOffline(sale: Omit<OfflineSale, 'localId' | 'status' | 'timestamp'>): Promise<OfflineSale> {
  const db = await openDB();
  // Una sola transacción que cubre: generar el ID local, guardar la venta y
  // descontar el stock local de cada producto. O se guarda todo, o no se
  // guarda nada — ya no puede quedar "a medias".
  const t = tx(db, ['app_meta', 'sales_queue', 'products'], 'readwrite');

  const localId = await getNextLocalIdInTx(t);
  const fullSale: OfflineSale = {
    ...sale,
    localId,
    status: 'pending',
    timestamp: Date.now(),
  };

  t.objectStore('sales_queue').put(fullSale);

  const productsStore = t.objectStore('products');
  for (const item of sale.items) {
    const p = await reqToPromise(productsStore.get(item.productId)) as OfflineProduct | undefined;
    if (p) {
      p.localStock = Math.max(0, p.localStock - item.qty);
      productsStore.put(p);
    }
  }

  await txDone(t);
  return fullSale;
}

export async function getPendingSales(): Promise<OfflineSale[]> {
  const db = await openDB();
  const req = tx(db, ['sales_queue']).objectStore('sales_queue').getAll();
  const all = await reqToPromise(req) as OfflineSale[];
  return all.filter(s => s.status === 'pending').sort((a, b) => a.timestamp - b.timestamp);
}

export async function getAllOfflineSales(): Promise<OfflineSale[]> {
  const db = await openDB();
  const req = tx(db, ['sales_queue']).objectStore('sales_queue').getAll();
  const all = await reqToPromise(req) as OfflineSale[];
  return all.sort((a, b) => b.timestamp - a.timestamp);
}

export async function updateSaleStatus(localId: string, status: SyncStatus, serverId?: string, conflictReason?: string): Promise<void> {
  const db = await openDB();
  const t = tx(db, ['sales_queue'], 'readwrite');
  const store = t.objectStore('sales_queue');

  const sale = await reqToPromise(store.get(localId)) as OfflineSale | undefined;
  if (sale) {
    sale.status = status;
    if (serverId) sale.serverId = serverId;
    if (conflictReason) sale.conflictReason = conflictReason;
    if (status === 'synced') sale.syncedAt = Date.now();
    store.put(sale);
  }

  await txDone(t);
}

export async function getPendingCount(): Promise<number> {
  const pending = await getPendingSales();
  return pending.length;
}

// ── Sync log ──────────────────────────────────────────────────────────────────
export async function saveSyncLog(log: Omit<SyncLog, 'id'>): Promise<void> {
  const db = await openDB();
  const fullLog: SyncLog = { ...log, id: `sync-${Date.now()}` };
  const t = tx(db, ['sync_log'], 'readwrite');
  t.objectStore('sync_log').put(fullLog);
  await txDone(t);
}

// ── Meta ──────────────────────────────────────────────────────────────────────
export async function getLastSync(): Promise<number | null> {
  const db = await openDB();
  try {
    const req = tx(db, ['app_meta']).objectStore('app_meta').get('lastProductSync');
    const result = await reqToPromise(req) as { key: string; value: number } | undefined;
    return result?.value ?? null;
  } catch {
    return null;
  }
}

export async function clearOfflineData(): Promise<void> {
  const db = await openDB();
  const t = tx(db, ['products', 'sales_queue', 'app_meta'], 'readwrite');
  t.objectStore('products').clear();
  t.objectStore('sales_queue').clear();
  t.objectStore('app_meta').clear();
  await txDone(t);
}
