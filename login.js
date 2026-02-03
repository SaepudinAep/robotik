import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { supabaseUrl, supabaseKey } from './config.js';

const supabase = createClient(supabaseUrl, supabaseKey);

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email')?.value.trim();
  const password = document.getElementById('password')?.value;

  if (!email || !password) return alert('Email dan password wajib diisi.');

  // 1. Ambil Kunci Akses (Auth)
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  
  if (authError) return alert('Login gagal: ' + authError.message);

  // 2. Ambil Role Langsung dari Tabel Profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();

  if (profileError) return alert('Data profil di Supabase tidak ditemukan.');

  // 3. Simpan Apa Adanya & Pindah ke Dashboard
  // Apa pun isi role-nya (super_admin, teacher, student), kita simpan saja.
  localStorage.setItem('user_role', profile.role); 
  window.location.href = 'dashboard.html';
});