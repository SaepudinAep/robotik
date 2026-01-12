// profil_kelas.js — Versi 1.0
import { supabase } from './config.js';

// Elemen DOM
const form = document.getElementById('class-form');
const listEl = document.getElementById('class-list');
const schoolSelect = document.getElementById('school_id');
const yearSelect = document.getElementById('academic_year');
const semesterSelect = document.getElementById('semester');
const classNameInput = document.getElementById('class_name');

const deleteModal = document.getElementById('delete-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete');
const cancelDeleteBtn = document.getElementById('cancel-delete');
let deleteTargetId = null;

// -------------------------
// 1) Dropdown Sekolah
// -------------------------
async function loadSchools() {
  const { data, error } = await supabase
    .from('schools')
    .select('id, name')
    .order('name');

  if (error) {
    console.error(error);
    schoolSelect.innerHTML = '<option value="">Gagal memuat sekolah</option>';
    return;
  }

  if (!data || data.length === 0) {
    schoolSelect.innerHTML = '<option value="">Belum ada sekolah</option>';
    return;
  }

  schoolSelect.innerHTML = [
    '<option value="">-- Pilih Sekolah --</option>',
    ...data.map(s => `<option value="${s.id}">${s.name}</option>`),
  ].join('');
}

// -------------------------
// 2) Dropdown Tahun Ajaran
// -------------------------
async function loadAcademicYears(schoolId) {
  const { data, error } = await supabase
    .from('academic_years')
    .select('id, year')
    .eq('school_id', schoolId)
    .order('year');

  if (error) {
    console.error(error);
    yearSelect.innerHTML = '<option value="">Gagal memuat tahun ajaran</option>';
    return;
  }

  if (!data || data.length === 0) {
    yearSelect.innerHTML = `
      <option value="">Belum ada tahun ajaran</option>
      <option value="__add__">+ Tambah Tahun Ajaran...</option>
    `;
    return;
  }

  yearSelect.innerHTML = [
    '<option value="">-- Pilih Tahun Ajaran --</option>',
    ...data.map(y => `<option value="${y.id}">${y.year}</option>`),
    '<option value="__add__">+ Tambah Tahun Ajaran...</option>',
  ].join('');
}

// -------------------------
// 3) Dropdown Semester
// -------------------------
async function loadSemesters(yearId) {
  const { data, error } = await supabase
    .from('semesters')
    .select('id, name')
    .eq('year_id', yearId)
    .order('name');

  if (error) {
    console.error(error);
    semesterSelect.innerHTML = '<option value="">Gagal memuat semester</option>';
    return;
  }

  if (!data || data.length === 0) {
    semesterSelect.innerHTML = `
      <option value="">Belum ada semester</option>
      <option value="__add__">+ Tambah Semester...</option>
    `;
    return;
  }

  semesterSelect.innerHTML = [
    '<option value="">-- Pilih Semester --</option>',
    ...data.map(s => `<option value="${s.id}">${s.name}</option>`),
    '<option value="__add__">+ Tambah Semester...</option>',
  ].join('');
}

// -------------------------
// 4) Daftar Kelas
// -------------------------
async function loadClasses() {
  const { data, error } = await supabase
    .from('classes')
    .select(`
      id, name,
      schools (name),
      academic_years (year),
      semesters (name)
    `)
    .order('name');

  if (error) {
    console.error(error);
    listEl.innerHTML = '<tr><td colspan="5">Gagal memuat data kelas</td></tr>';
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = '<tr><td colspan="5">Belum ada kelas</td></tr>';
    return;
  }

  listEl.innerHTML = data.map(c => `
    <tr>
      <td>${c.name}</td>
      <td>${c.schools?.name || '-'}</td>
      <td>${c.academic_years?.year || '-'}</td>
      <td>${c.semesters?.name || '-'}</td>
      <td>
        <button onclick="editClass('${c.id}')">Edit</button>
        <button onclick="deleteClass('${c.id}')">Hapus</button>
      </td>
    </tr>
  `).join('');
}

// -------------------------
// 5) CRUD Kelas
// -------------------------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = classNameInput.value.trim();
  const schoolId = schoolSelect.value;
  const yearId = yearSelect.value;
  const semesterId = semesterSelect.value;

  if (!schoolId || !yearId || !semesterId || !name) {
    alert('Semua field wajib diisi');
    return;
  }

  if (form.dataset.editId) {
    await supabase.from('classes')
      .update({ name, school_id: schoolId, academicyearid: yearId, semester_id: semesterId })
      .eq('id', form.dataset.editId);
    alert('Kelas berhasil diupdate');
    form.dataset.editId = '';
  } else {
    await supabase.from('classes')
      .insert([{ name, school_id: schoolId, academicyearid: yearId, semester_id: semesterId }]);
    alert('Kelas berhasil ditambahkan');
  }

  form.reset();
  classNameInput.disabled = true;
  loadClasses();
});

window.editClass = async (id) => {
  const { data } = await supabase.from('classes').select('*').eq('id', id).single();
  form.class_name.value = data.name;
  form.school_id.value = data.school_id;
  await loadAcademicYears(data.school_id);
  form.academic_year.value = data.academicyearid;
  await loadSemesters(data.academicyearid);
  form.semester.value = data.semester_id;
  form.dataset.editId = id;
  classNameInput.disabled = false;
};

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
  loadClasses();
});

cancelDeleteBtn.addEventListener('click', () => {
  deleteTargetId = null;
  deleteModal.style.display = 'none';
});

// -------------------------
// 6) Interaksi Dropdown
// -------------------------
schoolSelect.addEventListener('change', async (e) => {
  await loadAcademicYears(e.target.value);
  classNameInput.disabled = !e.target.value;
});

yearSelect.addEventListener('change', async (e) => {
  if (e.target.value === '__add__') {
    const newYear = prompt('Masukkan Tahun Ajaran (contoh: 2025/2026)');
    if (!newYear) return;
    const schoolId = schoolSelect.value;
    await supabase.from('academic_years').insert([{ year: newYear, school_id: schoolId }]);
    await loadAcademicYears(schoolId);
  } else {
    await loadSemesters(e.target.value);
  }
});

semesterSelect.addEventListener('change', async (e) => {
  if (e.target.value === '__add__') {
    const newSem = prompt('Masukkan nama semester (contoh: Ganjil/Genap)');
    if (!newSem) return;
    const yearId = yearSelect.value;
    await supabase.from('semesters').insert([{ name: newSem, year_id: yearId }]);
    await loadSemesters(yearId);
  }
});

// -------------------------
// 7) Entry Point
// -------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadSchools();
  loadClasses();
});