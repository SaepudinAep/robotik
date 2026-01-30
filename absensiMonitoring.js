import { supabase } from './config.js';

// =========================================
// 1. STATE & KONFIGURASI
// =========================================
const classId = localStorage.getItem("activePrivateClassId");
const levelId = localStorage.getItem("activeLevelId");
const levelKode = localStorage.getItem("activeLevelKode") || "--";

// State Global
let currentSessionId = null;     
let sessionTargets = []; // Staging Array: {id, main, sub, tempId}
let studentList = [];
let attendanceMap = {}; 
let achievementScoreMap = {}; // Map untuk nilai bintang: "studentId_achId" => score

// =========================================
// 2. INITIALIZATION
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    if (!classId) {
        alert("⚠️ Error: ID Kelas tidak ditemukan.");
        return window.location.href = 'absensi_private.html';
    }
    
    // Set Header Info
    const titleEl = document.getElementById('headerClassName');
    let name = localStorage.getItem("activeClassName") || "";
    if(titleEl) titleEl.innerText = ` - ${name}`;
    
    updateHeaderInfo(`Level: ${levelKode}`, "BARU");
    document.getElementById('tglPertemuan').valueAsDate = new Date();

    // Load Data Penting secara Paralel
    await Promise.all([fetchTeachers(), fetchStudents(), loadHistory()]);
    
    setupEventListeners();
}

function updateHeaderInfo(subTitle, statusTag, isSaved = false) {
    const lvlDisplay = document.getElementById('levelDisplay');
    if(lvlDisplay) lvlDisplay.innerText = subTitle;
    
    const tag = document.getElementById('sessionTag');
    if(tag) {
        tag.innerText = isSaved ? levelKode : "BARU";
        tag.style.color = isSaved ? "#ffeb3b" : "#fff";
    }
}

function unlockInterface() {
    document.getElementById('targetSection').classList.remove('locked-area');
    document.getElementById('monitoringSection').style.display = 'block';
    
    const btn = document.getElementById('btnSimpanSesi');
    if(btn) {
        btn.innerHTML = `<i class="fa-solid fa-check"></i> SESI AKTIF`;
        btn.style.background = "#2ecc71";
    }
}

// =========================================
// 3. SMART INPUT LOGIC (MAIN SEARCH & SUB DROPDOWN)
// =========================================

// A. Handle Ketik di Search Box (Main Achievement)
async function handleSearchMain(e) {
    const keyword = e.target.value;
    const box = document.getElementById('achSuggestionBox');
    
    if (keyword.length < 2) { 
        box.style.display = 'none'; 
        return; 
    }

    // Cari Topik Unik di Database
    const { data } = await supabase.from('achievement_private')
        .select('main_achievement')
        .eq('level_id', levelId)
        .ilike('main_achievement', `%${keyword}%`)
        .limit(10);

    if (data && data.length > 0) {
        // Filter unik (karena database mungkin ada duplikat main)
        const uniqueMain = [...new Set(data.map(i => i.main_achievement))];
        
        box.innerHTML = uniqueMain.map(m => 
            `<div class="suggestion-item" onclick="selectMainAch('${m}')">
                <i class="fa-solid fa-tag" style="color:#ccc; margin-right:5px;"></i> ${m}
             </div>`
        ).join('');
        box.style.display = 'block';
    } else {
        box.style.display = 'none';
    }
}

// B. Saat Topik Dipilih
window.selectMainAch = async (mainText) => {
    document.getElementById('mainAchSearch').value = mainText;
    document.getElementById('achSuggestionBox').style.display = 'none';
    
    // Otomatis cari rinciannya (Sub)
    await fetchSubAchievements(mainText);
};

