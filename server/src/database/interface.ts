export interface IDatabaseService {
  /**
   * Initializes connection to the database
   */
  connect(): Promise<void>;

  /**
   * Reads a single document from a collection
   */
  get<T>(collection: string, id: string): Promise<T | null>;

  /**
   * Lists documents from a collection with optional filters
   */
  list<T>(collection: string, filters?: Array<{field: string, operator: any, value: any}>): Promise<T[]>;

  /**
   * Creates a new document. Returns the created document ID.
   */
  create<T>(collection: string, data: T, id?: string): Promise<string>;

  /**
   * Updates an existing document
   */
  update<T>(collection: string, id: string, data: Partial<T>): Promise<void>;

  /**
   * Deletes a document
   */
  delete(collection: string, id: string): Promise<void>;
}
