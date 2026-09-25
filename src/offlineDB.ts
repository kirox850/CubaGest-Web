// ─── CUBAGEST OFFLINE DATABASE ───────────────────────────────────────────────
// Wrapper sobre IndexedDB para manejar datos offline.
//
// AISLAMIENTO POR CUENTA (P0 · dispositivos personales)
// Cada persona usa su propio dispositivo, así que al cerrar sesión NO se borra
// nada: el catálogo, el stock y la cola de ventas se conservan para reutilizarlos
// en el próximo inicio de sesión. Lo que sí cambia es el espacio de nombres:
//   - Companyía  → companyId
//   - Usuario    → userId
//   - Ubicación  → locationId
// El stock cacheado es por ubicación (el de una caja no es el del almacén) y la
// cola de ventas pertenece a la cuenta (companyId+userId) guardando en cada
// venta su locationId INMUTABLE, de modo que:
//   · un dispositivo usado por dos cuentas nunca carga ni reenvía la cola de la
//     otra (claves distintas por usuario y compañía);
//   · si la misma persona vendiera en dos ubicaciones, sus ventas NO se separan
//     en dos colas: se synchronizan juntas y ninguna queda olvidada.
//
// La base de datos es local y rápida: no se añadió ninguna consulta al servidor
// ni al backend a la operación offline ordinaria.

const DB_NAME = 'cubagest_offline_v2';
// La base anterior (v1) guardaba todo SIN namespace. Sus datos no se pueden
// atribuir con certeza a una cuenta, así que se descartan en vez de importarse
// a la cuenta que entre ahora (mismo criterio que en la app móvil).
const LEGACY_DB_NAME = 'cubagest_offline';
const LEGACY_PURGE_FLAG = 'cubagest_offline_legacy_purged';
const DB_VERSION = 1;

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'conflict';

// ── Alcances (namespaces) ─────────────────────────────────────────────────────
export interface OfflineAccount { companyId: string; userId: string }
export interface OfflineScope extends OfflineAccount { locationId?: string | null }

const seg = (v: unknown) => encodeURIComponent(String(v ?? "").trim() || "-");
/** Clave de cuenta: aísla a un usuario dentro de una compañía. */
export const accountKey = (a: OfflineAccount) => `${seg(a.companyId)}::${seg(a.userId)}`;
/** Clave de ubicación: aísla el stock de cada caja/almacén. */
export const scopeKey = (s: OfflineScope) => `${accountKey(s)}::${seg(s.locationId)}`;

export interface OfflineProduct {
  key: string;        // clave del store = scopeKey::productId
  scope: string;      // scopeKey (companyId + userId + locationId)
  locationId: string; // ubicación a la que pertenece este stock
  id: string;         // id real del producto (alias de productId)
  productId: string;
  code: string;
  barcode: string;
  name: string;
  price: number;
  cost: number;
  stock: number;      // último stock conocido del servidor
  localStock: number; // stock descontado localmente (incluye ventas pendientes)
  minStock: number;
  currency: string;
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
  discountId?: string;
}

export interface OfflineSale {
  key: string;        // clave del store = accountKey::localId
  account: string;    // accountKey
  localId: string;    // ID local temporal (LOCAL-0001)
  clientSaleId: string; // UUID del dispositivo — idempotencia en el servidor
  locationId: string; // INMUTABLE: dónde se registró la venta
  serverId?: string;  // ID del servidor tras sync
  invoiceNumber?: string;
  timestamp: number;  // momento local de la venta (auditoría)
  status: SyncStatus;
  client?: string;       // Compat con ventas antiguas guardadas antes del cambio
  clientName?: string;   // Nombre nuevo (coincide con el backend)
  clientNit: string;
  clientPhone?: string;
  payMethod: string;
  items: OfflineSaleItem[];
  subtotal: number;
  total: number;
  currency?: string;     // Moneda de la venta (multimoneda)
  discountId?: string;   // Descuento de venta aplicado
  conflictReason?: string;
  syncedAt?: number;
  lastAttemptAt?: number;
  attempts?: number;
}

