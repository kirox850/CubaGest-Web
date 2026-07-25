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
}

export async function getOfflineProducts(): Promise<OfflineProduct[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, ['products']).objectStore('products').getAll();
    req.onsuccess = () => resolve((req.result as OfflineProduct[]).filter(p => p.active));
    req.onerror = () => reject(req.error);
  });
}

export async function decrementLocalStock(productId: string, qty: number): Promise<void> {
  const db = await openDB();
  const t = tx(db, ['products'], 'readwrite');
  const store = t.objectStore('products');
  const req = store.get(productId);
  req.onsuccess = () => {
    const p = req.result as OfflineProduct;
    if (p) {
      p.localStock = Math.max(0, p.localStock - qty);
      store.put(p);
    }
  };
}

export async function restoreLocalStock(items: OfflineSaleItem[]): Promise<void> {
  const db = await openDB();
  const t = tx(db, ['products'], 'readwrite');
  const store = t.objectStore('products');
  for (const item of items) {
    const req = store.get(item.productId);
    req.onsuccess = () => {
      const p = req.result as OfflineProduct;
      if (p) { p.localStock += item.qty; store.put(p); }
    };
  }
}

// ── Cola de ventas ─────────────────────────────────────────────────────────────
let localCounter = 0;

export async function getNextLocalId(): Promise<string> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, ['app_meta'], 'readwrite').objectStore('app_meta').get('localCounter');
    req.onsuccess = () => {
      const val = (req.result?.value || 0) + 1;
      tx(db, ['app_meta'], 'readwrite').objectStore('app_meta').put({ key: 'localCounter', value: val });
      resolve(`LOCAL-${String(val).padStart(4, '0')}`);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveSaleOffline(sale: Omit<OfflineSale, 'localId' | 'status' | 'timestamp'>): Promise<OfflineSale> {
  const db = await openDB();
  const localId = await getNextLocalId();
  const fullSale: OfflineSale = {
    ...sale,
    localId,
    status: 'pending',
    timestamp: Date.now(),
  };

  await new Promise<void>((resolve, reject) => {
    const req = tx(db, ['sales_queue'], 'readwrite').objectStore('sales_queue').put(fullSale);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // Descontar stock local
  for (const item of sale.items) {
    await decrementLocalStock(item.productId, item.qty);
  }

  return fullSale;
}

export async function getPendingSales(): Promise<OfflineSale[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, ['sales_queue']).objectStore('sales_queue').getAll();
    req.onsuccess = () => {
      const all = req.result as OfflineSale[];
      resolve(all.filter(s => s.status === 'pending').sort((a, b) => a.timestamp - b.timestamp));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getAllOfflineSales(): Promise<OfflineSale[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, ['sales_queue']).objectStore('sales_queue').getAll();
    req.onsuccess = () => resolve((req.result as OfflineSale[]).sort((a, b) => b.timestamp - a.timestamp));
    req.onerror = () => reject(req.error);
  });
}

export async function updateSaleStatus(localId: string, status: SyncStatus, serverId?: string, conflictReason?: string): Promise<void> {
  const db = await openDB();
  const t = tx(db, ['sales_queue'], 'readwrite');
  const store = t.objectStore('sales_queue');
  const req = store.get(localId);
  req.onsuccess = () => {
    const sale = req.result as OfflineSale;
    if (sale) {
      sale.status = status;
      if (serverId) sale.serverId = serverId;
      if (conflictReason) sale.conflictReason = conflictReason;
      if (status === 'synced') sale.syncedAt = Date.now();
      store.put(sale);
    }
  };
}

export async function getPendingCount(): Promise<number> {
  const pending = await getPendingSales();
  return pending.length;
}

// ── Sync log ──────────────────────────────────────────────────────────────────
export async function saveSyncLog(log: Omit<SyncLog, 'id'>): Promise<void> {
  const db = await openDB();
  const fullLog: SyncLog = { ...log, id: `sync-${Date.now()}` };
  await new Promise<void>((resolve, reject) => {
    const req = tx(db, ['sync_log'], 'readwrite').objectStore('sync_log').put(fullLog);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Meta ──────────────────────────────────────────────────────────────────────
export async function getLastSync(): Promise<number | null> {
  const db = await openDB();
  return new Promise((resolve) => {
    const req = tx(db, ['app_meta']).objectStore('app_meta').get('lastProductSync');
    req.onsuccess = () => resolve(req.result?.value || null);
    req.onerror = () => resolve(null);
  });
}

export async function clearOfflineData(): Promise<void> {
  const db = await openDB();
  const t = tx(db, ['products', 'sales_queue', 'app_meta'], 'readwrite');
  t.objectStore('products').clear();
  t.objectStore('sales_queue').clear();
  t.objectStore('app_meta').clear();
}
