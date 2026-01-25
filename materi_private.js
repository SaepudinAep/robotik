import { supabase } from './config.js';

let currentTab = "materi"; // Set default ke Materi sesuai permintaan
let editingId = null;

// =========================================
// 🟢 INITIALIZATION & TABS
// =========================================
document.addEventListener('DOMContentLoaded', () => {
  // Tambahkan Listeners untuk tombol tab di sini
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  switchTab("materi");
});

function switchTab(tab) {
  currentTab = tab;
  
  // Update class active pada tombol
  document.querySelectorAll(".tab-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  
  // Update class active pada section konten
  document.querySelectorAll(".tab-content").forEach(c => {
    c.classList.toggle("active", c.id === `${tab}-section`);
  });
  
  loadData(); 
}
// =========================================
// 🟢 LOAD & RENDER DATA (Wajib Async)
// =========================================
async function loadData() {
  const search = document.getElementById("globalSearch").value.toLowerCase();

  // Gunakan await untuk setiap panggilan database
  if (currentTab === "levels") {
    const { data } = await supabase.from('levels').select('*').order('kode');
    renderLevels(data ? data.filter(l => l.kode.toLowerCase().includes(search)) : []);
  } 
  else if (currentTab === "materi") {
    const { data } = await supabase.from('materi_private').select('*, levels(kode)').order('judul');
    renderMateri(data ? data.filter(m => m.judul.toLowerCase().includes(search)) : []);
  }
  else if (currentTab === "achievement") {
    const { data } = await supabase.from('achievement_private').select('*, levels(kode)').order('created_at', {ascending: false});
    renderAchievement(data ? data.filter(a => a.main_achievement.toLowerCase().includes(search)) : []);
  }
  else if (currentTab === "guru") {
    const { data } = await supabase.from('teachers').select('*').order('name');
    renderGuru(data ? data.filter(g => g.name.toLowerCase().includes(search)) : []);
  }
}

// Fungsi Render (UI Only) - Tidak perlu async
function renderGuru(data) {
  const container = document.getElementById("guru-list");
  container.innerHTML = data.map(g => `
    <div class="compact-item" onclick="openEditModal('guru', '${g.id}')">
      <div class="item-info">
        <span class="status-dot">👤</span>
        <span class="item-title"><b>${g.name}</b> (${g.role.toUpperCase()})</span>
      </div>
      <button class="btn-minimal">📝</button>
    </div>`).join("");
}

function renderLevels(data) {
  const container = document.getElementById("levels-list");
  container.innerHTML = data.map(l => `
    <div class="compact-item" onclick="openEditModal('levels', '${l.id}')">
      <div class="item-info">
        <span class="badge">${l.kode}</span>
        <span class="item-title">${l.detail || '-'}</span>
      </div>
      <button class="btn-minimal">📝</button>
    </div>`).join("");
}

function renderMateri(data) {
  const container = document.getElementById("materi-list");
  container.innerHTML = data.map(m => `
    <div class="compact-item" onclick="openEditModal('materi', '${m.id}')">
      <div class="item-info">
        <span class="status-dot">📘</span>
        <span class="item-title"><b>[${m.levels?.kode || '?'}]</b> ${m.judul}</span>
      </div>
      <button class="btn-minimal">📝</button>
    </div>`).join("");
}

function renderAchievement(data) {
  const container = document.getElementById("achievement-library");
  const grouped = data.reduce((acc, obj) => {
    const key = obj.levels?.kode || 'Uncategorized';
    if (!acc[key]) acc[key] = [];
    acc[key].push(obj);
    return acc;
  }, {});

  container.innerHTML = Object.keys(grouped).map(level => `
    <div class="achievement-folder">
      <div class="folder-header">
        <span>▼ <b>LEVEL ${level}</b></span>
      </div>
      <div class="folder-content">
        ${grouped[level].map(a => `
          <div class="target-item">
            <span><b>${a.main_achievement}:</b> ${a.sub_achievement}</span>
            <button class="btn-minimal" onclick="deleteData('${currentTab}', '${a.id}')">🗑️</button>
          </div>
        `).join("")}
      </div>
    </div>`).join("");
}

// =========================================
// 🟢 MODAL & FORM INJECTION (Wajib Async karena ambil Level)
// =========================================
async function injectFormFields(mode = "add", data = {}) {
  const formFields = document.getElementById("form-fields");
  
  if (currentTab === "levels") {
    formFields.innerHTML = `
      <label>Kode Level</label>
      <input type="text" id="kode" value="${data.kode || ""}" placeholder="LV-1" required>
      <label>Deskripsi Level</label>
      <textarea id="detail">${data.detail || ""}</textarea>`;
  } 
  else if (currentTab === "materi" || currentTab === "achievement") {
    // Ambil data level untuk dropdown
    const { data: lvData } = await supabase.from('levels').select('id, kode').order('kode');
    const options = lvData.map(l => `<option value="${l.id}" ${data.level_id === l.id ? "selected" : ""}>${l.kode}</option>`).join("");
    
    if (currentTab === "materi") {
      formFields.innerHTML = `
        <label>Pilih Level</label><select id="level_id">${options}</select>
        <label>Judul Materi</label><input type="text" id="judul" value="${data.judul || ""}" required>
        <label>Deskripsi</label><textarea id="deskripsi">${data.deskripsi || ""}</textarea>`;
    } else {
      formFields.innerHTML = `
        <label>Pilih Level</label><select id="level_id">${options}</select>
        <label>Kategori</label><input type="text" id="main_achievement" value="${data.main_achievement || ""}">
        <label>Detail Target</label><textarea id="sub_achievement">${data.sub_achievement || ""}</textarea>`;
    }
  }
  else if (currentTab === "guru") {
    formFields.innerHTML = `
      <label>Nama Guru/Asisten</label><input type="text" id="name" value="${data.name || ""}" required>
      <label>Role</label>
      <select id="role">
        <option value="guru" ${data.role === "guru" ? "selected" : ""}>Guru</option>
        <option value="asisten" ${data.role === "asisten" ? "selected" : ""}>Asisten</option>
      </select>`;
  }
}

// =========================================
// 🟢 ACTIONS (CRUD)
// =========================================

// Klik Baris/Edit
window.openEditModal = async (type, id) => {
  const tableMap = { levels: 'levels', materi: 'materi_private', achievement: 'achievement_private', guru: 'teachers' };
  const { data } = await supabase.from(tableMap[type]).select('*').eq('id', id).single();
  if (data) {
    editingId = id;
    await injectFormFields("edit", data);
    document.getElementById("modal-overlay").classList.add("active");
  }
};

// Hapus Data
window.deleteData = async (type, id) => {
  if(!confirm("Hapus data dari matrix?")) return;
  const tableMap = { levels: 'levels', materi: 'materi_private', achievement: 'achievement_private', guru: 'teachers' };
  const { error } = await supabase.from(tableMap[type]).delete().eq('id', id);
  if(!error) loadData();
};

// Submit Form
document.getElementById("dynamic-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const tableMap = { levels: 'levels', materi: 'materi_private', achievement: 'achievement_private', guru: 'teachers' };
  const payload = {};
  e.target.querySelectorAll("input, select, textarea").forEach(el => payload[el.id] = el.value);

  const { error } = editingId 
    ? await supabase.from(tableMap[currentTab]).update(payload).eq('id', editingId)
    : await supabase.from(tableMap[currentTab]).insert([payload]);

  if(!error) {
    document.getElementById("modal-overlay").classList.remove("active");
    loadData();
  } else alert(error.message);
});

// Tambah Baru
document.getElementById("fab-add").addEventListener("click", async () => {
  editingId = null;
  await injectFormFields("add");
  document.getElementById("modal-overlay").classList.add("active");
});

document.getElementById("modal-close").addEventListener("click", () => document.getElementById("modal-overlay").classList.remove("active"));
document.getElementById("globalSearch").addEventListener("input", loadData);