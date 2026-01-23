// registrasi_private.js (Refactor CRUD Lengkap dengan relasi levels)
import { supabase } from './config.js';

// =======================
// 🔧 DOM Elements
// =======================
const groupSelect   = document.querySelector('#class-group');   // dropdown group di form class
const levelSelect   = document.querySelector('#class-level');   // dropdown level di form class
const classSelect   = document.querySelector('#student-class'); // dropdown class di form students

const studentList   = document.querySelector('#student-list tbody');
const classList     = document.querySelector('#class-list tbody');
const groupList     = document.querySelector('#group-list tbody');

// State edit
let editingGroupId   = null;
let editingClassId   = null;
let editingStudentId = null;

// =======================
// 🔄 INIT
// =======================
document.addEventListener('DOMContentLoaded', () => {
  loadGroups();
  loadLevelsDropdown();
  loadClasses();
  loadStudents();
});

// =======================
// 📋 LOAD FUNCTIONS
// =======================

async function loadGroups() {
  const { data, error } = await supabase.from('group_private').select('*').order('code');
  if (error) {
    console.error(error);
    groupList.innerHTML = `<tr><td colspan="4">❌ ${error.message}</td></tr>`;
    return;
  }

  // isi dropdown di form class
  groupSelect.innerHTML = '<option value="">-- Pilih Group --</option>';
  data.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = `${g.code} - ${g.owner}`;
    groupSelect.appendChild(opt);
  });

  // isi tabel group
  groupList.innerHTML = data.length ? data.map(g => `
    <tr>
      <td>${g.code}</td>
      <td>${g.owner}</td>
      <td>${g.address || '-'}</td>
      <td>
        <button onclick="editGroup('${g.id}')">Edit</button>
        <button onclick="deleteGroup('${g.id}')">Hapus</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="4">Belum ada group</td></tr>';
}

async function loadLevelsDropdown() {
  const { data, error } = await supabase.from('levels').select('id, kode').order('kode');
  if (error) { console.error(error); return; }

  levelSelect.innerHTML = '<option value="">-- Pilih Level --</option>';
  data.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.kode;
    levelSelect.appendChild(opt);
  });
}

async function loadClasses() {
  // ambil class + relasi group + relasi level
  const { data, error } = await supabase.from('class_private')
    .select('id, name, level_id, group_id, group_private(code), levels(kode)')
    .order('name');
  if (error) {
    console.error(error);
    classList.innerHTML = `<tr><td colspan="4">❌ ${error.message}</td></tr>`;
    return;
  }

  // isi dropdown di form students
  classSelect.innerHTML = '<option value="">-- Pilih Kelas --</option>';
  data.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.levels?.kode || '-'})`;
    classSelect.appendChild(opt);
  });

  // isi tabel class
  classList.innerHTML = data.length ? data.map(c => `
    <tr>
      <td>${c.name}</td>
      <td>${c.levels?.kode || '-'}</td>
      <td>${c.group_private?.code || '-'}</td>
      <td>
        <button onclick="editClass('${c.id}')">Edit</button>
        <button onclick="deleteClass('${c.id}')">Hapus</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="4">Belum ada class</td></tr>';
}

async function loadStudents() {
  const { data, error } = await supabase.from('students_private')
    .select('id, name, class_id, class_private(name)')
    .order('name');
  if (error) {
    console.error(error);
    studentList.innerHTML = `<tr><td colspan="3">❌ ${error.message}</td></tr>`;
    return;
  }

  studentList.innerHTML = data.length ? data.map(s => `
    <tr>
      <td>${s.name}</td>
      <td>${s.class_private?.name || '-'}</td>
      <td>
        <button onclick="editStudent('${s.id}')">Edit</button>
        <button onclick="deleteStudent('${s.id}')">Hapus</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="3">Belum ada siswa</td></tr>';
}

// =======================
// 🟩 SUBMIT FORMS
// =======================