export interface SyncLog {
  id: string;
  account: string; // accountKey — el log de una cuenta nunca se ve en otra
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

// ── ID de venta (UUID) ───────────────────────────────────────────────────────
// Idempotencia: el mismo UUID se reenvía en cada reintento de la misma venta,
// así el servidor puede devolver la factura original en vez de duplicarla.
export function newClientSaleId(): string {
  const c: any = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : null;
  if (c && typeof c.randomUUID === 'function') {
    try { return c.randomUUID(); } catch { /* cae al respaldo */ }
  }
  // Respaldo para contextos no seguros (http://) o navegadores antiguos.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Abrir DB ──────────────────────────────────────────────────────────────────
let _dbPromise: Promise<IDBDatabase> | null = null;

function purgeLegacyDb() {
  try {
    if (localStorage.getItem(LEGACY_PURGE_FLAG)) return;
    localStorage.setItem(LEGACY_PURGE_FLAG, '1');
  } catch { return; }
  try {
    const del = indexedDB.deleteDatabase(LEGACY_DB_NAME);
    del.onerror = () => {};
    del.onblocked = () => {};
  } catch { /* sin soporte: no es crítico */ }
}

function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      // Catálogo + stock, por ubicación.
      const ps = db.createObjectStore('products', { keyPath: 'key' });
      ps.createIndex('scope', 'scope');

      // Cola de ventas, por cuenta (companyId + userId).
      const ss = db.createObjectStore('sales_queue', { keyPath: 'key' });
      ss.createIndex('account', 'account');
      ss.createIndex('by_status', ['account', 'status']);
      ss.createIndex('by_time', ['account', 'timestamp']);

      const sl = db.createObjectStore('sync_log', { keyPath: 'id' });
      sl.createIndex('account', 'account');

      // Metadatos locales (contadores, marcas de tiempo, última ubicación).
      db.createObjectStore('app_meta', { keyPath: 'key' });
    };

    req.onsuccess = () => {
      const db = req.result;
      // Si otra pestaña/subida cambia el esquema, soltamos la conexión para no
      // quedarnos con un handle viejo.
      db.onversionchange = () => { db.close(); _dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => { _dbPromise = null; reject(req.error); };
    req.onblocked = () => { _dbPromise = null; reject(new Error('IndexedDB bloqueado por otra pestaña')); };
  });
  purgeLegacyDb();
  return _dbPromise;
}

function tx(db: IDBDatabase, stores: string[], mode: IDBTransactionMode = 'readonly') {
  return db.transaction(stores, mode);
}

const requireScope = (s: OfflineScope, who: string): OfflineScope => {
  if (!s?.companyId || !s?.userId) throw new Error(`Falta companyId/userId para ${who}`);
  return s;
};
const requireAccount = (a: OfflineAccount, who: string): OfflineAccount => {
  if (!a?.companyId || !a?.userId) throw new Error(`Falta companyId/userId para ${who}`);
  return a;
};

// ── Meta local ───────────────────────────────────────────────────────────────
const metaKey = (s: OfflineScope | OfflineAccount, key: string) => `${accountKey(s)}::${key}`;

async function readMeta<T>(s: OfflineScope | OfflineAccount, key: string): Promise<T | undefined> {
  const db = await openDB();
  const req = tx(db, ['app_meta']).objectStore('app_meta').get(metaKey(s, key));
  const row = await reqToPromise(req) as { key: string; value: T } | undefined;
  return row?.value;
}

async function writeMeta(s: OfflineScope | OfflineAccount, key: string, value: unknown): Promise<void> {
  const db = await openDB();
  const t = tx(db, ['app_meta'], 'readwrite');
  t.objectStore('app_meta').put({ key: metaKey(s, key), value });
  await txDone(t);
}

// Última ubicación conocida de la cuenta: permite que el POS siga sabiendo de
// dónde es la venta aunque entre a vender sin conexión (no puede llamar a
// /locations). Solo informativo: la locationId de cada venta es la que manda.
export const getLastLocationId = (a: OfflineAccount) => readMeta<string>(a, 'lastLocationId');
export const setLastLocationId = (a: OfflineAccount, locationId: string) =>
  writeMeta(a, 'lastLocationId', locationId);

