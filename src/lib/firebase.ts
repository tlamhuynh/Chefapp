import { LocalDb, localAuth, mockUser } from './localDb';

// Mocking Firebase SDK with Local Storage
export const auth = localAuth;
export const db = {} as any; // Not used directly anymore
export const googleProvider = {} as any;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`Local DB Error [${operationType}] at ${path}:`, error);
}

export async function testConnection() {
  console.log("Local DB is ready");
}

// Firestore API Mocks
export const collection = (db: any, path: string) => path;
export const doc = (db: any, path: string, id?: string) => ({ path, id });
export const query = (col: string, ...constraints: any[]) => ({ col, constraints });
export const where = (field: string, op: string, value: any) => ({ type: 'where', field, op, value });
export const orderBy = (field: string, dir: string = 'asc') => ({ type: 'orderBy', field, dir });

export const addDoc = async (colPath: string, data: any) => {
  const id = await LocalDb.addDoc(colPath, data);
  return { id };
};

export const setDoc = async (docRef: any, data: any) => {
  await LocalDb.setDoc(docRef.path, docRef.id, data);
};

export const updateDoc = async (docRef: any, data: any) => {
  await LocalDb.updateDoc(docRef.path, docRef.id, data);
};

export const deleteDoc = async (docRef: any) => {
  await LocalDb.deleteDoc(docRef.path, docRef.id);
};

export const getDoc = async (docRef: any) => {
  const data = await LocalDb.getDoc(docRef.path, docRef.id);
  return {
    exists: () => !!data,
    data: () => data,
    id: docRef.id
  };
};

export const getDocs = async (queryRef: any) => {
  let data = await LocalDb.getCollection(typeof queryRef === 'string' ? queryRef : queryRef.col);
  
  // Apply basic filtering if it's a query
  if (typeof queryRef !== 'string' && queryRef.constraints) {
    queryRef.constraints.forEach((c: any) => {
      if (c.type === 'where') {
        data = data.filter(item => {
          if (c.op === '==') return item[c.field] === c.value;
          return true;
        });
      }
    });
  }

  const colPath = typeof queryRef === 'string' ? queryRef : queryRef.col;
  return {
    docs: data.map(d => ({
      id: d.id,
      data: () => d,
      ref: { path: colPath, id: d.id }
    })),
    empty: data.length === 0
  };
};

export const onSnapshot = (queryRef: any, callback: any, errorCallback?: any) => {
  const colPath = typeof queryRef === 'string' ? queryRef : queryRef.col;
  
  return LocalDb.subscribe(colPath, (data) => {
    let filteredData = [...data];
    
    // Apply basic filtering if it's a query
    if (typeof queryRef !== 'string' && queryRef.constraints) {
      queryRef.constraints.forEach((c: any) => {
        if (c.type === 'where') {
          filteredData = filteredData.filter(item => {
            if (c.op === '==') return item[c.field] === c.value;
            return true;
          });
        }
        if (c.type === 'orderBy') {
          filteredData.sort((a, b) => {
            if (a[c.field] < b[c.field]) return c.dir === 'asc' ? -1 : 1;
            if (a[c.field] > b[c.field]) return c.dir === 'asc' ? 1 : -1;
            return 0;
          });
        }
      });
    }

    callback({
      docs: filteredData.map(d => ({
        id: d.id,
        data: () => d,
        ref: { path: colPath, id: d.id }
      })),
      empty: filteredData.length === 0
    });
  });
};

export const serverTimestamp = () => {
  const now = new Date();
  return {
    toDate: () => now,
    toMillis: () => now.getTime(),
    seconds: Math.floor(now.getTime() / 1000),
    nanoseconds: 0
  };
};

export const Timestamp = {
  now: serverTimestamp,
  fromDate: (date: Date) => ({
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0
  })
};

export const getDocFromServer = getDoc;
export const signInWithPopup = async (auth: any, provider: any) => ({ user: mockUser });
export const signOut = async (auth: any) => localAuth.signOut();
export const onAuthStateChanged = (auth: any, callback: any) => localAuth.onAuthStateChanged(callback);

export type User = typeof mockUser;
