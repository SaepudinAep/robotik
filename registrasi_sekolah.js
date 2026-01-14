// registrasi_sekolah.js v1.2.0 Untuk registrasi siswa sekolah
import { supabase } from './config.js';

// DOM Elements
const schoolSelect = document.getElementById('school_id');
const classSelect = document.getElementById('class_id');
const studentTable = document.getElementById('student-input-table').querySelector('tbody');
const addRowBtn = document.getElementById('add-row');
const importBtn = document.getElementById('import-btn');
const saveBtn = document.getElementById('save-students');
const alertBox = document.getElementById('alert-feedback');
const listEl = document.getElementById('student-list').querySelector('tbody');

// Load sekolah
async function loadSchools() {
  const { data, error } = await supabase.from('schools').select('id, name').order('name');
  if (error) {
    console.error('Gagal load sekolah:', error.message);
    schoolSelect.innerHTML = '<option value="">Belum bisa memuat sekolah</option>';
    return;
  }
  schoolSelect.innerHTML = data?.length
    ? ['<option value="">-- Pilih Sekolah --</option>', ...data.map(s => `<option value="${s.id}">${s.name}</option>`)].join('')
    : '<option value="">Belum ada sekolah</option>';
  classSelect.innerHTML = '<option value="">-- Pilih Kelas --</option>';
}

// Load kelas (ambil semua, filter di JS)
async function loadClasses(schoolId) {
  const { data, error } = await supabase.from('classes').select('id, name, school_id').order('name');
  if (error) {
    console.error('Gagal load kelas:', error.message);
    classSelect.innerHTML = '<option value="">Belum bisa memuat kelas</option>';
    return;
  }
  const filtered = data.filter(c => c.school_id === schoolId);
  classSelect.innerHTML = filtered.length
    ? ['<option value="">-- Pilih Kelas --</option>', ...filtered.map(c => `<option value="${c.id}">${c.name}</option>`)].join('')
    : '<option value="">Belum ada kelas</option>';
}

// Tambah baris input siswa
addRowBtn.addEventListener('click', (e) => {
  e.preventDefault();
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input type="text" name="student_name" required></td>
    <td><input type="text" name="student_class" required></td>
  `;
  studentTable.appendChild(row);
});

// Simpan data siswa (insert/update)
saveBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const schoolId = schoolSelect.value;
  const classId = classSelect.value;
  if (!schoolId || !classId) {
    alertBox.textContent = '❌ Pilih sekolah dan kelas terlebih dahulu';
    return;
  }

  const rows = studentTable.querySelectorAll('tr');
  const students = [];
  for (const r of rows) {
    const name = r.querySelector('input[name="student_name"]').value.trim();
    if (!name) continue;

    if (r.dataset.editId) {
      // Update siswa
      const { error } = await supabase.from('students')
        .update({ name })
        .eq('id', r.dataset.editId);
      if (error) {
        alertBox.textContent = '❌ Gagal update: ' + error.message;
        return;
      }
      r.dataset.editId = '';
    } else {
      // Insert siswa baru
      students.push({ name, class_id: classId, school_id: schoolId, user_id: null });
    }
  }

  if (students.length) {
    const { error } = await supabase.from('students').insert(students);
    if (error) {
      alertBox.textContent = '❌ Gagal menyimpan: ' + error.message;
      return;
    }
  }

  alertBox.textContent = '✅ Data siswa berhasil disimpan'; loadStudentsTable(classId); // Reset form input ke satu baris kosong 
    studentTable.innerHTML = ` <tr> 
        <td><input type="text" name="student_name" required></td> 
       <td><input type="text" name="student_class" required></td> </tr> 
   `;

 });

// Tampilkan daftar siswa
async function loadStudentsTable(classId) {
  const { data, error } = await supabase
    .from('students')
    .select(`
      id,
      name,
      class_id,
      classes (name),
      schools (name)
    `)
    .order('name');

  if (error) {
    console.error('Gagal load siswa:', error.message);
    listEl.innerHTML = '<tr><td colspan="3">Gagal memuat siswa</td></tr>';
    return;
  }

  const filtered = data.filter(s => s.class_id === classId);

  listEl.innerHTML = filtered.length
    ? filtered.map(s => `
      <tr>
        <td>${s.name}</td>
        <td>${s.classes?.name || '-'}</td>
        <td>
          <button onclick="editStudent('${s.id}')">Edit</button>
          <button onclick="deleteStudent('${s.id}')">Hapus</button>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="3">Belum ada siswa</td></tr>';
}

// Edit siswa
window.editStudent = async (id) => {
  const { data, error } = await supabase.from('students').select(`
    id,
    name,
    class_id,
    classes (name)
  `).eq('id', id).single();

  if (error) {
    alertBox.textContent = '❌ Gagal mengambil data siswa: ' + error.message;
    return;
  }

  // Cari baris input pertama (atau buat baru kalau kosong)
  let row = studentTable.querySelector('tr');
  if (!row) {
    row = document.createElement('tr');
    row.innerHTML = `
      <td><input type="text" name="student_name" required></td>
      <td><input type="text" name="student_class" required></td>
    `;
    studentTable.appendChild(row);
  }

  // Isi input dengan data siswa
  row.querySelector('input[name="student_name"]').value = data.name;
  row.querySelector('input[name="student_class"]').value = data.classes?.name || '';

  // Simpan id di dataset untuk update
  row.dataset.editId = id;
};

// Hapus siswa
window.deleteStudent = async (id) => {
  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) {
    alertBox.textContent = '❌ Gagal menghapus: ' + error.message;
    return;
  }
  alertBox.textContent = '✅ Siswa berhasil dihapus';
  const classId = classSelect.value;
  if (classId) loadStudentsTable(classId);
};

// Import XLS/CSV
importBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls,.csv';
  input.onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Tambahkan ke tabel input
      rows.slice(1).forEach(r => {
        if (r[0]) {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td><input type="text" name="student_name" value="${r[0]}" required></td>
            <td><input type="text" name="student_class" value="${r[1] || ''}" required></td>
          `;
          studentTable.appendChild(row);
        }
      });
      alertBox.textContent = '✅ Data dari file berhasil diimpor';
    };
    reader.readAsArrayBuffer(file);
  };
  input.click();
});

// Event saat sekolah dipilih
schoolSelect.addEventListener('change', async (e) => {
  const schoolId = e.target.value;
  if (!schoolId) {
    classSelect.innerHTML = '<option value="">-- Pilih Kelas --</option>';
    return;
  }
  await loadClasses(schoolId);
});

// Event saat kelas dipilih
classSelect.addEventListener('change', async (e) => {
  const classId = e.target.value;
  if (!classId) {
    listEl.innerHTML = '<tr><td colspan="3">Belum ada siswa</td></tr>';
    return;
  }
  await loadStudentsTable(classId);
});

// Inisialisasi halaman
document.addEventListener('DOMContentLoaded', async () => {
  await loadSchools();
});