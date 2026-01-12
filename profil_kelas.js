import { supabase } from './config.js';

const form = document.getElementById('class-form');
const listEl = document.getElementById('class-list');
const schoolSelect = document.getElementById('school_id');
const yearSelect = document.getElementById('academic_year');
const semesterSelect = document.getElementById('semester');
const classInput = document.getElementById('class_name');
const levelSelect = document.getElementById('level');
const scheduleInput = document.getElementById('schedule');

const deleteModal = document.getElementById('delete-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete');
const cancelDeleteBtn = document.getElementById('cancel-delete');
let deleteTargetId = null;

async function loadSchools() {
  const { data } = await supabase.from('schools').select('id, name').order('name');
  schoolSelect.innerHTML = data?.length
    ? ['<option value="">-- Pilih Sekolah --</option>', ...data.map(s => `<option value="${s.id}">${s.name}</option>`)].join('')
    : '<option value="">Belum ada sekolah</option>';
}

async function loadAcademicYears(schoolId) {
  const { data } = await supabase
    .from('academic_years')
    .select('id, year')
    .eq('school_id', schoolId)
    .order('year');

  yearSelect.innerHTML = data?.length
    ? ['<option value="">-- Pilih Tahun Ajaran --</option>', ...data.map(y => `<option value="${y.id}">${y.year}</option>`)].join('')
    : '<option value="">Belum ada tahun ajaran</option>';
}

function loadSemesterDropdown() {
  semesterSelect.innerHTML = `
    <option value="">-- Pilih Semester --</option>
    <option value="Semester 1">Semester 1</option>
    <option value="Semester 2">Semester 2</option>
  `;
}

function loadLevels() {
  levelSelect.innerHTML = `
    <option value="">-- Pilih Level --</option>
    <option value="Kiddy">Kiddy</option>
    <option value="Beginner">Beginner</option>
  `;
}

async function loadClassesTable() {
  const { data } = await supabase
    .from('classes')
    .select('id, name, level, jadwal, semester, academic_years (year), schools (name)')
    .order('name');

  listEl.innerHTML = data?.length
    ? data.map(c => `
      <tr>
        <td>${c.name}</td>
        <td>${c.schools?.name || '-'}</td>
        <td>${c.academic_years?.year || '-'}</td>
        <td>${c.semester || '-'}</td>
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

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = classInput.value.trim();
  const schoolId = schoolSelect.value;
  const yearId = yearSelect.value;
  const semester = semesterSelect.value;
  const level = levelSelect.value;
  const jadwal = scheduleInput.value.trim();

  if (!schoolId || !yearId || !semester || !name || !level || !jadwal) {
    alert('Semua field wajib diisi');
    return;
  }

  if (form.dataset.editId) {
    await supabase.from('classes')
      .update({ name, school_id: schoolId, academic_year_id: yearId, semester, level, jadwal })
      .eq('id', form.dataset.editId);
    alert('Kelas berhasil diupdate');
    form.dataset.editId = '';
  } else {
    await supabase.from('classes')
      .insert([{ name, school_id: schoolId, academic_year_id: yearId, semester, level, jadwal }]);
    alert('Kelas berhasil ditambahkan');
  }

  form.reset();
  loadClassesTable();
});

window.editClass = async (id) => {
  const { data } = await supabase.from('classes').select('*').eq('id', id).single();
  form.school_id.value = data.school_id;
  await loadAcademicYears(data.school_id);
  form.academic_year.value = data.academic_year_id;
  semesterSelect.value = data.semester;
  classInput.value = data.name;
  form.level.value = data.level;
  form.schedule.value = data.jadwal;
  form.dataset.editId = id;
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
  loadClassesTable();
});

cancelDeleteBtn.addEventListener('click', () => {
  deleteTargetId = null;
  deleteModal.style.display = 'none';
});

schoolSelect.addEventListener('change', async (e) => {
  const schoolId = e.target.value;
  if (!schoolId) return;
  await loadAcademicYears(schoolId);
});

loadSchools();
loadLevels();
loadSemesterDropdown();
loadClassesTable();