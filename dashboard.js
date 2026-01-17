import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { supabaseUrl, supabaseKey } from './config.js';

const supabase = createClient(supabaseUrl, supabaseKey);

// Elemen HTML
const sekolahCountEl = document.querySelector('.stat-card.sekolah p');
const kelasCountEl   = document.querySelector('.stat-card.kelas p');
const siswaCountEl   = document.querySelector('.stat-card.siswa p');
const logoutBtn      = document.querySelector('.logout');
const navCards       = document.querySelectorAll('.nav-card');
const semesterLabelEl = document.getElementById('semester-label');

// Fungsi tentukan semester & tahun ajaran aktif
function getActiveSemesterLabel() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();

  let semesterName, academicYear;

  if (month >= 7 && month <= 12) {
    semesterName = "Semester 1";
    academicYear = `${year}/${year+1}`;
  } else {
    semesterName = "Semester 2";
    academicYear = `${year-1}/${year}`;
  }

  // simpan ke localStorage untuk dipakai di page lain
  localStorage.setItem("activeAcademicYear", academicYear);
  localStorage.setItem("activeSemester", semesterName);

  return `${semesterName} ${academicYear}`;
}

// Fungsi ambil jumlah data dari tabel
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

  // tampilkan label semester
  semesterLabelEl.textContent = getActiveSemesterLabel();

  try {
    const sekolahCount = await getCount('schools');
    sekolahCountEl.textContent = sekolahCount;

    const kelasCount = await getCount('classes');
    kelasCountEl.textContent = kelasCount;

    const siswaCount = await getCount('students');
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
      'Absensi': 'absensi_sekolah.html',
      'Guru & Materi': 'guru_materi.html',
      'Registrasi Siswa': 'registrasi_sekolah.html',
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

document.addEventListener('DOMContentLoaded', loadDashboard);