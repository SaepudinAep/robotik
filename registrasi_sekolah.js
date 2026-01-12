// registrasi_siswa.js v2.1
import { supabase } from './config.js';

// DOM Elements
const schoolSelect = document.getElementById('school_id');
const classSelect = document.getElementById('class_id');
const inputTableBody = document.querySelector('#student-input-table tbody');
const addRowBtn = document.getElementById('add-row');
const saveBtn = document.getElementById('save-students');
const importBtn = document.getElementById('import-btn');
const feedback = document.getElementById('alert-feedback');
const studentListBody = document.querySelector('#student-list tbody');

// 1. Load semua sekolah dan kelas
async function loadFilters() {
  const [schoolsRes, classesRes] = await Promise.all([
    supabase.from('schools').select('id, name'),
    supabase.from('classes').select('id, name')
  ]);

  if (schoolsRes.data) {
    schoolsRes.data.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      schoolSelect.appendChild(opt);
    });
  }

  if (classesRes.data) {
    classesRes.data.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      classSelect.appendChild(opt);
    });
  }
}

// 2. Tambah baris input siswa
function tambahBarisInput() {
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input type="text" name="student_name" required></td>
    <td><input type="text" name="student_class" required></td>
  `;
  inputTableBody.appendChild(row);
}

// 3. Simpan data siswa
async function simpanDataSiswa() {
  const schoolId = schoolSelect.value;
  const classId = classSelect.value;

  if (!schoolId || !classId) {
    feedback.textContent = '❗ Pilih sekolah dan kelas terlebih dahulu.';
    return;
  }

  const rows = inputTableBody.querySelectorAll('tr');
  const data = Array.from(rows).map(row => ({
    name: row.querySelector('input[name="student_name"]').value,
    kelas: row.querySelector('input[name="student_class"]').value,
    school_id: schoolId,
    class_id: classId
  }));

  const { error } = await supabase.from('students').insert(data);
  feedback.textContent = error ? '❌ Gagal menyimpan data.' : '✅ Data berhasil disimpan.';
  if (!error) {
    inputTableBody.innerHTML = '';
    tambahBarisInput();
    loadStudentList();
  }
}

// 4. Tampilkan daftar siswa
async function loadStudentList() {
  const { data } = await supabase.from('students').select('id, name, kelas');
  studentListBody.innerHTML = '';

  data?.forEach(siswa => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td contenteditable="true">${siswa.name}</td>
      <td contenteditable="true">${siswa.kelas}</td>
      <td>
        <button class="btn-edit" data-id="${siswa.id}">Simpan</button>
        <button class="btn-delete" data-id="${siswa.id}">Hapus</button>
      </td>
    `;
    studentListBody.appendChild(row);
  });
}

// 5. Aksi edit dan hapus
studentListBody.addEventListener('click', async (e) => {
  const id = e.target.dataset.id;
  const row = e.target.closest('tr');

  if (e.target.classList.contains('btn-edit')) {
    const name = row.children[0].textContent;
    const kelas = row.children[1].textContent;
    await supabase.from('students').update({ name, kelas }).eq('id', id);
    feedback.textContent = '✅ Data diperbarui.';
  }

  if (e.target.classList.contains('btn-delete')) {
    if (confirm('Yakin ingin menghapus siswa ini?')) {
      await supabase.from('students').delete().eq('id', id);
      row.remove();
      feedback.textContent = '🗑️ Siswa dihapus.';
    }
  }
});

// 6. Import dari file Excel/CSV
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.csv, .xls, .xlsx';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

importBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      const schoolId = schoolSelect.value;
      const classId = classSelect.value;

      if (!schoolId || !classId) {
        feedback.textContent = '❗ Pilih sekolah dan kelas terlebih dahulu.';
        return;
      }

      const students = rows.map(row => ({
        name: row.Nama || row.nama || '',
        kelas: row.Kelas || row.kelas || '',
        school_id: schoolId,
        class_id: classId
      }));

      const { error } = await supabase.from('students').insert(students);
      feedback.textContent = error ? '❌ Gagal import data.' : '✅ Data berhasil diimport.';
      if (!error) loadStudentList();
    } catch (err) {
      console.error(err);
      feedback.textContent = '❌ Format file tidak valid.';
    }
  };

  reader.readAsArrayBuffer(file);
});

// 7. Inisialisasi
document.addEventListener('DOMContentLoaded', async () => {
  await loadFilters();
  await loadStudentList();
  tambahBarisInput();
});

// Event listeners
addRowBtn.addEventListener('click', tambahBarisInput);
saveBtn.addEventListener('click', simpanDataSiswa);