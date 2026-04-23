import { IDatabaseService } from './interface';
import { FirebaseDBAdapter } from './firebase.adapter';
import { SupabaseDBAdapter } from './supabase.adapter';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let dbInstance: IDatabaseService | null = null;

export const getDatabase = (): IDatabaseService => {
  if (dbInstance) return dbInstance;

  logger.info(`📦 Initializing Database with provider: [${env.DB_PROVIDER}]`);

  switch (env.DB_PROVIDER) {
    case 'supabase':
      dbInstance = new SupabaseDBAdapter();
      break;
    case 'firebase':
    default:
      dbInstance = new FirebaseDBAdapter();
      break;
  }

  return dbInstance;
};
