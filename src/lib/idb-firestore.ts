import { openDB, IDBPDatabase } from 'idb';

const DB_VERSION = 1;
const DB_NAME = 'souschef_idb';

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('documents')) {
        const store = db.createObjectStore('documents', { keyPath: 'id' });
        store.createIndex('collection', 'collection');
      }
    }
  });
}

function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

let listeners: Function[] = [];
let dbChangeListeners: Function[] = [];

function notifyListeners() {
  listeners.forEach(l => l());
  dbChangeListeners.forEach(l => l());
}

export function subscribeToDatabaseChanges(callback: () => void) {
  dbChangeListeners.push(callback);
  return () => {
    dbChangeListeners = dbChangeListeners.filter(l => l !== callback);
  };
}

function processData(data: any) {
  const processed = { ...data };
  for (const key in processed) {
    if (processed[key] && processed[key].__isServerTimestamp) {
      processed[key] = Date.now();
    }
  }
  return processed;
}

export const collection = (db: any, path: string) => ({ type: 'collection', path });
export const doc = (db: any, path: string, id?: string) => ({ type: 'doc', path: id ? `${path}/${id}` : `${path}/${generateId()}` });

export const addDoc = async (collRef: any, data: any) => {
  const db = await getDB();
  const id = generateId();
  const docPath = `${collRef.path}/${id}`;
  const record = { id: docPath, collection: collRef.path, data: { ...processData(data), id } };
  await db.put('documents', record);
  notifyListeners();
  return { id, path: docPath };
};

export const setDoc = async (docRef: any, data: any) => {
  const db = await getDB();
  const [collectionName, id] = docRef.path.split('/');
  const record = { id: docRef.path, collection: collectionName, data: { ...processData(data), id } };
  await db.put('documents', record);
  notifyListeners();
};

export const updateDoc = async (docRef: any, data: any) => {
  const db = await getDB();
  const existing = await db.get('documents', docRef.path);
  if (existing) {
    existing.data = { ...existing.data, ...processData(data) };
    await db.put('documents', existing);
    notifyListeners();
  }
};

export const deleteDoc = async (docRef: any) => {
  const db = await getDB();
  await db.delete('documents', docRef.path);
  notifyListeners();
};

export const getDoc = async (docRef: any) => {
  const db = await getDB();
  const record = await db.get('documents', docRef.path);
  const id = docRef.path.split('/').pop() || '';
  if (!record) return { id, exists: () => false, data: () => undefined };
  return { id, exists: () => true, data: () => record.data };
};

export const getDocFromServer = getDoc;

export const query = (collRef: any, ...constraints: any[]) => ({ type: 'query', collection: collRef.path, constraints });
export const where = (field: string, op: string, value: any) => ({ type: 'where', field, op, value });
export const orderBy = (field: string, direction: 'asc'|'desc' = 'asc') => ({ type: 'orderBy', field, direction });
export const limit = (n: number) => ({ type: 'limit', value: n });

export const getDocs = async (queryRef: any) => {
  const db = await getDB();
  const collectionName = queryRef.type === 'collection' ? queryRef.path : queryRef.collection;
  const constraints = queryRef.type === 'query' ? queryRef.constraints || [] : [];
  
  let records = await db.getAllFromIndex('documents', 'collection', collectionName);
  
  // WHERE
  for (const c of constraints) {
    if (c.type === 'where') {
      records = records.filter(r => {
        const val = r.data[c.field];
        if (c.op === '==') return val === c.value;
        if (c.op === '!=') return val !== c.value;
        if (c.op === 'in') return Array.isArray(c.value) && c.value.includes(val);
        if (c.op === 'array-contains') return Array.isArray(val) && val.includes(c.value);
        if (c.op === '>') return val > c.value;
        if (c.op === '<') return val < c.value;
        if (c.op === '>=') return val >= c.value;
        if (c.op === '<=') return val <= c.value;
        return true;
      });
    }
  }
  
  // ORDER BY
  const orderC = constraints.find(c => c.type === 'orderBy');
  if (orderC) {
    records.sort((a, b) => {
      let valA = a.data[orderC.field] ?? 0;
      let valB = b.data[orderC.field] ?? 0;
      if (valA < valB) return orderC.direction === 'asc' ? -1 : 1;
      if (valA > valB) return orderC.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }
  
  // LIMIT
  const limitC = constraints.find(c => c.type === 'limit');
  if (limitC) {
    records = records.slice(0, limitC.value);
  }
  
  return {
    docs: records.map(r => ({
      id: r.id.split('/').pop(),
      data: () => r.data,
      exists: () => true,
      ref: { path: r.id }
    })),
    empty: records.length === 0,
    size: records.length,
    forEach: function(callback: any) {
      this.docs.forEach(callback);
    }
  };
};

export const onSnapshot = (queryRef: any, callback: Function, onError?: Function) => {
  let isCancelled = false;
  
  const wrapper = async () => {
    if (isCancelled) return;
    try {
      const snap = await getDocs(queryRef);
      if (!isCancelled) callback(snap);
    } catch (e) {
      if (!isCancelled && onError) onError(e);
    }
  };
  
  wrapper(); // initial fetch
  
  listeners.push(wrapper);
  return () => {
    isCancelled = true;
    listeners = listeners.filter(l => l !== wrapper);
  };
};

export const serverTimestamp = () => ({ __isServerTimestamp: true });
export const Timestamp = {
  now: () => ({ toMillis: () => Date.now(), toDate: () => new Date() }),
  fromMillis: (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms) })
};

export const writeBatch = (dbAny: any) => {
  const operations: any[] = [];
  return {
    set(docRef: any, data: any) { operations.push({ type: 'set', docRef, data }); },
    update(docRef: any, data: any) { operations.push({ type: 'update', docRef, data }); },
    delete(docRef: any) { operations.push({ type: 'delete', docRef }); },
    async commit() {
      // Execute sequentially since idb transactions without specific stores are tricky cross-store
      for (const op of operations) {
        if (op.type === 'set') await setDoc(op.docRef, op.data);
        if (op.type === 'update') await updateDoc(op.docRef, op.data);
        if (op.type === 'delete') await deleteDoc(op.docRef);
      }
    }
  };
};