// C. Ambil Sub Achievement (Rincian) -> LOGIK SPLIT STRING BARU
async function fetchSubAchievements(mainText) {
    const container = document.getElementById('subAchContainer');
    const select = document.getElementById('subAchSelect');
    const manualInp = document.getElementById('subAchManual');
    
    // Reset UI
    container.style.display = 'block';
    select.innerHTML = `<option value="">🔍 Mencari rincian...</option>`;
    select.disabled = false;
    manualInp.style.display = 'none';

    try {
        // 1. Cari Induk berdasarkan Main & Level
        let { data } = await supabase.from('achievement_private')
            .select('sub_achievement')
            .eq('level_id', levelId)
            .eq('main_achievement', mainText)
            .maybeSingle();

        // 2. Fallback: Jika di level ini kosong, cari di level lain (Global Shared)
        if (!data) {
            const { data: dataLoose } = await supabase.from('achievement_private')
                .select('sub_achievement')
                .eq('main_achievement', mainText)
                .limit(1)
                .maybeSingle();
            if (dataLoose) data = dataLoose;
        }

        // 3. Render Dropdown dengan Split '\n'
        let html = `<option value="">-- Pilih Rincian Target --</option>`;
        let hasOptions = false;

        if (data && data.sub_achievement) {
            // INI KUNCINYA: Pecah string berdasarkan Enter (\n)
            const rawSubs = data.sub_achievement.split('\n');
            const cleanSubs = rawSubs.map(s => s.trim()).filter(s => s !== "");
            
            if (cleanSubs.length > 0) {
                // Hapus duplikat opsi jika ada
                const uniqueSubs = [...new Set(cleanSubs)];
                // Render opsi manual string (Aman untuk Android)
                html += uniqueSubs.map(s => `<option value="${s}">${s}</option>`).join('');
                hasOptions = true;
            }
        }

        if (hasOptions) {
            select.innerHTML = html;
        } else {
            // Jika kosong/baru, paksa mode input manual
            select.innerHTML = `<option value="">(Belum ada rincian database)</option>`;
            select.disabled = true;
            manualInp.style.display = 'block';
            manualInp.placeholder = "Data kosong, ketik rincian baru...";
            manualInp.focus();
        }

    } catch (err) {
        console.error("Error fetch sub:", err);
        select.innerHTML = `<option value="">Error memuat data</option>`;
    }
}

// D. Toggle Input Manual (Jika tidak ada di dropdown)
window.toggleManualSub = () => {
    const manualInp = document.getElementById('subAchManual');
    const select = document.getElementById('subAchSelect');
    
    if (manualInp.style.display === 'none') {
        manualInp.style.display = 'block';
        select.disabled = true;
        manualInp.focus();
    } else {
        manualInp.style.display = 'none';
        select.disabled = false;
        manualInp.value = '';
    }
};

// E. Masukkan ke Keranjang (Drafting)
window.addAchievementToDraft = () => {
    const main = document.getElementById('mainAchSearch').value.trim();
    let sub = document.getElementById('subAchSelect').value;
    const manualSub = document.getElementById('subAchManual').value.trim();
    
    // Jika mode manual aktif, pakai nilai manual
    if (document.getElementById('subAchManual').style.display !== 'none' && manualSub) {
        sub = manualSub;
    }

    if (!main || !sub) return alert("⚠️ Mohon lengkapi Topik (Main) dan Rincian (Sub)!");

    // Cek duplikat di keranjang lokal
    const exists = sessionTargets.some(t => t.main === main && t.sub === sub);
    if (exists) return alert("⚠️ Target ini sudah ada di daftar.");

    // Push ke Array
    sessionTargets.push({
        id: null, // null artinya belum disimpan ke DB
        main: main,
        sub: sub,
        tempId: Date.now() // ID unik sementara untuk hapus draft
    });

    renderTargetListUI();
    
    // Reset bagian Sub saja
    document.getElementById('subAchSelect').value = "";
    document.getElementById('subAchManual').value = "";
};

// =========================================
// 4. DATABASE LOGIC (MANUAL CHECK - AMAN DARI ERROR)
// =========================================

