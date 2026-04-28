
import { config } from 'dotenv';
config();

console.log("--- SYSTEM DIAGNOSTIC LOGS ---");
console.log("DB_PROVIDER:", process.env.DB_PROVIDER);
console.log("SUPABASE_URL (exists?):", !!process.env.SUPABASE_URL);
console.log("SUPABASE_ANON_KEY (exists?):", !!process.env.SUPABASE_ANON_KEY);
console.log("SUPABASE_SERVICE_KEY (exists?):", !!process.env.SUPABASE_SERVICE_KEY);
console.log("VITE_SUPABASE_URL (exists?):", !!process.env.VITE_SUPABASE_URL);
console.log("VITE_SUPABASE_PUBLISHABLE_KEY (exists?):", !!process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
console.log("------------------------------");
