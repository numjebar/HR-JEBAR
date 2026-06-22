const DB_NAME = 'lucid_pos_local';
const DB_VERSION = 1;

const STORES = {
  products: 'products',
  orders: 'orders',
  payments: 'payments',
  customers: 'customers',
  syncQueue: 'sync_queue',
  deviceSession: 'device_session',
};

function assertIndexedDb() {
  if (!window.indexedDB) {
    throw new Error('IndexedDB is not available in this browser');
  }
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

function createStore(db, name, options) {
  if (!db.objectStoreNames.contains(name)) {
    return db.createObjectStore(name, options);
  }
  return null;
}

function createIndex(store, name, keyPath, options = {}) {
  if (store && !store.indexNames.contains(name)) {
    store.createIndex(name, keyPath, options);
  }
}

function uuid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeMoney(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeQty(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function put(store, value) {
  return requestToPromise(store.put(value));
}

function getAllFromIndex(store, indexName, query) {
  return requestToPromise(store.index(indexName).getAll(query));
}

export function openPosLocalDb() {
  assertIndexedDb();
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      const products = createStore(db, STORES.products, { keyPath: 'id' });
      createIndex(products, 'byTenant', 'tenantId');
      createIndex(products, 'byTenantActive', ['tenantId', 'active']);
      createIndex(products, 'byTenantUpdatedAt', ['tenantId', 'updatedAt']);

      const orders = createStore(db, STORES.orders, { keyPath: 'localOrderId' });
      createIndex(orders, 'byTenant', 'tenantId');
      createIndex(orders, 'byTenantStatus', ['tenantId', 'status']);
      createIndex(orders, 'byTenantCreatedAt', ['tenantId', 'localCreatedAt']);

      const payments = createStore(db, STORES.payments, { keyPath: 'localPaymentId' });
      createIndex(payments, 'byTenant', 'tenantId');
      createIndex(payments, 'byOrder', 'localOrderId');

      const customers = createStore(db, STORES.customers, { keyPath: 'localCustomerId' });
      createIndex(customers, 'byTenant', 'tenantId');
      createIndex(customers, 'byTenantPhone', ['tenantId', 'phone']);

      const syncQueue = createStore(db, STORES.syncQueue, { keyPath: 'localEventId' });
      createIndex(syncQueue, 'byTenantStatus', ['tenantId', 'status']);
      createIndex(syncQueue, 'byTenantCreatedAt', ['tenantId', 'createdAt']);
      createIndex(syncQueue, 'byTenantDeviceStatus', ['tenantId', 'deviceId', 'status']);

      const deviceSession = createStore(db, STORES.deviceSession, { keyPath: 'tenantId' });
      createIndex(deviceSession, 'byDeviceId', 'deviceId');
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open POS local database'));
  });
}

export async function saveDeviceSession(session) {
  const db = await openPosLocalDb();
  const tx = db.transaction(STORES.deviceSession, 'readwrite');
  await put(tx.objectStore(STORES.deviceSession), {
    ...session,
    updatedAt: nowIso(),
  });
  await txDone(tx);
}

export async function getDeviceSession(tenantId) {
  const db = await openPosLocalDb();
  const tx = db.transaction(STORES.deviceSession, 'readonly');
  return requestToPromise(tx.objectStore(STORES.deviceSession).get(tenantId));
}

export async function saveProductsLocal(tenantId, products = []) {
  const db = await openPosLocalDb();
  const tx = db.transaction(STORES.products, 'readwrite');
  const store = tx.objectStore(STORES.products);
  const updatedAt = nowIso();

  products.forEach((product) => {
    store.put({
      ...product,
      id: product.id || product.localProductId || uuid(),
      tenantId,
      active: product.active !== false,
      updatedAt,
    });
  });

  await txDone(tx);
  return products.length;
}

export async function getProductsLocal(tenantId, activeOnly = true) {
  const db = await openPosLocalDb();
  const tx = db.transaction(STORES.products, 'readonly');
  const store = tx.objectStore(STORES.products);
  if (activeOnly) {
    return getAllFromIndex(store, 'byTenantActive', IDBKeyRange.only([tenantId, true]));
  }
  return getAllFromIndex(store, 'byTenant', IDBKeyRange.only(tenantId));
}

export async function createOrderLocal({
  tenantId,
  storeId,
  deviceId,
  customer = null,
  items = [],
  payments = [],
  discount = 0,
  tax = 0,
  status = 'paid',
  metadata = {},
}) {
  if (!tenantId) throw new Error('tenantId is required');
  if (!deviceId) throw new Error('deviceId is required');
  if (!items.length) throw new Error('At least one order item is required');

  const localOrderId = uuid();
  const localEventId = uuid();
  const localCreatedAt = nowIso();
  const normalizedItems = items.map((item) => {
    const qty = normalizeQty(item.qty || 1);
    const unitPrice = normalizeMoney(item.unitPrice ?? item.price);
    const itemDiscount = normalizeMoney(item.discount);
    return {
      productId: item.productId || item.id || null,
      name: item.name || 'Item',
      qty,
      unitPrice,
      discount: itemDiscount,
      total: normalizeMoney(item.total ?? (qty * unitPrice) - itemDiscount),
      metadata: item.metadata || {},
    };
  });
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.total, 0);
  const total = Math.max(0, subtotal - normalizeMoney(discount) + normalizeMoney(tax));
  const localCustomerId = customer ? customer.localCustomerId || uuid() : null;
  const normalizedPayments = (payments.length ? payments : [{ method: 'cash', amount: total }]).map((payment) => ({
    ...payment,
    localPaymentId: payment.localPaymentId || uuid(),
    localOrderId,
    tenantId,
    storeId,
    deviceId,
    amount: normalizeMoney(payment.amount || total),
    method: payment.method || 'cash',
    localCreatedAt,
  }));
  const order = {
    tenantId,
    storeId,
    deviceId,
    localOrderId,
    orderNo: metadata.orderNo || localOrderId.slice(-8).toUpperCase(),
    customerId: null,
    localCustomerId,
    status,
    items: normalizedItems,
    subtotal,
    discount: normalizeMoney(discount),
    tax: normalizeMoney(tax),
    total,
    paidAt: status === 'paid' ? localCreatedAt : null,
    localCreatedAt,
    syncedAt: null,
    metadata,
  };
  const normalizedCustomer = customer ? {
    ...customer,
    tenantId,
    localCustomerId,
    updatedAt: localCreatedAt,
  } : null;
  const syncEvent = {
    tenantId,
    storeId,
    deviceId,
    localEventId,
    entityType: 'order',
    operation: 'upsert',
    status: 'pending',
    retryCount: 0,
    lastError: '',
    payload: {
      order,
      customer: normalizedCustomer,
      payments: normalizedPayments,
    },
    createdAt: localCreatedAt,
    updatedAt: localCreatedAt,
  };

  const db = await openPosLocalDb();
  const tx = db.transaction([STORES.orders, STORES.payments, STORES.customers, STORES.syncQueue], 'readwrite');
  await put(tx.objectStore(STORES.orders), order);
  await Promise.all(normalizedPayments.map((payment) => put(tx.objectStore(STORES.payments), payment)));
  if (normalizedCustomer) await put(tx.objectStore(STORES.customers), normalizedCustomer);
  await put(tx.objectStore(STORES.syncQueue), syncEvent);
  await txDone(tx);

  return { order, payments: normalizedPayments, customer: normalizedCustomer, syncEvent };
}

