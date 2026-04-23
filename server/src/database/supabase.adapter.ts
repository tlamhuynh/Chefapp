import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IDatabaseService } from './interface';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export class SupabaseDBAdapter implements IDatabaseService {
  private client: SupabaseClient | null = null;

  private isConfigured = false;

  async connect(): Promise<void> {
    try {
      const supabaseUrl = env.SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        logger.warn('⚠️ Supabase configuration missing (SUPABASE_URL, and SUPABASE_ANON_KEY/SERVICE_KEY). Application will run, but DB requests will fail.');
        return;
      }

      this.client = createClient(supabaseUrl, supabaseKey);
      this.isConfigured = true;
      
      // Perform a health check query
      const { error } = await this.client.from('health_check').select('id').limit(1);
      
      if (error) {
         // Some setups don't have health_check table, just log warning
        logger.warn('Supabase DB connection check returned an error (table might not exist): %o', error);
      }
      
      logger.info('🟢 SupabaseDBAdapter: Connected to Supabase');
    } catch (error) {
      logger.error('🟢 SupabaseDBAdapter connection error: %o', error);
      // We do not throw here to allow the app to boot
    }
  }

  private getClient(): SupabaseClient {
    if (!this.isConfigured || !this.client) {
      throw new Error('Supabase is not configured. Please provide SUPABASE_URL and SUPABASE_ANON_KEY in your environment variables.');
    }
    return this.client;
  }

  async get<T>(collection: string, id: string): Promise<T | null> {
    const { data, error } = await this.getClient()
      .from(collection)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // PGRST116 means zero rows returned
        return null;
      }
      throw error;
    }

    return data as T;
  }

  async list<T>(collection: string, filters?: Array<{field: string, operator: any, value: any}>): Promise<T[]> {
    let query = this.getClient().from(collection).select('*');

    if (filters && filters.length > 0) {
      filters.forEach(filter => {
        // Map common operators to Supabase operators
        switch (filter.operator) {
          case '==':
          case 'eq':
            query = query.eq(filter.field, filter.value);
            break;
          case '!=':
          case 'neq':
            query = query.neq(filter.field, filter.value);
            break;
          case '>':
          case 'gt':
            query = query.gt(filter.field, filter.value);
            break;
          case '>=':
          case 'gte':
            query = query.gte(filter.field, filter.value);
            break;
          case '<':
          case 'lt':
            query = query.lt(filter.field, filter.value);
            break;
          case '<=':
          case 'lte':
            query = query.lte(filter.field, filter.value);
            break;
          case 'in':
            query = query.in(filter.field, filter.value);
            break;
          default:
            logger.warn(`Unsupported filter operator: ${filter.operator}, falling back to eq`);
            query = query.eq(filter.field, filter.value);
        }
      });
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data || []) as T[];
  }

  async create<T>(collection: string, data: T, id?: string): Promise<string> {
    const payload = { ...data };
    if (id) {
      (payload as any).id = id;
    }

    const { data: result, error } = await this.getClient()
      .from(collection)
      .insert([payload])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return result.id;
  }

  async update<T>(collection: string, id: string, data: Partial<T>): Promise<void> {
    const { error } = await this.getClient()
      .from(collection)
      .update(data as any)
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async delete(collection: string, id: string): Promise<void> {
    const { error } = await this.getClient()
      .from(collection)
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
  }
}
