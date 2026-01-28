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
    croppingAspectRatio: 0.75, // 3:4 Portrait
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
  // 1. Pasang Listener Tombol Tab
  const tabs = document.querySelectorAll(".tab-btn");
  if(tabs.length > 0) {
      tabs.forEach(btn => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab));
      });
  }

  // 2. Listener Search
  if(globalSearch) globalSearch.addEventListener("input", loadData);

  // 3. Jalankan Default
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
//   SEKTOR 2: LOAD DATA (SESUAI SQL)
// =========================================
async function loadData() {
  const search = globalSearch ? globalSearch.value.toLowerCase() : "";
  const containerMateri = document.getElementById("materi-list");
  const containerAchieve = document.getElementById("achievement-library");

  // Loading UI
  if (currentTab === "materi" && containerMateri) containerMateri.innerHTML = '<p style="text-align:center; padding:20px;">⏳ Memuat Materi Sekolah...</p>';
  if (currentTab === "achievement" && containerAchieve) containerAchieve.innerHTML = '<p style="text-align:center; padding:20px;">⏳ Memuat Achievement...</p>';

  try {
    // --- TAB MATERI (Target: tabel 'materi') ---
    if (currentTab === "materi") {
      // SQL: tabel 'materi' (sekolah)
      const { data, error } = await supabase.from('materi').select('*').order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // PERBAIKAN: Gunakan 'm.title' (bukan judul) sesuai SQL
      const filtered = data ? data.filter(m => m.title?.toLowerCase().includes(search)) : [];
      
      if (filtered.length === 0) {
        containerMateri.innerHTML = '<p style="text-align:center; color:#999;">Data materi kosong.</p>';
        return;
      }

      containerMateri.innerHTML = filtered.map(m => `
        <div class="compact-item" onclick="openEditModal('materi', '${m.id}')">
          <div class="item-info">
             <i class="fas fa-book" style="color: #3498db; margin-right: 12px;"></i>
             <span class="item-title"><b>${m.title}</b></span> <!- GANTI KE TITLE -->
          </div>
          <div class="item-actions">
            <button class="btn-minimal text-danger" onclick="event.stopPropagation(); deleteData('materi', '${m.id}')">
              <i class="fas fa-trash-can"></i>
            </button>
          </div>
        </div>`).join("");
    } 
    // --- TAB ACHIEVEMENT (Target: tabel 'achievement_sekolah') ---
    else if (currentTab === "achievement") {
      const { data, error } = await supabase.from('achievement_sekolah').select('*').order('created_at', { ascending: false });
      
      if (error) throw error;

      const filtered = data ? data.filter(a => a.main_achievement?.toLowerCase().includes(search)) : [];
      
      if (filtered.length === 0) {
        containerAchieve.innerHTML = '<p style="text-align:center; color:#999;">Data achievement kosong.</p>';
        return;
      }

      containerAchieve.innerHTML = filtered.map(a => `
        <div class="achievement-folder" onclick="openEditModal('achievement', '${a.id}')" style="background:white; padding:15px; border-radius:10px; margin-bottom:10px; box-shadow:0 2px 5px rgba(0,0,0,0.05); cursor:pointer;">
          <div class="folder-header" style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="flex:1;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">
                <i class="fas fa-trophy" style="color: gold;"></i> 
                <b style="font-size:1.05rem;">${a.main_achievement}</b>
              </div>
              <p style="margin:0; font-size:0.9rem; color:#666; padding-left:24px;">
                ${a.sub_achievement || "-"}
              </p>
            </div>
            <div class="folder-actions">
              <button class="btn-minimal text-danger" onclick="event.stopPropagation(); deleteData('achievement_sekolah', '${a.id}')">
                <i class="fas fa-trash-can"></i>
              </button>
            </div>
          </div>
        </div>
      `).join("");
    }
  } catch (err) {
    console.error("Gagal Load Data:", err.message);
    const msg = `<div style="text-align:center; color:red; padding:20px;">Error: ${err.message}</div>`;
    if(currentTab === "materi") containerMateri.innerHTML = msg;
    else containerAchieve.innerHTML = msg;
  }
}

