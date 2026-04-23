import { supabase } from './supabase-client';

export function subscribeToDatabaseChanges(callback: () => void) {
  const channel = supabase.channel('global-changes')
    .on('postgres_changes', { event: '*', schema: 'public' }, () => {
      callback();
    })
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}

function processData(data: any) {
  const processed = { ...data };
  for (const key in processed) {
    if (processed[key] && processed[key].__isServerTimestamp) {
      processed[key] = new Date().toISOString();
    }
  }
  return processed;
}

export const collection = (db: any, path: string) => ({ type: 'collection', path });

export const doc = (db: any, path: string, id?: string) => {
  const parts = path.split('/');
  let collectionName = path;
  let docId = id;

  if (parts.length >= 2 && !id) {
     collectionName = parts[0]; 
     docId = parts[1];
  }
  if (!docId) {
    docId = crypto.randomUUID();
  }
  return { type: 'doc', path: `${collectionName}/${docId}`, collection: collectionName, id: docId };
};

export const addDoc = async (collRef: any, data: any) => {
  const id = crypto.randomUUID();
  const insertData = { ...processData(data), id };
  
  const { data: result, error } = await supabase.from(collRef.path).insert(insertData).select().single();
  if (error) {
    console.error(`Supabase Insert Error in ${collRef.path}:`, error);
    throw error;
  }
  return { id, path: `${collRef.path}/${id}` };
};

export const setDoc = async (docRef: any, data: any) => {
  // Use id as primary key for upsert
  const insertData = { ...processData(data), id: docRef.id };
  const { error } = await supabase.from(docRef.collection).upsert(insertData);
  if (error) {
    console.error(`Supabase Upsert Error in ${docRef.collection}:`, error);
    throw error;
  }
};

export const updateDoc = async (docRef: any, data: any) => {
  const { error } = await supabase.from(docRef.collection).update(processData(data)).eq('id', docRef.id);
  if (error) {
    console.error(`Supabase Update Error in ${docRef.collection}:`, error);
    throw error;
  }
};

export const deleteDoc = async (docRef: any) => {
  const { error } = await supabase.from(docRef.collection).delete().eq('id', docRef.id);
  if (error) {
    console.error(`Supabase Delete Error in ${docRef.collection}:`, error);
    throw error;
  }
};

export const getDoc = async (docRef: any) => {
  const { data, error } = await supabase.from(docRef.collection).select('*').eq('id', docRef.id).maybeSingle();
  if (error || !data) return { id: docRef.id, exists: () => false, data: () => undefined };
  return { id: docRef.id, exists: () => true, data: () => data };
};

export const getDocFromServer = getDoc;

export const query = (collRef: any, ...constraints: any[]) => ({ type: 'query', collection: collRef.path || collRef.collection, constraints });
export const where = (field: string, op: string, value: any) => ({ type: 'where', field, op, value });
export const orderBy = (field: string, direction: 'asc'|'desc' = 'asc') => ({ type: 'orderBy', field, direction });
export const limit = (n: number) => ({ type: 'limit', value: n });

export const getDocs = async (queryRef: any) => {
  const collectionName = queryRef.type === 'collection' ? queryRef.path : queryRef.collection;
  const constraints = queryRef.type === 'query' ? queryRef.constraints || [] : [];
  
  let queryBuilder: any = supabase.from(collectionName).select('*');
  
  for (const c of constraints) {
    if (c.type === 'where') {
      if (c.op === '==') queryBuilder = queryBuilder.eq(c.field, c.value);
      else if (c.op === '!=') queryBuilder = queryBuilder.neq(c.field, c.value);
      else if (c.op === '>') queryBuilder = queryBuilder.gt(c.field, c.value);
      else if (c.op === '<') queryBuilder = queryBuilder.lt(c.field, c.value);
      else if (c.op === '>=') queryBuilder = queryBuilder.gte(c.field, c.value);
      else if (c.op === '<=') queryBuilder = queryBuilder.lte(c.field, c.value);
      else if (c.op === 'in') queryBuilder = queryBuilder.in(c.field, c.value);
      else if (c.op === 'array-contains') queryBuilder = (queryBuilder as any).contains(c.field, [c.value]);
    }
  }
  
  for (const c of constraints) {
    if (c.type === 'orderBy') {
      queryBuilder = queryBuilder.order(c.field, { ascending: c.direction === 'asc' });
    }
  }
  
  const limitC = constraints.find((c: any) => c.type === 'limit');
  if (limitC) {
    queryBuilder = queryBuilder.limit(limitC.value);
  }
  
  const { data, error } = await queryBuilder;
  
  if (error) {
    console.error(`Supabase Query Error in ${collectionName}:`, error);
    return { docs: [], empty: true, size: 0, forEach: () => {} };
  }
  
  const records: any[] = data || [];
  
  return {
    docs: records.map((r: any) => ({
      id: r.id,
      data: () => r,
      exists: () => true,
      ref: { path: `${collectionName}/${r.id}` }
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
  const collectionName = queryRef.type === 'collection' ? queryRef.path : queryRef.collection;
  
  const fetchAndCallback = async () => {
    if (isCancelled) return;
    try {
      const snap = await getDocs(queryRef);
      if (!isCancelled) callback(snap);
    } catch(e) {
      if (!isCancelled && onError) onError(e);
    }
  };

  fetchAndCallback();
  
  const channel = supabase.channel(`public:${collectionName}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: collectionName }, () => {
      fetchAndCallback();
    })
    .subscribe();

  return () => {
    isCancelled = true;
    supabase.removeChannel(channel);
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
      for (const op of operations) {
        if (op.type === 'set') await setDoc(op.docRef, op.data);
        if (op.type === 'update') await updateDoc(op.docRef, op.data);
        if (op.type === 'delete') await deleteDoc(op.docRef);
      }
    }
  };
};
