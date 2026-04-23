import { getDatabase } from './server/src/database/factory';
import { logger } from './server/src/utils/logger';

async function verify() {
  const db = getDatabase();
  console.log('🔍 Testing Database Connection...');
  
  try {
    await db.connect();
    console.log('✅ Connection to Firebase established successfully.');
    
    // Attempt a lightweight operation (listing a test collection)
    try {
      const testResult = await db.list('health_check', []);
      console.log('📊 Operation "list" executed successfully. Result count:', testResult.length);
      console.log('🎉 Database is HEALTHY!');
    } catch(err: any) {
      if (err?.code === 'PGRST205' || err?.code === 'PGRST116') {
        console.log('📊 Connection is HEALTHY! (health_check table missing, which is fine)');
      } else {
        throw err;
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database Health Check FAILED:');
    console.error(error);
    process.exit(1);
  }
}

verify();
