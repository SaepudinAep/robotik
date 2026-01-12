// dashboard.js
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

// Fungsi ambil jumlah data dari tabel
async function getCount(table, userId) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    console.error(error);
    return 0;
  }
  return count ?? 0;
}

// Fungsi utama dashboard
async function loadDashboard() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (!user) {
    alert('Silakan login terlebih dahulu');
    window.location.href = 'index.html';
    return;
  }

  try {
    // Hitung jumlah sekolah
    const sekolahCount = await getCount('sekolah', user.id);
    sekolahCountEl.textContent = sekolahCount;

    // Hitung jumlah kelas
    const kelasCount = await getCount('kelas', user.id);
    kelasCountEl.textContent = kelasCount;

    // Hitung jumlah siswa
    const siswaCount = await getCount('siswa', user.id);
    siswaCountEl.textContent = siswaCount;
  } catch (e) {
    console.error(e);
    alert('Gagal memuat data dashboard');
  }
}

// Logout
logoutBtn?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
});

// Direct dari nav-card
navCards.forEach((card) => {
  card.addEventListener('click', () => {
    const text = card.textContent.trim();

    switch (text) {
      case 'Sekolah':
        window.location.href = 'absensi_sekolah.html';
        break;
      case 'Private':
        window.location.href = 'absensi_private.html';
        break;
      case 'Registrasi Sekolah':
        window.location.href = 'registrasi_sekolah.html';
        break;
      case 'Registrasi Private':
        window.location.href = 'registrasi_private.html';
        break;
      case 'Profil Sekolah':
        window.location.href = 'profil_sekolah.html';
        break;
      case 'Profil Kelas':
        window.location.href = 'profil_kelas.html';
        break;
      default:
        console.warn('Menu tidak dikenali:', text);
    }
  });
});

// Jalankan saat halaman siap
document.addEventListener('DOMContentLoaded', loadDashboard);