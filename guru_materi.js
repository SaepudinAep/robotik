import { supabase, cloudinaryConfig } from "./config.js";

// --- State Management ---
let currentTab = "materi"; 
let editingId = null;

// --- DOM Elements ---
const modal = document.getElementById("modal-overlay");
const formFields = document.getElementById("form-fields");
const modalTitle = document.getElementById("modal-title");
const globalSearch = document.getElementById("globalSearch");

// =========================================
//   SEKTOR 0: CLOUDINARY LOGIC
// =========================================
function openUploadWidget(callback, customFolder = "robotic_school") {
  if (!cloudinaryConfig || !cloudinaryConfig.cloudName) {
    alert("Config Error: Cek config.js"); 
    return; 
  }

  window.cloudinary.openUploadWidget({
    cloudName: cloudinaryConfig.cloudName,
    uploadPreset: cloudinaryConfig.uploadPreset,
    folder: customFolder,
    sources: ["local", "camera"],
    multiple: false,
    cropping: true,
    croppingAspectRatio: 0.75,
    showSkipCropButton: false,
    croppingShowBackButton: true,
  }, (error, result) => {
    if (!error && result.event === "success") {
      const coords = result.info.coordinates;
      let transformation = "c_fill,ar_3:4,g_custom"; 

      if (coords && coords.custom && coords.custom[0]) {
        const c = coords.custom[0];
        transformation = `x_${c[0]},y_${c[1]},w_${c[2]},h_${c[3]},c_crop`;
      }

      const finalUrl = result.info.secure_url.replace(
        "/upload/", 
        `/upload/${transformation}/f_auto,q_auto/`
      );
      callback(finalUrl);
    }
  });
}

// =========================================
//   SEKTOR 1: INISIALISASI & NAVIGASI
// =========================================
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll(".tab-btn");
  if(tabs.length > 0) {
      tabs.forEach(btn => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab));
      });
  }
  if(globalSearch) globalSearch.addEventListener("input", loadData);
  switchTab("materi");
});

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-content").forEach(c => {
    c.classList.toggle("active", c.id === `${tab}-section`);
  });
  loadData(); 
}

// =========================================
//   SEKTOR 2: LOAD & RENDER DATA
// =========================================
async function loadData() {
  const search = globalSearch ? globalSearch.value.toLowerCase() : "";
  const containerMateri = document.getElementById("materi-list");
  const containerAchieve = document.getElementById("achievement-library");

  try {
    if (currentTab === "materi") {
      const { data, error } = await supabase.from('materi').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const filtered = data ? data.filter(m => m.title?.toLowerCase().includes(search)) : [];
      
      containerMateri.innerHTML = filtered.map(m => `
        <div class="compact-item" onclick="openEditModal('materi', '${m.id}')">
          <div class="item-info">
             <i class="fas fa-book" style="color: #3498db; margin-right: 12px;"></i>
             <span class="item-title"><b>${m.title}</b></span>
          </div>
          <div class="item-actions">
            <button class="btn-minimal text-danger" onclick="event.stopPropagation(); deleteData('materi', '${m.id}')">
              <i class="fas fa-trash-can"></i>
            </button>
          </div>
        </div>`).join("");
    } 
    else if (currentTab === "achievement") {
      const { data, error } = await supabase.from('achievement_sekolah').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const filtered = data ? data.filter(a => a.main_achievement?.toLowerCase().includes(search)) : [];
      
      containerAchieve.innerHTML = filtered.map(a => {
        // Pecah sub_achievement menjadi list
        const subList = (a.sub_achievement || "").split('\n').filter(s => s.trim() !== "");
        
        return `
        <div class="achievement-folder" onclick="openEditModal('achievement', '${a.id}')" style="background:white; padding:15px; border-radius:10px; margin-bottom:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06); cursor:pointer;">
          <div class="folder-header" style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="flex:1;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                <i class="fas fa-trophy" style="color: #f1c40f;"></i> 
                <b style="font-size:1.1rem; color:#2c3e50;">${a.main_achievement}</b>
              </div>
              <ul style="margin:0; font-size:0.85rem; color:#7f8c8d; padding-left:25px; list-style-type: circle;">
                ${subList.map(s => `<li>${s}</li>`).join("") || "<li>-</li>"}
              </ul>
            </div>
            <div class="folder-actions">
              <button class="btn-minimal text-danger" onclick="event.stopPropagation(); deleteData('achievement_sekolah', '${a.id}')">
                <i class="fas fa-trash-can"></i>
              </button>
            </div>
          </div>
        </div>`;
      }).join("");
    }
  } catch (err) {
    console.error("Gagal Load Data:", err.message);
  }
}

// =========================================
//   SEKTOR 3: FORM & DYNAMIC ROWS LOGIC
// =========================================

// Helper: Menambah baris input sub-achievement
function addSubRow(value = "") {
  const container = document.getElementById("sub-ach-container");
  const row = document.createElement("div");
  row.className = "sub-row";
  row.style = "display:flex; gap:8px; margin-bottom:8px;";
  row.innerHTML = `
    <input type="text" class="sub-input" value="${value}" placeholder="Masukkan detail target..." style="flex:1;">
    <button type="button" class="btn-remove" onclick="this.parentElement.remove()" style="background:#ff7675; color:white; border:none; border-radius:8px; width:35px; cursor:pointer;">&times;</button>
  `;
  container.appendChild(row);
}

