// Local Storage Mock Adapter
const LOCAL_DB_KEY = 'app_local_db';

const getLocalDb = () => {
  const db = localStorage.getItem(LOCAL_DB_KEY);
  return db ? JSON.parse(db) : {};
};

const saveLocalDb = (db: any) => {
  localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
  // Trigger listeners if needed
  Object.values(listeners).forEach((l: any) => l());
};

const listeners: { [key: string]: () => void } = {};

export const auth = { currentUser: { uid: 'local-user', email: 'local@device.com' } };
export const db = {};

export const collection = (db: any, path: string) => path;
export const doc = (db: any, path: string, id: string) => ({ id, path: `${path}/${id}`, ref: { id, path: `${path}/${id}` } });
export const query = (...args: any[]) => args;
export const where = (field: string, op: string, value: any) => ({ field, op, value });
export const orderBy = (field: string, dir: string) => ({ field, dir });
export const limit = (n: number) => n;

export const addDoc = (path: string, data: any) => {
  const db = getLocalDb();
  if (!db[path]) db[path] = [];
  const id = Date.now().toString();
  db[path].push({ id, ...data });
  saveLocalDb(db);
  return { id };
};

export const setDoc = (ref: any, data: any) => {
  const db = getLocalDb();
  if (!db[ref.path.split('/')[0]]) db[ref.path.split('/')[0]] = [];
  const collection = db[ref.path.split('/')[0]];
  const index = collection.findIndex((d: any) => d.id === ref.id);
  if (index > -1) collection[index] = { ...collection[index], ...data };
  else collection.push({ id: ref.id, ...data });
  saveLocalDb(db);
};

export const updateDoc = (ref: any, data: any) => {
  const db = getLocalDb();
  const collection = db[ref.path.split('/')[0]];
  if (collection) {
    const item = collection.find((d: any) => d.id === ref.id);
    if (item) {
      Object.assign(item, data);
      saveLocalDb(db);
    }
  }
};

export const deleteDoc = (ref: any) => {
  const db = getLocalDb();
  const path = ref.path.split('/')[0];
  if (db[path]) {
    db[path] = db[path].filter((d: any) => d.id !== ref.id);
    saveLocalDb(db);
  }
};

export const getDoc = (ref: any) => {
  const db = getLocalDb();
  const collection = db[ref.path.split('/')[0]];
  const data = collection ? collection.find((d: any) => d.id === ref.id) : null;
  return { 
    data: () => data, 
    id: ref.id, 
    exists: () => !!data 
  };
};

export const getDocs = (q: any) => {
  const db = getLocalDb();
  const path = q[0];
  const items = db[path] || [];
  return { docs: items.map((data: any) => ({ id: data.id, data: () => data })) };
};

export const onSnapshot = (q: any, callback: (snapshot: any) => void) => {
  const path = Array.isArray(q) ? q[0] : q;

  const run = () => {
    const db = getLocalDb();
    const items = db[path] || [];
    callback({ docs: items.map((data: any) => ({ id: data.id, data: () => data })) });
  };
  
  run();
  const id = path + Date.now();
  listeners[id] = run;
  return () => delete listeners[id];
};

export const serverTimestamp = () => new Date();
export const Timestamp = { now: () => new Date(), fromDate: (d: Date) => d };
export const writeBatch = (db: any) => ({
  delete: (ref: any) => deleteDoc(ref),
  commit: () => Promise.resolve()
});

export const getDocFromServer = getDoc;
export const signInWithPopup = () => Promise.resolve();
export const signOut = () => Promise.resolve();
export const onAuthStateChanged = (auth: any, callback: (user: any) => void) => {
  callback({ uid: 'local-user', email: 'local@device.com' });
  return () => {};
};

export const googleProvider = {};

export const testConnection = () => console.log("Connection test bypassed");

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export const handleFirestoreError = (error: any, op: any, path: any) => console.error(error);
export type User = any;