document.getElementById('form-group').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const payload = {
    code: form.code.value.trim(),
    owner: form.owner.value.trim(),
    address: form.address.value.trim()
  };

  let error;
  if (editingGroupId) {
    ({ error } = await supabase.from('group_private').update(payload).eq('id', editingGroupId));
    editingGroupId = null;
  } else {
    ({ error } = await supabase.from('group_private').insert(payload));
  }

  showAlert('alert-group', error ? '❌ ' + error.message : '✅ Group berhasil disimpan', !error);
  if (!error) { form.reset(); loadGroups(); }
});

document.getElementById('form-class').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const payload = {
    name: form.name.value.trim(),
    level_id: form.level_id.value, // foreign key ke levels
    group_id: form.group_id.value
  };

  let error;
  if (editingClassId) {
    ({ error } = await supabase.from('class_private').update(payload).eq('id', editingClassId));
    editingClassId = null;
  } else {
    ({ error } = await supabase.from('class_private').insert(payload));
  }

  showAlert('alert-class', error ? '❌ ' + error.message : '✅ Class berhasil disimpan', !error);
  if (!error) { form.reset(); loadClasses(); }
});

document.getElementById('form-students').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const payload = {
    name: form.name.value.trim(),
    class_id: form.class_id.value
  };

  let error;
  if (editingStudentId) {
    ({ error } = await supabase.from('students_private').update(payload).eq('id', editingStudentId));
    editingStudentId = null;
  } else {
    ({ error } = await supabase.from('students_private').insert(payload));
  }

  showAlert('alert-students', error ? '❌ ' + error.message : '✅ Siswa berhasil disimpan', !error);
  if (!error) { form.reset(); loadStudents(); }
});

// =======================
// ✏️ EDIT & DELETE
// =======================

window.editGroup = async id => {
  const { data, error } = await supabase.from('group_private').select('*').eq('id', id).single();
  if (error) { console.error(error); return; }
  document.querySelector('#group-code').value   = data.code;
  document.querySelector('#group-owner').value  = data.owner;
  document.querySelector('#group-address').value = data.address || '';
  editingGroupId = id;
};

window.deleteGroup = async id => {
  if (!confirm('Hapus group ini?')) return;
  const { error } = await supabase.from('group_private').delete().eq('id', id);
  if (!error) loadGroups();
};

window.editClass = async id => {
  const { data, error } = await supabase.from('class_private').select('*').eq('id', id).single();
  if (error) { console.error(error); return; }
  document.querySelector('#class-name').value  = data.name;
  document.querySelector('#class-level').value = data.level_id || '';
  document.querySelector('#class-group').value = data.group_id;
  editingClassId = id;
};

window.deleteClass = async id => {
  if (!confirm('Hapus class ini?')) return;
  const { error } = await supabase.from('class_private').delete().eq('id', id);
  if (!error) loadClasses();
};

window.editStudent = async id => {
  const { data, error } = await supabase.from('students_private').select('*').eq('id', id).single();
  if (error) { 
    console.error(error); 
    return; 
  }
  // isi form dengan data siswa
  document.querySelector('#student-name').value  = data.name;
  document.querySelector('#student-class').value = data.class_id || '';
  editingStudentId = id;
};

window.deleteStudent = async id => {
  if (!confirm('Hapus siswa ini?')) return;
  const { error } = await supabase.from('students_private').delete().eq('id', id);
  if (error) {
    console.error(error);
    showAlert('alert-students', '❌ ' + error.message, false);
  } else {
    showAlert('alert-students', '✅ Siswa berhasil dihapus', true);
    loadStudents();
  }
};

// =======================
// 🔔 ALERT
// =======================
function showAlert(id, message, success = true) {
  const el = document.getElementById(id);
  if (!el) return;

  el.textContent = message;
  el.className = `alert ${success ? 'success' : 'error'}`;
  el.style.display = 'block';

  // Hilangkan alert setelah 3 detik
  setTimeout(() => {
    el.style.display = 'none';
    el.textContent = '';
  }, 3000);
}