async function injectFormFields(mode = "add", data = {}) {
  modalTitle.textContent = `${mode === "edit" ? "Edit" : "Tambah"} Data`;

  if (currentTab === "materi") {
    const currentImg = data.image_url || "https://via.placeholder.com/150?text=No+Image";
    formFields.innerHTML = `
      <label>Judul Materi</label>
      <input type="text" id="title" value="${data.title || ""}" required>
      <label>Foto Project</label>
      <div style="margin-bottom: 20px;">
        <button type="button" id="btn-upload-p" style="background:#3498db; color:white; border:none; padding:12px; border-radius:12px; cursor:pointer; width:100%; margin-bottom:10px; font-weight:bold;">
          <i class="fas fa-camera"></i> Upload Foto
        </button>
        <input type="hidden" id="image_url" value="${data.image_url || ""}">
        <div style="text-align:center;">
          <img id="img-preview-p" src="${currentImg}" style="width:100%; max-height:180px; object-fit:cover; border-radius:15px; border:2px solid #eee;">
        </div>
      </div>
      <label>Deskripsi</label><textarea id="description">${data.description || ""}</textarea>
      <label>Detail Lengkap</label><textarea id="detail">${data.detail || ""}</textarea>`;
      
      setTimeout(() => {
        const btn = document.getElementById("btn-upload-p");
        if(btn) btn.onclick = () => openUploadWidget(url => {
          document.getElementById("image_url").value = url;
          document.getElementById("img-preview-p").src = url;
        });
      }, 100);

  } else if (currentTab === "achievement") {
    // MODAL DYNAMIC ROWS UNTUK ACHIEVEMENT
    formFields.innerHTML = `
      <label>Topik Utama (Main Achievement)</label>
      <input type="text" id="main_achievement" value="${data.main_achievement || ""}" placeholder="Contoh: Robotika Dasar" required>
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:15px; margin-bottom:10px;">
        <label style="margin:0;">Detail Target (Sub Achievements)</label>
        <button type="button" id="btn-add-sub" style="background:#55efc4; color:#00b894; border:none; padding:4px 12px; border-radius:8px; cursor:pointer; font-weight:bold;">
          <i class="fas fa-plus"></i> Tambah Sub
        </button>
      </div>
      
      <div id="sub-ach-container">
        </div>
    `;

    // Ambil data sub lama (jika ada) dan pecah jadi baris
    const existingSubs = (data.sub_achievement || "").split('\n').filter(s => s.trim() !== "");
    if (existingSubs.length > 0) {
      existingSubs.forEach(val => addSubRow(val));
    } else {
      addSubRow(); // Baris kosong pertama jika data baru
    }

    document.getElementById("btn-add-sub").onclick = () => addSubRow();
  }
}

// =========================================
//   SEKTOR 4: ACTIONS (CRUD)
// =========================================
window.openEditModal = async (tab, id) => {
  const tableMap = { materi: 'materi', achievement: 'achievement_sekolah' };
  const { data } = await supabase.from(tableMap[tab]).select('*').eq('id', id).single();
  if (data) {
    editingId = id;
    await injectFormFields("edit", data);
    modal.classList.add("active");
  }
};

window.deleteData = async (tableType, id) => {
  if(!confirm("Hapus data ini?")) return;
  const { error } = await supabase.from(tableType).delete().eq('id', id);
  if(!error) loadData();
  else alert("Gagal hapus: " + error.message);
};

const formEl = document.getElementById("dynamic-form");
if(formEl) {
    formEl.addEventListener("submit", async (e) => {
      e.preventDefault();
      const tableMap = { materi: 'materi', achievement: 'achievement_sekolah' };
      const payload = {};
      
      // Ambil input standard
      e.target.querySelectorAll("input:not(.sub-input), select, textarea").forEach(el => {
        if (el.id) payload[el.id] = el.value;
      });

      // KHUSUS ACHIEVEMENT: Gabungkan semua sub-input jadi satu string teks dipisah newline
      if (currentTab === "achievement") {
        const subInputs = Array.from(document.querySelectorAll(".sub-input"));
        payload.sub_achievement = subInputs
          .map(input => input.value.trim())
          .filter(val => val !== "") // Abaikan jika kosong
          .join('\n');
      }

      const { error } = editingId 
        ? await supabase.from(tableMap[currentTab]).update(payload).eq('id', editingId)
        : await supabase.from(tableMap[currentTab]).insert([payload]);

      if(!error) {
        modal.classList.remove("active");
        loadData();
      } else {
        alert("Gagal simpan: " + error.message);
      }
    });
}

const fab = document.getElementById("fab-add");
if(fab) fab.addEventListener("click", async () => {
  editingId = null;
  await injectFormFields("add");
  modal.classList.add("active");
});

const closeBtn = document.getElementById("modal-close");
if(closeBtn) closeBtn.addEventListener("click", () => modal.classList.remove("active"));