export async function listPendingSyncEvents(tenantId, limit = 50) {
  const db = await openPosLocalDb();
  const tx = db.transaction(STORES.syncQueue, 'readonly');
  const events = await getAllFromIndex(
    tx.objectStore(STORES.syncQueue),
    'byTenantStatus',
    IDBKeyRange.only([tenantId, 'pending']),
  );
  return events
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .slice(0, limit);
}

export async function listSyncEvents(tenantId, limit = 100) {
  const db = await openPosLocalDb();
  const tx = db.transaction(STORES.syncQueue, 'readonly');
  const events = await getAllFromIndex(
    tx.objectStore(STORES.syncQueue),
    'byTenantCreatedAt',
    IDBKeyRange.bound([tenantId, ''], [tenantId, '\uffff']),
  );
  return events
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

export async function getSyncQueueStats(tenantId) {
  const events = await listSyncEvents(tenantId, 500);
  return events.reduce((acc, event) => {
    const status = event.status || 'unknown';
    acc.total += 1;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, { total: 0, pending: 0, synced: 0, failed: 0, processing: 0, conflict: 0, unknown: 0 });
}

export async function markSyncEventSynced(localEventId, cloudRef = null) {
  const db = await openPosLocalDb();
  const tx = db.transaction(STORES.syncQueue, 'readwrite');
  const store = tx.objectStore(STORES.syncQueue);
  const event = await requestToPromise(store.get(localEventId));
  if (!event) return false;
  await put(store, {
    ...event,
    status: 'synced',
    cloudRef,
    syncedAt: nowIso(),
    updatedAt: nowIso(),
    lastError: '',
  });
  await txDone(tx);
  return true;
}

export async function markSyncEventFailed(localEventId, error) {
  const db = await openPosLocalDb();
  const tx = db.transaction(STORES.syncQueue, 'readwrite');
  const store = tx.objectStore(STORES.syncQueue);
  const event = await requestToPromise(store.get(localEventId));
  if (!event) return false;
  await put(store, {
    ...event,
    status: 'pending',
    retryCount: Number(event.retryCount || 0) + 1,
    lastError: String(error || 'Sync failed'),
    updatedAt: nowIso(),
  });
  await txDone(tx);
  return true;
}

export { STORES as POS_LOCAL_STORES };
