import { supabase } from './config.js';

// DOM Elements
const form = document.getElementById('class-form');
const listEl = document.getElementById('class-list');
const schoolSelect = document.getElementById('school_id');
const yearSelect = document.getElementById('academic_year');
const semesterSelect = document.getElementById('semester');
const classInput = document.getElementById('class_name');
const levelSelect = document.getElementById('level');
const scheduleInput = document.getElementById('schedule');
const addYearBtn = document.getElementById('add-year-btn');

const deleteModal = document.getElementById('delete-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete');
const cancelDeleteBtn = document.getElementById('cancel-delete');
let deleteTargetId = null;

// Load sekolah
async function loadSchools() {
  const { data } = await supabase.from('schools').select('id, name').order('name');
  schoolSelect.innerHTML = data?.length
    ? ['<option value="">-- Pilih Sekolah --</option>', ...data.map(s => `<option value="${s.id}">${s.name}</option>`)].join('')
    : '<option value="">Belum ada sekolah</option>';
}

// Load tahun ajaran (tidak tergantung sekolah)
async function loadAcademicYears() {
  const { data } = await supabase.from('academic_years').select('id, year').order('year');
  yearSelect.innerHTML = data?.length
    ? ['<option value="">-- Pilih Tahun Ajaran --</option>', ...data.map(y => `<option value="${y.id}">${y.year}</option>`)].join('')
    : '<option value="">Belum ada tahun ajaran</option>';
}

// Load semester berdasarkan tahun ajaran
async function loadSemesters(academicYearId) {
  const { data } = await supabase
    .from('semesters')
    .select('id, name')
    .eq('academic_year_id', academicYearId)
    .order('name');

  semesterSelect.innerHTML = data?.length
    ? ['<option value="">-- Pilih Semester --</option>', ...data.map(s => `<option value="${s.id}">${s.name}</option>`)].join('')
    : '<option value="">Belum ada semester</option>';
}

// Tambah tahun ajaran baru
addYearBtn.addEventListener('click', async () => {
  const tahun = prompt('Masukkan tahun ajaran baru (misal: 2026/2027)');
  if (!tahun) return;

  const { error } = await supabase.from('academic_years').insert([{ year: tahun }]);
  if (error) {
    alert('❌ Gagal menambahkan tahun ajaran: ' + error.message);
  } else {
    alert('✅ Tahun ajaran berhasil ditambahkan');
    await loadAcademicYears();
    const { data: updated } = await supabase
      .from('academic_years')
      .select('id')
      .eq('year', tahun)
      .single();
    if (updated) yearSelect.value = updated.id;
  }
});

// Load level statis
function loadLevels() {
  levelSelect.innerHTML = `
    <option value="">-- Pilih Level --</option>
    <option value="Kiddy">Kiddy</option>
    <option value="Beginner">Beginner</option>
  `;
}

// Tampilkan daftar kelas
async function loadClassesTable() {
  const { data } = await supabase
    .from('classes')
    .select(`
      id, name, level, jadwal,
      academic_years (year),
      schools (name),
      semesters (name)
    `)
    .order('name');

  listEl.innerHTML = data?.length
    ? data.map(c => `
      <tr>
        <td>${c.name}</td>
        <td>${c.schools?.name || '-'}</td>
        <td>${c.academic_years?.year || '-'}</td>
        <td>${c.semesters?.name || '-'}</td>
        <td>${c.level || '-'}</td>
        <td>${c.jadwal || '-'}</td>
        <td>
          <button onclick="editClass('${c.id}')">Edit</button>
          <button onclick="deleteClass('${c.id}')">Hapus</button>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="7">Belum ada kelas</td></tr>';
}

// Submit form tambah/edit kelas
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = classInput.value.trim();
  const schoolId = schoolSelect.value;
  const yearId = yearSelect.value;
  const semesterId = semesterSelect.value;
  const level = levelSelect.value;
  const jadwal = scheduleInput.value.trim();

  if (!schoolId || !yearId || !semesterId || !name || !level || !jadwal) {
    alert('Semua field wajib diisi');
    return;
  }

  const payload = {
    name,
    school_id: schoolId,
    academic_year_id: yearId,
    semester_id: semesterId,
    level,
    jadwal
  };

  if (form.dataset.editId) {
    await supabase.from('classes').update(payload).eq('id', form.dataset.editId);
    alert('Kelas berhasil diupdate');
    form.dataset.editId = '';
  } else {
    await supabase.from('classes').insert([payload]);
    alert('Kelas berhasil ditambahkan');
  }

  form.reset();
  semesterSelect.innerHTML = '<option value="">-- Pilih Semester --</option>';
  loadClassesTable();
});

// Edit kelas
window.editClass = async (id) => {
  const { data } = await supabase.from('classes').select('*').eq('id', id).single();
  form.school_id.value = data.school_id;
  await loadAcademicYears();
  form.academic_year.value = data.academic_year_id;
  await loadSemesters(data.academic_year_id);
  form.semester.value = data.semester_id;
  classInput.value = data.name;
  form.level.value = data.level;
  form.schedule.value = data.jadwal;
  form.dataset.editId = id;
};

// Hapus kelas
window.deleteClass = (id) => {
  deleteTargetId = id;
  deleteModal.style.display = 'block';
};

confirmDeleteBtn.addEventListener('click', async () => {
  if (!deleteTargetId) return;
  await supabase.from('classes').delete().eq('id', deleteTargetId);
  alert('Kelas berhasil dihapus');
  deleteTargetId = null;
  deleteModal.style.display = 'none';
  loadClassesTable();
});

cancelDeleteBtn.addEventListener('click', () => {
  deleteTargetId = null;
  deleteModal.style.display = 'none';
});

// Saat tahun ajaran dipilih, load semester
yearSelect.addEventListener('change', async (e) => {
  const yearId = e.target.value;
  if (!yearId) return;
  await loadSemesters(yearId);
});

// Inisialisasi halaman
loadSchools();
loadAcademicYears();
loadLevels();
loadClassesTable();
