import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { supabaseUrl, supabaseKey } from './config.js';

const supabase = createClient(supabaseUrl, supabaseKey);

// Elemen HTML
const semesterLabelEl = document.getElementById('semester-label');
const classCardGrid = document.getElementById('class-card-grid');
const logoutBtn = document.querySelector('.logout');

// Ambil semester & tahun ajaran dari localStorage
const activeAcademicYear = localStorage.getItem("activeAcademicYear"); // contoh: "2025/2026"
const activeSemester = localStorage.getItem("activeSemester");         // contoh: "Semester 2"

// Simpan Nama Sekolah dan Kelas
classes.forEach(cls => {
  const card = document.createElement("div");
  card.className = "class-card";
  card.textContent = cls.name;

  // Tambahkan event listener klik
  card.addEventListener("click", () => {
    // Simpan data kelas ke localStorage
    localStorage.setItem("activeClassId", cls.id);
    localStorage.setItem("activeClassName", cls.name);

    // Arahkan ke halaman draft absensi
    window.location.href = "draft_absensi.html";
  });

  container.appendChild(card);
});

// Tampilkan label semester
semesterLabelEl.textContent = `${activeSemester} ${activeAcademicYear}`;

// Fungsi ambil kelas sesuai semester & tahun ajaran
async function loadActiveClasses() {
  try {
    const { data, error } = await supabase
      .from('classes')
      .select(`
        id,
        name,
        semester,
        schools(name),
        academic_years(year)
      `)
      .eq('semester', activeSemester)
      .eq('academic_years.year', activeAcademicYear);

    if (error) {
      console.error('Gagal mengambil data kelas:', error);
      return;
    }

    console.log('Data classes:', data); // debug

    classCardGrid.innerHTML = '';
    data.forEach(cls => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h2>${cls.name}</h2>
        <p>${cls.schools?.name ?? '-'}</p>
      `;
      card.addEventListener('click', () => {
        localStorage.setItem("activeClassId", cls.id);
        window.location.href = 'absensi_detail.html';
      });
      classCardGrid.appendChild(card);
    });
  } catch (e) {
    console.error('Error loadActiveClasses:', e);
  }
}

// Logout
logoutBtn?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
});

// Init
document.addEventListener('DOMContentLoaded', loadActiveClasses);