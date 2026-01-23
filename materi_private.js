// materi_private.js
import { supabase } from './config.js';

// State edit
let editingMateriId = null;
let editingLevelId = null;

// =======================
// 🔄 INIT
// =======================
document.addEventListener('DOMContentLoaded', () => {
  loadLevels();
  loadMateri();
  loadAchievement();
  loadLevelsDropdown();
  
  // Tambahkan satu baris kosong pertama di tab achievement
  addNewAchievementRow();
  
  // Inisialisasi Datalist dari data yang sudah ada
  refreshMainAchDatalist();
});

// =======================
// 📋 LOAD FUNCTIONS
// =======================

// 1. Load Levels
async function loadLevels() {
  const { data, error } = await supabase.from('levels').select('*').order('kode');
  const tbody = document.querySelector('#levels-list tbody');
  if (error) return;

  tbody.innerHTML = data.map(l => `
    <tr>
      <td><strong>${l.kode}</strong></td>
      <td>${l.detail || '-'}</td>
      <td>
        <button onclick="editLevel('${l.id}')">Edit</button>
        <button onclick="deleteLevel('${l.id}')">Hapus</button>
      </td>
    </tr>`).join('');
}

// 2. Load Materi
async function loadMateri() {
  const { data, error } = await supabase
    .from('materi_private')
    .select('id, judul, levels(kode)')
    .order('judul');
  const tbody = document.querySelector('#materi-list tbody');
  if (error) return;

  tbody.innerHTML = data.map(m => `
    <tr>
      <td>${m.judul}</td>
      <td><span class="badge">${m.levels?.kode || '-'}</span></td>
      <td>
        <button onclick="editMateri('${m.id}')">Edit</button>
        <button onclick="deleteMateri('${m.id}')">Hapus</button>
      </td>
    </tr>`).join('');
}

// 3. Load Achievement
async function loadAchievement() {
  const { data, error } = await supabase
    .from('achievement_private')
    .select('id, main_achievement, sub_achievement, levels(kode)')
    .order('created_at', { ascending: false });

  const tbody = document.querySelector('#achievement-list tbody');
  if (error) return;

  tbody.innerHTML = data.map(a => `
    <tr>
      <td><span class="badge">${a.levels?.kode || 'N/A'}</span></td>
      <td><strong>${a.main_achievement || '-'}</strong></td>
      <td>${a.sub_achievement || '-'}</td>
      <td>
        <button onclick="deleteAchievement('${a.id}')">Hapus</button>
      </td>
    </tr>`).join('');
}

// 4. Load Dropdowns
window.loadLevelsDropdown = async () => {
  const { data } = await supabase.from('levels').select('id, kode').order('kode');
  if (!data) return;

  const html = '<option value="">-- Pilih Level --</option>' + 
               data.map(l => `<option value="${l.id}">${l.kode}</option>`).join('');
  
  document.getElementById('materi-level-select').innerHTML = html;
  document.getElementById('achievement-level-select').innerHTML = html;
};

// =======================
// ⚡ DYNAMIC ROW LOGIC (Achievement)
// =======================

window.addNewAchievementRow = () => {
  const tbody = document.getElementById('achievement-rows');
  const tr = document.createElement('tr');
  tr.className = 'achievement-input-row';
  tr.innerHTML = `
    <td>
      <input type="text" list="list-main-ach" class="in-main" placeholder="Misal: Mechanics" required>
    </td>
    <td>
      <input type="text" class="in-sub" placeholder="Misal: Merakit Gear Ratio 1:3" required>
    </td>
    <td>
      <button type="button" class="btn-delete" onclick="this.parentElement.parentElement.remove()">❌</button>
    </td>
  `;
  tbody.appendChild(tr);
};

window.saveBulkAchievements = async () => {
  const levelId = document.getElementById('achievement-level-select').value;
  const rows = document.querySelectorAll('.achievement-input-row');
  
  if (!levelId) return alert("Silakan pilih Level terlebih dahulu!");
  if (rows.length === 0) return alert("Tambahkan minimal satu baris achievement!");

  const dataToSave = Array.from(rows).map(row => ({
    level_id: levelId,
    main_achievement: row.querySelector('.in-main').value.trim(),
    sub_achievement: row.querySelector('.in-sub').value.trim()
  })).filter(item => item.main_achievement !== "");

  const { error } = await supabase.from('achievement_private').insert(dataToSave);

  if (error) {
    showAlert('alert-achievement', '❌ ' + error.message, false);
  } else {
    showAlert('alert-achievement', `✅ Berhasil menyimpan ${dataToSave.length} achievement`, true);
    document.getElementById('achievement-rows').innerHTML = '';
    addNewAchievementRow(); 
    loadAchievement();
    refreshMainAchDatalist(); // Update datalist dengan kategori baru jika ada
  }
};

// Fungsi untuk membuat Datalist menjadi dinamis dari DB
async function refreshMainAchDatalist() {
  const { data } = await supabase.from('achievement_private').select('main_achievement');
  if (data) {
    const unique = [...new Set(data.map(i => i.main_achievement).filter(Boolean))];
    const datalist = document.getElementById('list-main-ach');
    // Tambahkan default jika kosong
    if (unique.length === 0) unique.push("Mechanics", "Programming", "Electronics");
    datalist.innerHTML = unique.map(cat => `<option value="${cat}">`).join('');
  }
}

// =======================
// 💾 CRUD ACTIONS
// =======================

// Materi CRUD
document.getElementById('form-materi').addEventListener('submit', async e => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const payload = {
    judul: formData.get('judul'),
    level_id: formData.get('level_id'),
    deskripsi: formData.get('deskripsi')
  };

  let res;
  if (editingMateriId) {
    res = await supabase.from('materi_private').update(payload).eq('id', editingMateriId);
    editingMateriId = null;
  } else {
    res = await supabase.from('materi_private').insert([payload]);
  }

  if (res.error) showAlert('alert-materi', '❌ ' + res.error.message, false);
  else {
    showAlert('alert-materi', '✅ Materi berhasil disimpan', true);
    e.target.reset();
    loadMateri();
  }
});

// Levels CRUD
document.getElementById('form-levels').addEventListener('submit', async e => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const payload = { kode: formData.get('kode'), detail: formData.get('detail') };

  let res;
  if (editingLevelId) {
    res = await supabase.from('levels').update(payload).eq('id', editingLevelId);
    editingLevelId = null;
  } else {
    res = await supabase.from('levels').insert([payload]);
  }

  if (res.error) showAlert('alert-levels', '❌ ' + res.error.message, false);
  else {
    showAlert('alert-levels', '✅ Level berhasil disimpan', true);
    e.target.reset();
    loadLevels();
    loadLevelsDropdown();
  }
});

// Delete Achievement
window.deleteAchievement = async id => {
  if (!confirm('Hapus data ini dari bank data?')) return;
  const { error } = await supabase.from('achievement_private').delete().eq('id', id);
  if (!error) loadAchievement();
};

// ... Tambahkan window.editMateri, window.deleteMateri, dll sesuai kebutuhan CRUD standard ...

function showAlert(id, message, success = true) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.style.display = 'block';
  el.style.color = success ? 'green' : 'red';
  setTimeout(() => el.style.display = 'none', 3000);
}