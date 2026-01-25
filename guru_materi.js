import { supabase } from "./config.js";

// --- State Management ---
let currentTab = "materi"; // Default ke materi
let editingId = null;

// --- DOM Elements ---
const modal = document.getElementById("modal-overlay");
const formFields = document.getElementById("form-fields");
const modalTitle = document.getElementById("modal-title");
const globalSearch = document.getElementById("globalSearch");

// =========================================
// 🟢 SEKTOR 1: TAB NAVIGATION & UI
// =========================================

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-content").forEach(content => {
    content.classList.toggle("active", content.id === `${tab}-section`);
  });
  
  // Tampilkan filter khusus hanya jika di tab materi
  const filterMateri = document.getElementById("materi-filter");
  if (filterMateri) {
    filterMateri.style.display = (tab === "materi") ? "flex" : "none";
  }
  
  loadData();
}

// Event Listeners untuk Tab
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// =========================================
// 🟢 SEKTOR 2: DATA LOADING & RENDERING
// =========================================

async function loadData() {
  const searchTerm = globalSearch.value.toLowerCase();

  if (currentTab === "materi") {
    const { data } = await supabase.from("materi").select("*").order("level").order("title");
    const filtered = data ? data.filter(m => m.title.toLowerCase().includes(searchTerm)) : [];
    renderMateri(filtered);
  }
  else if (currentTab === "achievement") {
    const { data } = await supabase.from("achievement_sekolah").select("*").order("main_achievement");
    const filtered = data ? data.filter(a => a.main_achievement.toLowerCase().includes(searchTerm)) : [];
    renderAchievement(filtered);
  }
}

// --- RENDER MATERI (Compact List with Status) ---
function renderMateri(data) {
  const container = document.getElementById("materi-list");
  container.innerHTML = data.map(m => {
    // Logic Status: Judul, Level, Deskripsi, Detail
    const score = [m.title, m.level, m.description, m.detail].filter(Boolean).length;
    const statusColor = score === 4 ? "🟢" : (score >= 2 ? "🟡" : "🔴");
    
    return `
      <div class="compact-item" onclick="openEditModal('materi', '${m.id}')">
        <div class="item-info">
          <span class="status-dot">${statusColor}</span>
          <span class="item-title"><b>[LVL ${m.level || "?"}]</b> ${m.title}</span>
        </div>
        <div class="item-actions">
          <button class="btn-minimal">📝</button>
          <button class="btn-minimal delete" onclick="event.stopPropagation(); deleteData('materi', '${m.id}')">🗑️</button>
        </div>
      </div>`;
  }).join("");
}

// --- RENDER ACHIEVEMENT (Accordion/Library) ---
function renderAchievement(data) {
  const container = document.getElementById("achievement-library");
  container.innerHTML = data.map(a => `
    <div class="achievement-folder">
      <div class="folder-header" onclick="openEditModal('achievement', '${a.id}')">
        <span>▼ <b>${a.main_achievement}</b></span>
        <div class="folder-actions">
          <button class="btn-minimal">📝</button>
          <button class="btn-minimal delete" onclick="event.stopPropagation(); deleteData('achievement_sekolah', '${a.id}')">🗑️</button>
        </div>
      </div>
    </div>`).join("");
}

// =========================================
// 🟢 SEKTOR 3: FORM & MODAL LOGIC
// =========================================

function injectFormFields(mode = "add", data = {}) {
  formFields.innerHTML = "";
  modalTitle.textContent = `${mode === "edit" ? "Edit" : "Tambah"} ${currentTab.toUpperCase()}`;

  if (currentTab === "materi") {
    formFields.innerHTML = `
      <label>Judul Materi</label>
      <input type="text" id="title" value="${data.title || ""}" required>
      <label>Level</label>
      <input type="text" id="level" value="${data.level || ""}">
      <label>Deskripsi</label>
      <textarea id="description">${data.description || ""}</textarea>
      <label>Detail Lesson Plan</label>
      <textarea id="detail" style="height:150px">${data.detail || ""}</textarea>`;
  }
  else if (currentTab === "achievement") {
    formFields.innerHTML = `
      <label>Topik Utama Achievement</label>
      <input type="text" id="main_achievement" value="${data.main_achievement || ""}" required>`;
  }
}

// Simpan Data
document.getElementById("dynamic-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const tableMap = { materi: "materi", achievement: "achievement_sekolah" };
  const table = tableMap[currentTab];
  
  const payload = {};
  formFields.querySelectorAll("input, select, textarea").forEach(el => {
    payload[el.id] = el.value;
  });

  const { error } = editingId 
    ? await supabase.from(table).update(payload).eq("id", editingId)
    : await supabase.from(table).insert([payload]);

  if (error) alert("Gagal: " + error.message);
  else {
    modal.classList.remove("active");
    loadData();
  }
});

// =========================================
// 🟢 SEKTOR 4: ACTIONS & HELPERS
// =========================================

window.openEditModal = async (tab, id) => {
  const tableMap = { materi: "materi", achievement: "achievement_sekolah" };
  const { data } = await supabase.from(tableMap[tab]).select("*").eq("id", id).single();
  
  if (data) {
    editingId = id;
    injectFormFields("edit", data);
    modal.classList.add("active");
  }
};

window.deleteData = async (table, id) => {
  if (!confirm("Yakin ingin menghapus data ini?")) return;
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) alert("Gagal hapus: " + error.message);
  else loadData();
};

document.getElementById("fab-add").addEventListener("click", () => {
  editingId = null;
  injectFormFields("add");
  modal.classList.add("active");
});

document.getElementById("modal-close").addEventListener("click", () => {
  modal.classList.remove("active");
});

globalSearch.addEventListener("input", loadData);

document.addEventListener("DOMContentLoaded", () => {
  switchTab("materi");
});