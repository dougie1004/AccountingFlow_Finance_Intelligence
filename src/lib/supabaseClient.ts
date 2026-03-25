import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Create a single supabase client for interaction with your database
export const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * [AccountingFlow] Real-time Database Test Connection
 * - Checks connectivity to 'ledger_backup' table
 * - No Node APIs used (Vite browser-safe)
 */
export async function testConnection() {
    console.log('[Supabase Client] Initializing connection test...');
    
    try {
        const { data, error } = await supabase
            .from('ledger_backup')
            .select('*')
            .limit(1);

        if (error) {
            console.error('[Supabase Client] Connection failed:', error.message);
            return { data: null, error };
        }

        console.log('Supabase test:', { data, error: null });
        return { data, error: null };
    } catch (err) {
        console.error('[Supabase Client] Exception during test:', err);
        return { data: null, error: err };
    }
}