// A. SIMPAN SESI
async function savePertemuan() {
    const tgl = document.getElementById('tglPertemuan').value;
    const guru = document.getElementById('pilihGuru').value;
    const materi = document.getElementById('materiUtama').value;

    if(!tgl || !materi) return alert("⚠️ Mohon isi Tanggal dan Judul Materi!");

    const btn = document.getElementById('btnSimpanSesi');
    btn.innerHTML = "⏳ Proses..."; btn.disabled = true;

    try {
        let materiId = null;
        
        // 1. Cek Materi
        const { data: existM } = await supabase.from('materi_private')
            .select('id').eq('judul', materi).eq('level_id', levelId).maybeSingle();
        
        if (existM) {
            materiId = existM.id;
        } else {
            const { data: newM } = await supabase.from('materi_private')
                .insert({ judul: materi, level_id: levelId }).select('id').single();
            materiId = newM.id;
        }

        // 2. Cek Pertemuan
        let sesiId = currentSessionId;
        if (!sesiId) {
            const { data: existS } = await supabase.from('pertemuan_private')
                .select('id').eq('class_id', classId).eq('tanggal', tgl).maybeSingle();
            if (existS) sesiId = existS.id;
        }

        const payload = { 
            class_id: classId, 
            tanggal: tgl, 
            teacher_id: guru || null, 
            materi_id: materiId 
        };
        
        if (sesiId) {
            await supabase.from('pertemuan_private').update(payload).eq('id', sesiId);
            currentSessionId = sesiId;
        } else {
            const { data: newS } = await supabase.from('pertemuan_private')
                .insert(payload).select('id').single();
            currentSessionId = newS.id;
        }

        unlockInterface();
        updateHeaderInfo("AKTIF", "Saved", true);
        loadHistory(); 

    } catch (e) { 
        alert("❌ Error Sesi: " + e.message); 
    } finally { 
        btn.innerHTML = '<i class="fa-solid fa-check"></i> SESI AKTIF'; 
        btn.disabled = false; 
    }
}

// B. SIMPAN TARGET (LOGIK INDUK SEMANG / SOFT LINK)
async function saveTargetAch() {
    if (!currentSessionId) return alert("⚠️ Mulai sesi dulu!");
    if (sessionTargets.length === 0) return alert("⚠️ Draft kosong!");

    const btn = document.getElementById('btnSimpanTarget');
    btn.innerHTML = "⏳ Menyimpan..."; btn.disabled = true;

    try {
        for (let i = 0; i < sessionTargets.length; i++) {
            let t = sessionTargets[i];
            
            // Skip jika sudah tersimpan
            if (t.id) continue; 

            let achId = null;
            
            // 1. CARI HANYA BERDASARKAN MAIN ACHIEVEMENT (INDUK)
            const { data: existParent } = await supabase.from('achievement_private')
                .select('id')
                .eq('main_achievement', t.main)
                .eq('level_id', levelId)
                .maybeSingle();
            
            if (existParent) {
                // KETEMU! Pakai ID Induk yang sudah ada.
                achId = existParent.id;
            } else {
                // Main benar-benar baru, buat Induk Baru.
                // Simpan sub pertama sebagai inisiasi data master
                const { data: newAch } = await supabase.from('achievement_private')
                    .insert({ 
                        main_achievement: t.main, 
                        sub_achievement: t.sub, 
                        level_id: levelId 
                    })
                    .select('id').single();
                achId = newAch.id;
            }

            // 2. SIMPAN LINK KE SESI (Simpan sub di kolom 'catatan')
            // Cek agar tidak double insert persis sama di sesi ini
            const { data: existLink } = await supabase.from('achievement_target')
                .select('id')
                .eq('pertemuan_id', currentSessionId)
                .eq('achievement_id', achId)
                .eq('catatan', t.sub) // Cek juga catatannya
                .maybeSingle();

            if (!existLink) {
                await supabase.from('achievement_target')
                    .insert({ 
                        pertemuan_id: currentSessionId, 
                        achievement_id: achId, 
                        catatan: t.sub // <--- Sub disimpan disini (Soft Link)
                    });
            }

            // Update state lokal
            sessionTargets[i].id = achId;
        }

        alert("✅ Target Tersimpan!");
        
        // UI Persistence
        document.getElementById('formInputTarget').style.display = 'none';
        document.getElementById('btnSimpanTarget').style.display = 'none';
        document.getElementById('btnTambahLagi').style.display = 'block';

        renderTargetListUI();
        renderStudentCards();

    } catch (e) { 
        alert("❌ Error Target: " + e.message); 
    } finally { 
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> SIMPAN TARGET KE DATABASE'; 
        btn.disabled = false; 
    }
}

// =========================================
// 5. RENDER UI (ANDROID SAFE)
// =========================================

