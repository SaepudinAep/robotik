// auth_guard.js v1.0
import { supabase } from './config.js';

(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
  }
})();