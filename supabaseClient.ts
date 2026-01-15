import { createClient } from '@supabase/supabase-js';

// Helper to safely access env vars in various environments
const getEnv = (key: string) => {
    try {
        if (typeof process !== 'undefined' && process.env) {
            return process.env[key];
        }
    } catch (e) {
        // ignore error
    }
    return undefined;
};

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL') || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || 'your-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);