function renderTargetListUI() {
    const list = document.getElementById('targetList');
    const btnSimpan = document.getElementById('btnSimpanTarget');
    
    list.innerHTML = "";
    
    // Tampilkan tombol simpan HANYA jika ada draft yang belum saved
    const hasDraft = sessionTargets.some(t => t.id === null);
    if(document.getElementById('formInputTarget').style.display !== 'none') {
        btnSimpan.style.display = hasDraft ? 'block' : 'none';
    }

    if (sessionTargets.length === 0) {
        list.innerHTML = `<div style="text-align:center; color:#999; padding:10px;">Keranjang kosong</div>`;
        return;
    }

    sessionTargets.forEach((t, idx) => {
        const isSaved = t.id !== null;
        const color = isSaved ? '#e8f5e9' : '#fff3e0';
        const icon = isSaved ? '<i class="fa-solid fa-check-circle" style="color:green"></i>' : '<i class="fa-solid fa-hourglass-half" style="color:orange"></i>';
        
        const delBtn = isSaved ? '' : `<i class="fa-solid fa-trash-can" onclick="removeTarget(${idx})" style="color:red; cursor:pointer; margin-left:10px;"></i>`;

        list.innerHTML += `
            <div style="background:${color}; padding:10px; border-radius:5px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center; border:1px solid #ddd;">
                <div>
                    <div style="font-weight:bold; font-size:0.85rem; color:#333;">${t.main}</div>
                    <div style="font-size:0.8rem; color:#666;">${t.sub}</div>
                </div>
                <div style="display:flex; align-items:center;">
                    ${icon} ${delBtn}
                </div>
            </div>
        `;
    });
}

function renderStudentCards() {
    const container = document.getElementById('studentContainer');
    container.innerHTML = "";

    if (studentList.length === 0) return container.innerHTML = "<p style='text-align:center; padding:20px;'>Belum ada siswa di kelas ini.</p>";

    studentList.forEach(s => {
        const att = attendanceMap[s.id] || {};
        const sikapVal = att.sikap ? String(att.sikap) : "3";
        const fokusVal = att.fokus ? String(att.fokus) : "2";
        const border = att.sikap ? "5px solid #2ecc71" : "1px solid #ddd";

       const htmlSikap = `
            <option value="5" ${sikapVal==="5"?"selected":""}> (5) Sangat Baik</option>
            <option value="4" ${sikapVal==="4"?"selected":""}> (4) Baik</option>
            <option value="3" ${sikapVal==="3"?"selected":""}> (3) Cukup</option>
            <option value="2" ${sikapVal==="2"?"selected":""}> (2) Kurang</option>
            <option value="1" ${sikapVal==="1"?"selected":""}> (1) Buruk</option>
        `;
        
        const htmlFokus = `
            <option value="3" ${fokusVal==="3"?"selected":""}> (3) Fokus Penuh</option>
            <option value="2" ${fokusVal==="2"?"selected":""}> (2) Biasa</option>
            <option value="1" ${fokusVal==="1"?"selected":""}> (1) Tidak Fokus</option>
        `;

        let starsHTML = "";
        const savedTargets = sessionTargets.filter(t => t.id);
        
        if (savedTargets.length > 0) {
            starsHTML = savedTargets.map(t => {
                const key = `${s.id}_${t.id}`;
                const score = achievementScoreMap[key] || 0;
                
                let stars = "";
                for(let n=1; n<=5; n++) {
                    const color = n <= score ? "#f1c40f" : "#ddd";
                    stars += `<i class="fa-solid fa-star" style="color:${color}; font-size:1.2rem; cursor:pointer; margin-right:4px;" onclick="setStar(this, ${n})"></i>`;
                }

                return `
                <div class="star-row" data-sid="${s.id}" data-aid="${t.id}" data-score="${score}" style="margin-bottom:12px; border-bottom:1px dashed #eee; padding-bottom:5px;">
                    <div style="font-size:0.8rem; font-weight:bold; margin-bottom:4px; color:#444;">${t.main} - ${t.sub}</div>
                    <div>${stars}</div>
                </div>`;
            }).join("");
        } else {
            starsHTML = `<div style="text-align:center; color:#999; font-size:0.8rem; padding:10px; background:#f9f9f9; border-radius:4px;">
                <i class="fa-solid fa-arrow-up"></i> Simpan target di atas untuk mulai menilai
            </div>`;
        }

        container.innerHTML += `
            <div class="student-card" style="border-left:${border}; background:white; padding:15px; margin-bottom:15px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                <div style="font-weight:bold; font-size:1.1rem; margin-bottom:15px; color:#2c3e50;">
                    <i class="fa-solid fa-user-graduate"></i> ${s.name}
                </div>
                
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                    <div style="flex:1;">
                        <label style="font-size:0.75rem; font-weight:bold; color:#666;">SIKAP</label>
                        <select id="sikap_${s.id}" class="android-safe">${htmlSikap}</select>
                    </div>
                    <div style="flex:1;">
                        <label style="font-size:0.75rem; font-weight:bold; color:#666;">FOKUS</label>
                        <select id="fokus_${s.id}" class="android-safe">${htmlFokus}</select>
                    </div>
                </div>

                <div id="stars_${s.id}" style="margin-bottom:15px;">${starsHTML}</div>
                
                <textarea id="cat_${s.id}" rows="2" placeholder="Tulis catatan perkembangan..." style="width:100%; border:1px solid #ccc; padding:8px; border-radius:4px; font-family:inherit;">${att.catatan || ""}</textarea>
                
                <button onclick="saveMonitoring('${s.id}')" style="width:100%; background:#2196F3; color:white; border:none; padding:12px; margin-top:10px; border-radius:4px; font-weight:bold; cursor:pointer;">
                    <i class="fa-solid fa-floppy-disk"></i> SIMPAN NILAI SISWA
                </button>
            </div>
        `;
    });
}