// =========================================
//   SEKTOR 3: FORM & MODAL LOGIC
// =========================================
async function injectFormFields(mode = "add", data = {}) {
  modalTitle.textContent = `${mode === "edit" ? "Edit" : "Tambah"} Data`;

  if (currentTab === "materi") {
    // FORM MATERI SEKOLAH (Menggunakan 'title')
    const currentImg = data.image_url || "https://via.placeholder.com/150?text=No+Image";
    
    // PERBAIKAN: Input ID='title' agar sesuai nama kolom database saat di-save
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

      <label>Deskripsi</label>
      <textarea id="description">${data.description || ""}</textarea>
      
      <label>Detail Lengkap</label>
      <textarea id="detail">${data.detail || ""}</textarea>
      `;
      
      setTimeout(() => {
        const btnUpload = document.getElementById("btn-upload-p");
        if(btnUpload) {
            btnUpload.onclick = () => {
              openUploadWidget((url) => {
                document.getElementById("image_url").value = url;
                document.getElementById("img-preview-p").src = url;
              });
            };
        }
      }, 100);

  } else if (currentTab === "achievement") {
    // FORM ACHIEVEMENT SEKOLAH
    formFields.innerHTML = `
      <label>Topik Utama (Main Achievement)</label>
      <input type="text" id="main_achievement" value="${data.main_achievement || ""}" required>
      
      <label>Detail Target (Sub Achievement)</label>
      <textarea id="sub_achievement" rows="5">${data.sub_achievement || ""}</textarea>
    `;
  }
}

// =========================================
//   SEKTOR 4: ACTIONS (CRUD)
// =========================================
window.openEditModal = async (tab, id) => {
  // Mapping Table (Achievement -> achievement_sekolah)
  const tableMap = { materi: 'materi', achievement: 'achievement_sekolah' };
  
  const { data } = await supabase.from(tableMap[tab]).select('*').eq('id', id).single();
  if (data) {
    editingId = id;
    await injectFormFields("edit", data);
    document.getElementById("modal-overlay").classList.add("active");
  }
};

window.deleteData = async (tableType, id) => {
  // tableType dikirim string 'materi' atau 'achievement_sekolah' dari tombol delete
  if(!confirm("Hapus data ini?")) return;
  
  const { error } = await supabase.from(tableType).delete().eq('id', id);
  if(!error) loadData();
  else alert("Gagal hapus: " + error.message);
};

// Form Submit
const formEl = document.getElementById("dynamic-form");
if(formEl) {
    formEl.addEventListener("submit", async (e) => {
      e.preventDefault();
      const tableMap = { materi: 'materi', achievement: 'achievement_sekolah' };
      
      const payload = {};
      // Otomatis ambil value berdasarkan ID input (title, description, detail, etc)
      e.target.querySelectorAll("input, select, textarea").forEach(el => {
        if (el.id) payload[el.id] = el.value;
      });

      const { error } = editingId 
        ? await supabase.from(tableMap[currentTab]).update(payload).eq('id', editingId)
        : await supabase.from(tableMap[currentTab]).insert([payload]);

      if(!error) {
        document.getElementById("modal-overlay").classList.remove("active");
        loadData();
      } else {
        alert("Gagal simpan: " + error.message);
      }
    });
}

// FAB & Modal Listeners
const fab = document.getElementById("fab-add");
if(fab) {
    fab.addEventListener("click", async () => {
      editingId = null;
      await injectFormFields("add");
      document.getElementById("modal-overlay").classList.add("active");
    });
}

const closeBtn = document.getElementById("modal-close");
if(closeBtn) {
    closeBtn.addEventListener("click", () => {
      document.getElementById("modal-overlay").classList.remove("active");
    });
}