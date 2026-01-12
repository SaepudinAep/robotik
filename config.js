// config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export const supabaseUrl = 'https://aedtrwpomswdqxarvsrg.supabase.co';
export const supabaseKey = 'sb_publishable_QXwMaSw5_11T2BpcWetm2A_hTgZeAsf';

// Named export supabase agar bisa dipakai di file lain
export const supabase = createClient(supabaseUrl, supabaseKey);