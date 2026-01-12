// dashboard.js v1.2
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { supabaseUrl, supabaseKey } from './config.js';

// Inisialisasi Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Ambil elemen dari HTML
const sekolahCountEl = document.querySelector('.stat-card.sekolah p');
const kelasCountEl   = document.querySelector('.stat-card.kelas p');
const siswaCountEl   = document.querySelector('.stat-card.siswa p');
const logoutBtn      = document.querySelector('.logout');
const navCards       = document.querySelectorAll('.nav-card');

// Fungsi ambil jumlah data dari tabel (tanpa filter user)
async function getCount(table) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error(`Gagal mengambil jumlah dari tabel ${table}:`, error);
    return 0;
  }
  return count ?? 0;
}

// Fungsi utama dashboard
async function loadDashboard() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  try {
    const sekolahCount = await getCount('sekolah');
    sekolahCountEl.textContent = sekolahCount;

    const kelasCount = await getCount('kelas');
    kelasCountEl.textContent = kelasCount;

    const siswaCount = await getCount('siswa');
    siswaCountEl.textContent = siswaCount;
  } catch (e) {
    console.error('Gagal memuat data dashboard:', e);
  }
}

// Logout
logoutBtn?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
});

// Navigasi dari kartu dashboard
navCards.forEach((card) => {
  card.addEventListener('click', () => {
    const text = card.textContent.trim();

    const routes = {
      'Sekolah': 'absensi_sekolah.html',
      'Private': 'absensi_private.html',
      'Registrasi Sekolah': 'registrasi_sekolah.html',
      'Registrasi Private': 'registrasi_private.html',
      'Profil Sekolah': 'profil_sekolah.html',
      'Profil Kelas': 'profil_kelas.html'
    };

    if (routes[text]) {
      window.location.href = routes[text];
    } else {
      console.warn('Menu tidak dikenali:', text);
    }
  });
});

// Jalankan saat halaman siap
document.addEventListener('DOMContentLoaded', loadDashboard);