export const getLastSync = (scope: OfflineScope) => readMeta<number>(scope, 'lastProductSync');

// ── Productos ─────────────────────────────────────────────────────────────────

// Vacía SOLO los productos de esta ubicación: los de otros usuarios/ubicaciones
// no se tocan (aislamiento entre cuentas).
function clearScopeProducts(store: IDBObjectStore, index: IDBIndex, scope: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = index.openKeyCursor(IDBKeyRange.only(scope));
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) { resolve(); return; }
      store.delete(cursor.primaryKey);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

// Cantidad ya descontada por ventas PENDIENTES de esta ubicación. Al refrescar
// el stock del servidor hay que volver a descontarla: si no, una venta offline
// pendiente desaparecería del cálculo local y el POS mostraría stock de más.
async function pendingQtyByProduct(store: IDBObjectStore, account: string): Promise<Map<string, number>> {
  const idx = store.index('by_status');
  const out = new Map<string, number>();
  const rows = await reqToPromise(
    idx.getAll(IDBKeyRange.only([account, 'pending'])),
  ) as OfflineSale[];
  const syncing = await reqToPromise(
    idx.getAll(IDBKeyRange.only([account, 'syncing'])),
  ) as OfflineSale[];
  for (const sale of [...rows, ...syncing]) {
    for (const item of sale.items || []) {
      const prev = out.get(item.productId) || 0;
      out.set(item.productId, prev + Number(item.qty || 0));
    }
  }
  return out;
}

// Reemplaza el catálogo cacheado de UNA ubicación. Todo en una sola transacción:
// o queda el stock nuevo (con las ventas locales aún descontadas), o no cambia
// nada.
export async function cacheProducts(scope: OfflineScope, products: any[]): Promise<void> {
  requireScope(scope, 'cacheProducts');
  const db = await openDB();
  const t = tx(db, ['products', 'sales_queue', 'app_meta'], 'readwrite');
  const store = t.objectStore('products');
  const sk = scopeKey(scope);
  const acc = accountKey(scope);

  const pending = await pendingQtyByProduct(t.objectStore('sales_queue'), acc);

  await clearScopeProducts(store, store.index('scope'), sk);

  for (const p of products) {
    const productId = String(p.id ?? p.productId ?? '');
    if (!productId) continue;
    const stock = Number(p.stock) || 0;
    store.put({
      key: `${sk}::${productId}`,
      scope: sk,
      locationId: String(scope.locationId || ''),
      id: productId,
      productId,
      code: p.code || '',
      barcode: p.barcode || '',
      name: p.name,
      price: Number(p.price),
      cost: Number(p.cost || 0),
      stock,
      localStock: Math.max(0, stock - (pending.get(productId) || 0)),
      minStock: Number(p.minStock || 0),
      currency: p.currency || 'CUP',
      unit: p.unit || 'ud',
      category: p.category || '',
      active: p.active !== false,
      cachedAt: Date.now(),
    } as OfflineProduct);
  }

  t.objectStore('app_meta').put({ key: metaKey(scope, 'lastProductSync'), value: Date.now() });

  await txDone(t);
}

export async function getOfflineProducts(scope: OfflineScope): Promise<OfflineProduct[]> {
  requireScope(scope, 'getOfflineProducts');
  const db = await openDB();
  const store = tx(db, ['products']).objectStore('products');
  const all = await reqToPromise(
    store.index('scope').getAll(IDBKeyRange.only(scopeKey(scope))),
  ) as OfflineProduct[];
  return all.filter(p => p.active);
}

