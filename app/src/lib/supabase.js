import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

const cleanUrl = String(url || '').trim();
const isValidSupabaseUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cleanUrl);

if (!isValidSupabaseUrl || !anon) {
  console.error('[supabase] Missing or invalid VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

export const supabaseConfigError = !isValidSupabaseUrl || !anon;
export const supabaseUrl = isValidSupabaseUrl ? cleanUrl : '';
export const supabaseAnon = anon || '';
export const supabase = createClient(
  isValidSupabaseUrl ? cleanUrl : 'https://invalid.supabase.co',
  anon || 'missing-anon-key',
);
