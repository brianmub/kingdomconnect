import { createClient } from '@supabase/supabase-js';

// These should be replaced with actual project credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'church-programs-auth-token',
        // Prevent Web LockManager null lock warnings and cross-tab deadlocks
        lock: typeof navigator !== 'undefined' ? async (_name, _acquireTimeout, fn) => await fn() : undefined,
    }
});