// Helper Set Bintang (Visual Only)
window.setStar = (el, n) => {
    const row = el.parentElement.parentElement;
    row.setAttribute('data-score', n);
    
    // Visual update instan tanpa reload
    const stars = el.parentElement.children;
    for(let i=0; i<5; i++) {
        stars[i].style.color = (i < n) ? "#f1c40f" : "#ddd";
    }
};

// Remove Draft Target
window.removeTarget = (i) => {
    sessionTargets.splice(i, 1);
    renderTargetListUI();
};

// =========================================
// 6. SAVE NILAI INDIVIDUAL (MANUAL CHECK)
// =========================================
window.saveMonitoring = async (sId) => {
    if (!currentSessionId) return alert("⚠️ Sesi belum aktif!");
    
    const btn = document.activeElement;
    const oriText = btn ? btn.innerHTML : "SIMPAN";
    if(btn) btn.innerHTML = "...";
    
    try {
        const sikap = document.getElementById(`sikap_${sId}`).value;
        const fokus = document.getElementById(`fokus_${sId}`).value;
        const cat = document.getElementById(`cat_${sId}`).value;

        // 1. Simpan Absen (Manual Check)
        const { data: exist } = await supabase.from('attendance_private').select('id')
            .eq('pertemuan_id', currentSessionId).eq('student_id', sId).maybeSingle();
        
        const payload = { pertemuan_id: currentSessionId, student_id: sId, sikap: sikap, fokus: fokus, catatan: cat };
        
        if (exist) await supabase.from('attendance_private').update(payload).eq('id', exist.id);
        else await supabase.from('attendance_private').insert(payload);

        // 2. Simpan Bintang (Achievement)
        const rows = document.querySelectorAll(`#stars_${sId} .star-row`);
        for (const row of rows) {
            const achId = row.dataset.aid;
            const score = row.dataset.score;
            if (!achId) continue;

            const { data: existStar } = await supabase.from('achievement_pertemuan').select('id')
                .eq('pertemuan_id', currentSessionId).eq('student_id', sId).eq('achievement_id', achId).maybeSingle();
            
            if (existStar) {
                await supabase.from('achievement_pertemuan').update({ indikator: score }).eq('id', existStar.id);
            } else {
                await supabase.from('achievement_pertemuan').insert({ 
                    pertemuan_id: currentSessionId, student_id: sId, achievement_id: achId, indikator: score 
                });
            }
            
            // Update Map Lokal
            achievementScoreMap[`${sId}_${achId}`] = score;
        }

        attendanceMap[sId] = { sikap, fokus, catatan: cat };
        alert("✅ Data Tersimpan!");

    } catch (e) { alert("Error Save: " + e.message); }
    finally { if(btn) btn.innerHTML = oriText; }
};

// =========================================
// 7. FETCH HELPERS & HISTORY REHYDRATION
// =========================================
async function fetchStudents() {
    const { data } = await supabase.from('students_private').select('*').eq('class_id', classId).order('name');
    studentList = data || [];
}