export async function decrementLocalStock(scope: OfflineScope, productId: string, qty: number): Promise<void> {
  requireScope(scope, 'decrementLocalStock');
  const db = await openDB();
  const t = tx(db, ['products'], 'readwrite');
  const store = t.objectStore('products');

  // get() y put() dentro de la MISMA transacción: o se aplican los dos, o
  // ninguno (si algo falla, la transacción se aborta entera).
  const p = await reqToPromise(store.get(`${scopeKey(scope)}::${productId}`)) as OfflineProduct | undefined;
  if (p) {
    p.localStock = Math.max(0, p.localStock - qty);
    store.put(p);
  }

  await txDone(t);
}

// Devuelve stock al producto. SOLO se llama ante un conflicto explícito del
// servidor (o cuando el usuario descarta la venta): si la respuesta del servidor
// fue desconocida o incompleta, la venta sigue pendiente y su descuento debe
// seguir descontando.
export async function restoreLocalStock(scope: OfflineScope, items: OfflineSaleItem[]): Promise<void> {
  requireScope(scope, 'restoreLocalStock');
  const db = await openDB();
  const t = tx(db, ['products'], 'readwrite');
  const store = t.objectStore('products');
  const sk = scopeKey(scope);

  // Todos los items se restauran dentro de la misma transacción: o se
  // restauran todos, o ninguno.
  for (const item of items) {
    const p = await reqToPromise(store.get(`${sk}::${item.productId}`)) as OfflineProduct | undefined;
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
// dos ventas casi simultáneas nunca puedan leer el mismo valor. El contador es
// por cuenta: los LOCAL-xxxx de dos usuarios distintos no colisionan.
async function getNextLocalIdInTx(t: IDBTransaction, account: string): Promise<string> {
  const metaStore = t.objectStore('app_meta');
  const id = `${account}::localCounter`;
  const current = await reqToPromise(metaStore.get(id)) as { key: string; value: number } | undefined;
  const val = (current?.value || 0) + 1;
  metaStore.put({ key: id, value: val });
  return `LOCAL-${String(val).padStart(4, '0')}`;
}

export type OfflineSaleInput = Omit<OfflineSale, 'key' | 'account' | 'localId' | 'status' | 'timestamp'> & {
  localId?: string;
  timestamp?: number;
};

export async function saveSaleOffline(account: OfflineAccount, sale: OfflineSaleInput): Promise<OfflineSale> {
  requireAccount(account, 'saveSaleOffline');
  const db = await openDB();
  // Una sola transacción que cubre: generar el ID local, guardar la venta y
  // descontar el stock local de cada producto. O se guarda todo, o no se
  // guarda nada — ya no puede quedar "a medias".
  const t = tx(db, ['app_meta', 'sales_queue', 'products'], 'readwrite');
  const acc = accountKey(account);

  const localId = await getNextLocalIdInTx(t, acc);
  const fullSale: OfflineSale = {
    ...sale,
    key: `${acc}::${localId}`,
    account: acc,
    localId,
    // Idempotencia: una venta tiene UN solo UUID para siempre. Los reintentos
    // de sincronización reenvían este mismo valor.
    clientSaleId: sale.clientSaleId || newClientSaleId(),
    // La ubicación queda fijada en el momento de capturarla y no se toca más.
    locationId: String(sale.locationId || ''),
    status: 'pending',
    timestamp: sale.timestamp || Date.now(),
  };

  t.objectStore('sales_queue').put(fullSale);

  // El stock se descuenta en el scope de LA UBICACIÓN de la venta (la misma que
  // usa el POS para mostrar disponibles).
  const sk = `${acc}::${seg(fullSale.locationId)}`;
  const productsStore = t.objectStore('products');
  for (const item of sale.items) {
    const p = await reqToPromise(productsStore.get(`${sk}::${item.productId}`)) as OfflineProduct | undefined;
    if (p) {
      p.localStock = Math.max(0, p.localStock - item.qty);
      productsStore.put(p);
    }
  }

  await txDone(t);
  return fullSale;
}

async function listSales(account: OfflineAccount, status?: SyncStatus): Promise<OfflineSale[]> {
  requireAccount(account, 'listSales');
  const db = await openDB();
  const store = tx(db, ['sales_queue']).objectStore('sales_queue');
  const acc = accountKey(account);
  const all = status
    ? await reqToPromise(store.index('by_status').getAll(IDBKeyRange.only([acc, status]))) as OfflineSale[]
    : await reqToPromise(store.index('account').getAll(IDBKeyRange.only(acc))) as OfflineSale[];
  return all;
}

export async function getPendingSales(account: OfflineAccount): Promise<OfflineSale[]> {
  const all = await listSales(account, 'pending');
  return all.sort((a, b) => a.timestamp - b.timestamp);
}

export async function getAllOfflineSales(account: OfflineAccount): Promise<OfflineSale[]> {
  const all = await listSales(account);
  return all.sort((a, b) => b.timestamp - a.timestamp);
}

export async function updateSaleStatus(
  account: OfflineAccount,
  localId: string,
  status: SyncStatus,
  serverId?: string,
  conflictReason?: string,
): Promise<void> {
  requireAccount(account, 'updateSaleStatus');
  const db = await openDB();
  const t = tx(db, ['sales_queue'], 'readwrite');
  const store = t.objectStore('sales_queue');
  const key = `${accountKey(account)}::${localId}`;

  const sale = await reqToPromise(store.get(key)) as OfflineSale | undefined;
  if (sale) {
    sale.status = status;
    if (serverId) sale.serverId = serverId;
    if (conflictReason) sale.conflictReason = conflictReason;
    if (status === 'synced') sale.syncedAt = Date.now();
    if (status === 'syncing') {
      sale.lastAttemptAt = Date.now();
      sale.attempts = (sale.attempts || 0) + 1;
    }
    store.put(sale);
  }

  await txDone(t);
}

// Rellena la locationId SOLO si la venta aún no tenía una (quedó capturada sin
// ubicación conocida, p. ej. la primera venta entrando sin conexión). Una vez
// fijada, la ubicación es inmutable: este helper nunca la reescribe.
export async function setSaleLocationOnce(account: OfflineAccount, localId: string, locationId: string): Promise<void> {
  if (!locationId) return;
  requireAccount(account, 'setSaleLocationOnce');
  const db = await openDB();
  const t = tx(db, ['sales_queue'], 'readwrite');
  const store = t.objectStore('sales_queue');
  const key = `${accountKey(account)}::${localId}`;
  const sale = await reqToPromise(store.get(key)) as OfflineSale | undefined;
  if (sale && !sale.locationId) {
    sale.locationId = locationId;
    store.put(sale);
  }
  await txDone(t);
}

export async function getPendingCount(account: OfflineAccount): Promise<number> {
  return (await getPendingSales(account)).length;
}

// Si la app se cerró de golpe (o se recargó) justo en medio de una
// sincronización, alguna venta puede quedar marcada como 'syncing' sin que
// nadie la termine de procesar. Como getPendingSales() solo devuelve las
// que están en 'pending', esas ventas se volverían invisibles para siempre
// y nunca se reintentarían. Esta función se llama una vez al abrir la app
// y las devuelve a 'pending' para que vuelvan a intentarse.
export async function resetStuckSyncingSales(account: OfflineAccount): Promise<number> {
  const db = await openDB();
  const t = tx(db, ['sales_queue'], 'readwrite');
  const store = t.objectStore('sales_queue');
  const all = await reqToPromise(
    store.index('by_status').getAll(IDBKeyRange.only([accountKey(account), 'syncing'])),
  ) as OfflineSale[];

  for (const sale of all) {
    sale.status = 'pending';
    store.put(sale);
  }

  await txDone(t);
  return all.length;
}

// ── Sync log ──────────────────────────────────────────────────────────────────
export async function saveSyncLog(account: OfflineAccount, log: Omit<SyncLog, 'id' | 'account'>): Promise<void> {
  requireAccount(account, 'saveSyncLog');
  const db = await openDB();
  const fullLog: SyncLog = { ...log, id: `${accountKey(account)}::sync-${Date.now()}`, account: accountKey(account) };
  const t = tx(db, ['sync_log'], 'readwrite');
  t.objectStore('sync_log').put(fullLog);
  await txDone(t);
}
