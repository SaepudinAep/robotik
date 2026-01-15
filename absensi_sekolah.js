// absensi_sekolah.js v3.0 — Menampilkan kelas aktif berdasarkan semester & tahun ajaran
import { supabase } from './config.js';

// Elemen HTML
const semesterLabelEl = document.getElementById('semester-label');
const classCardGrid = document.getElementById('class-card-grid');
const logoutBtn = document.querySelector('.logout');

// Ambil semester & tahun ajaran dari localStorage
const activeAcademicYear = localStorage.getItem("activeAcademicYear");
const activeSemester = localStorage.getItem("activeSemester");

// Tampilkan label semester
semesterLabelEl.textContent = `${activeSemester} ${activeAcademicYear}`;

// Fungsi: Ambil kelas aktif berdasarkan semester & tahun ajaran
async function loadActiveClasses() {
  try {
    const { data, error } = await supabase
      .from('classes')
      .select(`
        id,
        name,
        jadwal,
        school_id,
        semesters (name),
        schools (name),
        academic_years (year)
      `)
      .eq('semesters.name', activeSemester)
      .eq('academic_years.year', activeAcademicYear);

    if (error) {
      console.error('❌ Gagal mengambil data kelas:', error);
      classCardGrid.innerHTML = '<p>Gagal memuat kelas</p>';
      return;
    }

    if (!data || data.length === 0) {
      classCardGrid.innerHTML = '<p>Tidak ada kelas aktif ditemukan</p>';
      return;
    }

    renderClassCards(data);
  } catch (err) {
    console.error('❌ Error loadActiveClasses:', err);
    classCardGrid.innerHTML = '<p>Terjadi kesalahan saat memuat kelas</p>';
  }
}

// Fungsi: Tampilkan kartu kelas
function renderClassCards(classes) {
  classCardGrid.innerHTML = '';
  classes.forEach(cls => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h2>${cls.name}</h2>
      <p>${cls.schools?.name ?? '-'}</p>
      <small>${activeSemester} ${activeAcademicYear}</small>
    `;

    card.addEventListener('click', () => {
      // Simpan hanya ID, data lainnya diambil ulang di halaman berikutnya
      localStorage.setItem("activeClassId", cls.id);
      window.location.href = 'draft_absensi.html';
    });

    classCardGrid.appendChild(card);
  });
}

// Logout
logoutBtn?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  localStorage.clear();
  window.location.href = 'index.html';
});

// Inisialisasi
document.addEventListener('DOMContentLoaded', loadActiveClasses);