async function fetchTeachers() {
    const { data } = await supabase.from('teachers').select('*').order('name');
    const sel = document.getElementById('pilihGuru');
    if (data) sel.innerHTML = `<option value="">Pilih Guru Pengajar</option>` + data.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
}

async function loadHistory() {
    // Ambil 5 pertemuan terakhir
    const { data } = await supabase.from('pertemuan_private')
        .select('id, tanggal, materi_private(judul)')
        .eq('class_id', classId)
        .order('tanggal', {ascending:false})
        .limit(5);
    
    const grid = document.getElementById('historyGrid');
    if(grid && data) {
        grid.innerHTML = data.map(d => `
            <div onclick="openSession('${d.id}')" style="background:white; padding:12px; border-left:5px solid #2ecc71; margin-bottom:8px; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.1); border-radius:4px;">
                <div style="font-weight:bold; color:#333;">${new Date(d.tanggal).toLocaleDateString('id-ID', {weekday:'short', day:'numeric', month:'short'})}</div>
                <div style="color:#666; font-size:0.9rem;">${d.materi_private?.judul || "Tanpa Judul"}</div>
            </div>
        `).join('');
    } else if (grid) {
        grid.innerHTML = "<p style='color:#999; font-style:italic;'>Belum ada riwayat pertemuan.</p>";
    }
}

window.openSession = async (sessId) => {
    if(!confirm("Buka dan edit sesi ini?")) return;
    
    // Reset State
    sessionTargets = [];
    attendanceMap = {};
    achievementScoreMap = {};

    const { data } = await supabase.from('pertemuan_private')
        .select('*, materi_private(judul)')
        .eq('id', sessId)
        .single();
        
    if(data) {
        currentSessionId = data.id;
        document.getElementById('tglPertemuan').value = data.tanggal;
        document.getElementById('materiUtama').value = data.materi_private?.judul || "";
        if(data.teacher_id) document.getElementById('pilihGuru').value = data.teacher_id;
        
        unlockInterface();
        updateHeaderInfo(data.materi_private?.judul, "EDIT", true);
        
        // 1. Fetch Targets & Fix Label Issue
        const { data: targets } = await supabase.from('achievement_target')
            .select('achievement_id, catatan, achievement_private(main_achievement, sub_achievement)')
            .eq('pertemuan_id', sessId);
            
        if (targets) {
            sessionTargets = targets.map(t => ({
                id: t.achievement_id,
                main: t.achievement_private?.main_achievement || "Topik",
                // FALLBACK LOGIC: Jika catatan ada pakai itu, jika tidak pakai master
                sub: t.catatan || t.achievement_private?.sub_achievement 
            }));
        }
        
        // 2. Fetch Absensi
        const { data: att } = await supabase.from('attendance_private').select('*').eq('pertemuan_id', sessId);
        if (att) att.forEach(a => attendanceMap[a.student_id] = a);

        // 3. Fetch Scores
        const { data: scores } = await supabase.from('achievement_pertemuan').select('*').eq('pertemuan_id', sessId);
        if (scores) scores.forEach(s => achievementScoreMap[`${s.student_id}_${s.achievement_id}`] = s.indikator);

        // 4. UI Adjustments
        document.getElementById('formInputTarget').style.display = 'none';
        document.getElementById('btnSimpanTarget').style.display = 'none';
        document.getElementById('btnTambahLagi').style.display = 'block';

        renderTargetListUI();
        renderStudentCards();
        
        // Scroll to top
        window.scrollTo({top: 0, behavior: 'smooth'});
    }
};

// =========================================
// 8. SETUP LISTENERS
// =========================================
function setupEventListeners() {
    document.getElementById('mainAchSearch').addEventListener('input', handleSearchMain);
    document.getElementById('btnAddAch').onclick = addAchievementToDraft;
    document.getElementById('btnSimpanSesi').onclick = savePertemuan;
    document.getElementById('btnSimpanTarget').onclick = saveTargetAch;
    
    // UI Persistence Handler
    document.getElementById('btnTambahLagi').onclick = () => {
        document.getElementById('formInputTarget').style.display = 'block';
        document.getElementById('btnSimpanTarget').style.display = 'block';
        document.getElementById('btnTambahLagi').style.display = 'none';
    };
}