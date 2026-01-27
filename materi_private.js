import { supabase, cloudinaryConfig } from "./config.js";

let currentTab = "materi"; 
let editingId = null;

// =========================================
//   SEKTOR 0: CLOUDINARY LOGIC
// =========================================
function openUploadWidget(callback, customFolder = "robotic") {
  // Cek config
  if (!cloudinaryConfig.cloudName) {
    alert("Config Error"); 
    return; 
  }

  window.cloudinary.openUploadWidget({
    // 1. Identitas
    cloudName: cloudinaryConfig.cloudName,
    uploadPreset: cloudinaryConfig.uploadPreset,
    folder: customFolder,
    
    // 2. Logic Cropping (Sederhana tapi Tegas)
    sources: ["local", "camera"], // Hapus 'url' untuk meminimalisir lag
    multiple: false,
    cropping: true,
    croppingAspectRatio: 0.75, // 3:4 Portrait
    
    // 3. UI Settings (HAPUS validasi size/format disini sementara)
    showSkipCropButton: false,
    croppingShowBackButton: true, // Nyalakan agar user merasa punya kontrol
    
  }, (error, result) => {
    
    if (error) {
      console.log("Error:", error);
      return;
    }

    // Tangkap Event Success
    if (result.event === "success") {
      console.log("Raw Result:", result);

      // Ambil kordinat manual (jika ada)
      const coords = result.info.coordinates;
      let transformation = "";

      // LOGIKA PENYELAMAT:
      // Jika widget mengirim koordinat crop manual, kita PAKAI.
      // Jika tidak, kita pakai c_fill standar.
      if (coords && coords.custom && coords.custom[0]) {
        const c = coords.custom[0];
        // Format manual crop: x_100,y_50,w_300,h_400,c_crop
        transformation = `x_${c[0]},y_${c[1]},w_${c[2]},h_${c[3]},c_crop`;
      } else {
        // Fallback jika crop gagal terdeteksi
        transformation = "c_fill,ar_3:4,g_custom";
      }

      // Gabungkan URL
      // Urutan: /upload/ [CROP MANUAL] / [OPTIMASI] / namafile
      const finalUrl = result.info.secure_url.replace(
        "/upload/", 
        `/upload/${transformation}/f_auto,q_auto/`
      );

      console.log("Final URL:", finalUrl);
      callback(finalUrl);
    }
  });
}
// =========================================
//   INITIALIZATION & TABS
// =========================================
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
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
//   LOAD & RENDER DATA (WITH STATUS DOTS)
// =========================================
async function loadData() {
  const search = document.getElementById("globalSearch").value.toLowerCase();

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

// --- Render Guru dengan tombol Edit & Hapus ---
function renderGuru(data) {
  const container = document.getElementById("guru-list");
  container.innerHTML = data.map(g => `
    <div class="compact-item" onclick="openEditModal('guru', '${g.id}')">
      <div class="item-info">
        <i class="fas fa-user-tie" style="color: #3498db; margin-right: 12px;"></i>
        <span class="item-title"><b>${g.name}</b> (${g.role.toUpperCase()})</span>
      </div>
      <div class="item-actions">
        <button class="btn-minimal"><i class="fas fa-pen-to-square"></i></button>
        <button class="btn-minimal text-danger" onclick="event.stopPropagation(); deleteData('guru', '${g.id}')">
          <i class="fas fa-trash-can"></i>
        </button>
      </div>
    </div>`).join("");
}

// --- Render Levels dengan tombol Edit & Hapus ---
function renderLevels(data) {
  const container = document.getElementById("levels-list");
  container.innerHTML = data.map(l => `
    <div class="compact-item" onclick="openEditModal('levels', '${l.id}')">
      <div class="item-info">
        <span class="badge" style="background:#eee; color:#333; font-size:0.7rem; padding:2px 6px; border-radius:5px; margin-right:10px;">${l.kode}</span>
        <span class="item-title">${l.detail || '-'}</span>
      </div>
      <div class="item-actions">
        <button class="btn-minimal"><i class="fas fa-pen-to-square"></i></button>
        <button class="btn-minimal text-danger" onclick="event.stopPropagation(); deleteData('levels', '${l.id}')">
          <i class="fas fa-trash-can"></i>
        </button>
      </div>
    </div>`).join("");
}

// --- Render Materi dengan Indikator Status & Tombol Lengkap ---
function renderMateri(data) {
  const container = document.getElementById("materi-list");
  container.innerHTML = data.map(m => {
    const score = [m.judul, m.level_id, m.deskripsi, m.image_url].filter(Boolean).length;
    let statusColor = "#e67e22"; 
    if (score === 4) statusColor = "#2ecc71";
    else if (score >= 2) statusColor = "#f1c40f";

    return `
      <div class="compact-item" onclick="openEditModal('materi', '${m.id}')">
        <div class="item-info">
          <i class="fas fa-circle" style="color: ${statusColor}; font-size: 14px; margin-right: 15px;"></i>
          <span class="item-title"><b>[${m.levels?.kode || '?'}]</b> ${m.judul}</span>
        </div>
        <div class="item-actions">
          <button class="btn-minimal"><i class="fas fa-pen-to-square"></i></button>
          <button class="btn-minimal text-danger" onclick="event.stopPropagation(); deleteData('materi', '${m.id}')">
            <i class="fas fa-trash-can"></i>
          </button>
        </div>
      </div>`;
  }).join("");
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
        <span><i class="fas fa-folder-open" style="color: #f1c40f; margin-right: 10px;"></i> <b>LEVEL ${level}</b></span>
      </div>
      <div class="folder-content">
        ${grouped[level].map(a => `
          <div class="target-item">
            <span><b>${a.main_achievement}:</b> ${a.sub_achievement}</span>
            <button class="btn-minimal" onclick="event.stopPropagation(); deleteData('achievement', '${a.id}')">
              <i class="fas fa-trash-can" style="color: #e74c3c;"></i>
            </button>
          </div>
        `).join("")}
      </div>
    </div>`).join("");
}

// =========================================
//   MODAL & FORM INJECTION
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
    const { data: lvData } = await supabase.from('levels').select('id, kode').order('kode');
    const options = lvData.map(l => `<option value="${l.id}" ${data.level_id === l.id ? "selected" : ""}>${l.kode}</option>`).join("");
    
    if (currentTab === "materi") {
      const currentImg = data.image_url || "https://via.placeholder.com/150?text=No+Image";
      
      formFields.innerHTML = `
        <label>Pilih Level</label><select id="level_id">${options}</select>
        <label>Judul Materi</label><input type="text" id="judul" value="${data.judul || ""}" required>
        
        <label>Foto Project (Cloudinary)</label>
        <div style="margin-bottom: 20px;">
          <button type="button" id="btn-upload-p" style="background:#2ecc71; color:white; border:none; padding:12px; border-radius:12px; cursor:pointer; width:100%; margin-bottom:10px; font-weight:bold;">
            <i class="fas fa-camera" style="margin-right:8px;"></i> Upload Foto Robot
          </button>
          <input type="hidden" id="image_url" value="${data.image_url || ""}">
          <div style="text-align:center;">
            <img id="img-preview-p" src="${currentImg}" style="width:100%; max-height:180px; object-fit:cover; border-radius:15px; border:2px solid #eee;">
          </div>
        </div>

        <label>Deskripsi</label><textarea id="deskripsi">${data.deskripsi || ""}</textarea>`;

      document.getElementById("btn-upload-p").onclick = () => {
        openUploadWidget((url) => {
          document.getElementById("image_url").value = url;
          document.getElementById("img-preview-p").src = url;
        });
      };
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
//   ACTIONS (CRUD)
// =========================================
window.openEditModal = async (type, id) => {
  const tableMap = { levels: 'levels', materi: 'materi_private', achievement: 'achievement_private', guru: 'teachers' };
  const { data } = await supabase.from(tableMap[type]).select('*').eq('id', id).single();
  if (data) {
    editingId = id;
    await injectFormFields("edit", data);
    document.getElementById("modal-overlay").classList.add("active");
  }
};

window.deleteData = async (type, id) => {
  if(!confirm("Hapus data dari matrix?")) return;
  const tableMap = { levels: 'levels', materi: 'materi_private', achievement: 'achievement_private', guru: 'teachers' };
  const { error } = await supabase.from(tableMap[type]).delete().eq('id', id);
  if(!error) loadData();
};

document.getElementById("dynamic-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const tableMap = { levels: 'levels', materi: 'materi_private', achievement: 'achievement_private', guru: 'teachers' };
  const payload = {};
  e.target.querySelectorAll("input, select, textarea").forEach(el => {
    if (el.id) payload[el.id] = el.value;
  });

  const { error } = editingId 
    ? await supabase.from(tableMap[currentTab]).update(payload).eq('id', editingId)
    : await supabase.from(tableMap[currentTab]).insert([payload]);

  if(!error) {
    document.getElementById("modal-overlay").classList.remove("active");
    loadData();
  } else alert(error.message);
});

document.getElementById("fab-add").addEventListener("click", async () => {
  editingId = null;
  await injectFormFields("add");
  document.getElementById("modal-overlay").classList.add("active");
});

document.getElementById("modal-close").addEventListener("click", () => document.getElementById("modal-overlay").classList.remove("active"));
document.getElementById("globalSearch").addEventListener("input", loadData);