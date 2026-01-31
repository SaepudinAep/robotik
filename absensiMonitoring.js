import { supabase } from './config.js';

// =========================================
// 1. STATE & KONFIGURASI
// =========================================
const classId = localStorage.getItem("activePrivateClassId");
const levelId = localStorage.getItem("activeLevelId");
const levelKode = localStorage.getItem("activeLevelKode") || "--";

// State Global
let currentSessionId = null;     
let sessionTargets = []; 
let studentList = [];
let attendanceMap = {}; 
let achievementScoreMap = {}; 

// State Smart Input
let selectedMainAch = null;
let debounceTimer = null;

// =========================================
// 2. HELPER FUNCTIONS (VISUAL & UTILS)
// =========================================

function escapeHtml(text) {
    if(!text) return "";
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Visual Update: 3 Level Trophy
function updateIconVisual(el, score) {
    if(!el) return;
    const row = el.parentElement.parentElement;
    const label = row.querySelector('.score-label');
    
    let color = "#e0e0e0"; // 0
    let text = "Belum";
    
    if (score === 1) { color = "#cd7f32"; text = "Cukup"; }       // Bronze
    else if (score === 2) { color = "#95a5a6"; text = "Baik"; }   // Silver
    else if (score === 3) { color = "#f1c40f"; text = "Mahir"; }  // Gold
    
    el.style.color = color;
    el.style.transform = "scale(1.2)";
    setTimeout(() => el.style.transform = "scale(1)", 200);
    
    if(label) {
        label.innerText = text;
        label.style.color = (score > 0) ? color : "#999";
        label.style.fontWeight = (score > 0) ? "bold" : "normal";
    }
}

// Global Toggle Function
window.toggleAchievement = (el) => {
    const row = el.parentElement.parentElement;
    let score = parseInt(row.getAttribute('data-score') || "0");
    score = (score + 1) % 4; 
    row.setAttribute('data-score', score);
    updateIconVisual(el, score);
};

// Toggle Input Manual vs Dropdown
window.toggleManualSub = () => {
    const dropdown = document.getElementById('subAchSelect');
    const manual = document.getElementById('subAchManual');
    const btn = document.getElementById('btnToggleManual');
    
    if (manual.style.display === 'none') {
        dropdown.style.display = 'none';
        manual.style.display = 'block';
        if(btn) btn.innerHTML = '<i class="fa-solid fa-list"></i> Pilih List';
        manual.focus();
    } else {
        dropdown.style.display = 'block';
        manual.style.display = 'none';
        if(btn) btn.innerHTML = '<i class="fa-solid fa-keyboard"></i> Manual';
    }
};

// =========================================
// 3. UI ACCORDION (ANTI-HILANG FIX)
// =========================================

function injectStyles() {
    // Cek agar tidak duplikat
    if(document.getElementById('accordionStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'accordionStyles';
    style.innerHTML = `
        .section-header-clickable {
            cursor: pointer;
            user-select: none;
            padding: 10px;
            border-radius: 8px;
            transition: background 0.2s;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .section-header-clickable:hover {
            background-color: rgba(0,0,0,0.03);
        }
    `;
    document.head.appendChild(style);
}

function setupCollapsibleSections() {
    const sections = ['setupSection', 'targetSection'];
    
    sections.forEach(id => {
        const sec = document.getElementById(id);
        if(!sec) return;
        
        // Cari Header H3 di mana pun posisinya dalam section
        const header = sec.querySelector('h3');
        
        if(header) {
            header.classList.add('section-header-clickable');
            
            // Tambah Icon Panah jika belum ada
            if(!header.querySelector('.fa-chevron-down')) {
                const icon = document.createElement('i');
                icon.className = "fa-solid fa-chevron-down transition-icon";
                icon.style.transition = "transform 0.3s";
                header.appendChild(icon);
            }

            // PERBAIKAN LOGIKA KLIK
            header.onclick = (e) => {
                if(['BUTTON', 'INPUT', 'SELECT'].includes(e.target.tagName)) return;
                
                // Toggle status (Buka <-> Tutup)
                const isCurrentlyClosed = sec.getAttribute('data-collapsed') === 'true';
                toggleSection(id, isCurrentlyClosed); 
            };
        }
    });
}

// LOGIKA UTAMA PERBAIKAN
function toggleSection(sectionId, shouldOpen) {
    const sec = document.getElementById(sectionId);
    if(!sec) return;

    const header = sec.querySelector('h3');
    const icon = header ? header.querySelector('.fa-chevron-down') : null;
    
    // Loop semua anak langsung dari section
    Array.from(sec.children).forEach(child => {
        
        // 🛡️ SECURITY CHECK 🛡️
        // Jangan sembunyikan jika child ini ADALAH header
        // ATAU jika child ini MEMBUNGKUS header (misal header ada dalam div row)
        if (child === header || child.contains(header)) return;

        if (shouldOpen) {
            // BUKA
            child.style.display = ''; 
        } else {
            // TUTUP
            child.style.display = 'none'; 
        }
    });

    // Update status atribut dan icon
    if(shouldOpen) {
        if(icon) icon.style.transform = 'rotate(0deg)';
        sec.setAttribute('data-collapsed', 'false');
        sec.style.opacity = '1';
    } else {
        if(icon) icon.style.transform = 'rotate(-90deg)';
        sec.setAttribute('data-collapsed', 'true');
    }
}

// Inject Tombol (RESET MODE Only)
function injectControlButtons() {
    const headerInfo = document.querySelector('.header-info') || document.querySelector('header'); 
    
    if(headerInfo && !document.getElementById('sessionControls')) {
        const div = document.createElement('div');
        div.id = "sessionControls";
        div.style.marginTop = "10px";
        div.style.display = "flex";
        div.style.gap = "8px";
        div.style.justifyContent = "center"; 
        
        div.innerHTML = `
            <button id="btnResetMode" onclick="resetToNewMode()" style="display:none; background:#607d8b; color:white; border:none; padding:6px 12px; border-radius:4px; font-size:0.8rem; cursor:pointer;">
                <i class="fa-solid fa-plus"></i> Mode Baru
            </button>
        `;
        headerInfo.appendChild(div);
    }
}

// =========================================
// 4. INITIALIZATION
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    if (!classId) {
        alert("⚠️ Error: ID Kelas tidak ditemukan.");
        return window.location.href = 'absensi_private.html';
    }
    
    injectStyles(); 
    injectControlButtons(); 
    setupCollapsibleSections(); // Aktifkan Accordion Aman

    // Set Header Info
    const titleEl = document.getElementById('headerClassName');
    if (titleEl) {
        let name = localStorage.getItem("activeClassName");
        if (!name) {
            try {
                const { data } = await supabase.from('class_private').select('name').eq('id', classId).single();
                if (data) { 
                    name = data.name; 
                    localStorage.setItem("activeClassName", name); 
                }
            } catch (e) { console.log("Gagal fetch nama kelas"); }
        }
        if (name) titleEl.innerText = ` - ${name}`;
    }

    updateHeaderInfo(`Level: ${levelKode}`, "Draft");
    const tglInput = document.getElementById('tglPertemuan');
    if(tglInput) tglInput.valueAsDate = new Date();

    await Promise.all([ fetchTeachers(), fetchStudents() ]);
    await loadHistory();   
    await loadLastSession(); 
    
    setupEventListeners();
}

function updateHeaderInfo(subTitle, statusTag, isSaved = false) {
    const lvlDisplay = document.getElementById('levelDisplay');
    const tag = document.getElementById('sessionTag');

    if (lvlDisplay) {
        lvlDisplay.innerText = subTitle;
        lvlDisplay.style.color = isSaved ? "#ffeb3b" : "rgba(255,255,255,0.9)";
        lvlDisplay.style.fontWeight = isSaved ? "bold" : "normal";
    }
    if (tag) {
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
// 5. SESSION CONTROLS
// =========================================

window.resetToNewMode = () => {
    if(currentSessionId && !confirm("Kembali ke mode input baru?")) return;
    
    currentSessionId = null;
    sessionTargets = [];
    attendanceMap = {};
    achievementScoreMap = {};
    
    // UI Reset
    const tglInput = document.getElementById('tglPertemuan');
    if(tglInput) tglInput.valueAsDate = new Date();
    document.getElementById('materiUtama').value = "";
    document.getElementById('pilihGuru').value = "";
    
    const btnReset = document.getElementById('btnResetMode');
    if(btnReset) btnReset.style.display = 'none';
    
    const btnSimpan = document.getElementById('btnSimpanSesi');
    btnSimpan.innerHTML = '<i class="fa-solid fa-play"></i> MULAI SESI';
    btnSimpan.disabled = false;
    btnSimpan.style.background = ""; 
    
    // Reset Accordion State (Buka Semua)
    toggleSection('setupSection', true); 
    toggleSection('targetSection', true); 
    
    document.getElementById('targetSection').classList.add('locked-area');
    document.getElementById('monitoringSection').style.display = 'none';
    
    // Target UI Reset
    document.getElementById('formInputTarget').style.display = 'block';
    document.getElementById('btnSimpanTarget').style.display = 'none';
    document.getElementById('btnTambahLagi').style.display = 'none';

    renderTargetListUI();
    updateHeaderInfo(`Level: ${levelKode}`, "BARU");
};

// =========================================
// 6. DATABASE LOGIC
// =========================================

async function savePertemuan() {
    const tgl = document.getElementById('tglPertemuan').value;
    const guru = document.getElementById('pilihGuru').value; 
    const materiText = document.getElementById('materiUtama').value.trim();

    if (!tgl || !materiText) return alert("⚠️ Isi Tanggal & Judul Materi!");

    const btn = document.getElementById('btnSimpanSesi');
    btn.innerHTML = "⏳ Proses..."; btn.disabled = true;

    try {
        let materiId = null;
        
        const { data: existM } = await supabase.from('materi_private')
            .select('id').eq('judul', materiText).eq('level_id', levelId).maybeSingle();
        
        if (existM) {
            materiId = existM.id;
        } else {
            const { data: newM } = await supabase.from('materi_private')
                .insert({ judul: materiText, level_id: levelId }).select('id').single();
            materiId = newM.id;
        }

        const payload = { 
            class_id: classId, 
            tanggal: tgl, 
            teacher_id: guru || null, 
            materi_id: materiId 
        };
        
        if (currentSessionId) {
            await supabase.from('pertemuan_private').update(payload).eq('id', currentSessionId);
        } else {
            const { data: newS } = await supabase.from('pertemuan_private')
                .insert(payload).select('id').single();
            currentSessionId = newS.id;
        }

        unlockInterface();
        updateHeaderInfo("AKTIF", "Saved", true);
        
        // Auto Collapse Setup
        toggleSection('setupSection', false); 
        toggleSection('targetSection', true); 
        
        const btnReset = document.getElementById('btnResetMode');
        if(btnReset) btnReset.style.display = 'block';
        
        loadHistory(); 

    } catch (e) { 
        alert("❌ Error Sesi: " + e.message); 
    } finally { 
        btn.innerHTML = '<i class="fa-solid fa-check"></i> SESI AKTIF'; 
        btn.disabled = false; 
    }
}

async function saveTargetAch() {
    if (!currentSessionId) return alert("⚠️ Mulai sesi dulu!");
    if (sessionTargets.length === 0) return alert("⚠️ Draft kosong!");

    const btn = document.getElementById('btnSimpanTarget');
    btn.innerHTML = "⏳ Menyimpan..."; btn.disabled = true;

    try {
        for (let i = 0; i < sessionTargets.length; i++) {
            let t = sessionTargets[i];
            if (t.id) continue; 

            let achId = null;
            const { data: existParent } = await supabase.from('achievement_private')
                .select('id').eq('main_achievement', t.main).eq('level_id', levelId).maybeSingle();
            
            if (existParent) {
                achId = existParent.id;
            } else {
                const { data: newAch } = await supabase.from('achievement_private')
                    .insert({ main_achievement: t.main, sub_achievement: t.sub, level_id: levelId })
                    .select('id').single();
                achId = newAch.id;
            }

            const { data: existLink } = await supabase.from('achievement_target')
                .select('id').eq('pertemuan_id', currentSessionId).eq('achievement_id', achId).eq('catatan', t.sub).maybeSingle();

            if (!existLink) {
                await supabase.from('achievement_target')
                    .insert({ pertemuan_id: currentSessionId, achievement_id: achId, catatan: t.sub });
            }
            sessionTargets[i].id = achId;
        }

        if(btn.style.display !== 'none') alert("✅ Target Tersimpan!");
        
        // Auto Collapse Target
        toggleSection('targetSection', false); 
        
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
// 7. SAVE INDIVIDUAL
// =========================================

window.saveMonitoringIndividual = async (studentId) => {
    if (!currentSessionId) return alert("⚠️ Sesi belum aktif!");
    
    // Auto-Save Guard
    const unsavedTargets = sessionTargets.filter(t => !t.id);
    if (unsavedTargets.length > 0) {
        await saveTargetAch(); 
    }

    const btn = document.activeElement;
    const oriText = btn ? btn.innerHTML : "SIMPAN";
    if(btn) btn.innerHTML = "...";
    
    try {
        const sikap = document.getElementById(`sikap_${studentId}`).value;
        const fokus = document.getElementById(`fokus_${studentId}`).value;
        const cat = document.getElementById(`cat_${studentId}`).value;

        const { data: exist } = await supabase.from('attendance_private').select('id')
            .eq('pertemuan_id', currentSessionId).eq('student_id', studentId).maybeSingle();
        
        const payload = { pertemuan_id: currentSessionId, student_id: studentId, sikap: parseInt(sikap), fokus: parseInt(fokus), catatan: cat };
        
        if (exist) await supabase.from('attendance_private').update(payload).eq('id', exist.id);
        else await supabase.from('attendance_private').insert(payload);

        const container = document.getElementById(`starsContainer-${studentId}`);
        if (container) {
            const rows = container.querySelectorAll('.star-row');
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const score = parseInt(row.getAttribute('data-score') || "0");
                const targetObj = sessionTargets[i];
                
                if (!targetObj || !targetObj.id) continue; 

                const { data: existScore } = await supabase.from('achievement_pertemuan')
                    .select('id').eq('pertemuan_id', currentSessionId).eq('student_id', studentId).eq('achievement_id', targetObj.id).maybeSingle();
                
                if (existScore) await supabase.from('achievement_pertemuan').update({ indikator: score }).eq('id', existScore.id);
                else await supabase.from('achievement_pertemuan').insert({ pertemuan_id: currentSessionId, student_id: studentId, achievement_id: targetObj.id, indikator: score });
            }
        }
        
        attendanceMap[studentId] = payload;
        alert("✅ Data Tersimpan!");

    } catch (e) { alert("Error Save: " + e.message); }
    finally { if(btn) btn.innerHTML = oriText; }
};

// =========================================
// 8. RENDER UI
// =========================================

function renderStudentCards() {
    const container = document.getElementById('studentContainer');
    container.innerHTML = "";
    if (studentList.length === 0) return container.innerHTML = "<p style='text-align:center; padding:20px;'>Belum ada siswa.</p>";

    studentList.forEach(s => {
        const savedData = attendanceMap[s.id] || {}; 
        const sikapVal = savedData.sikap ? String(savedData.sikap) : "3";
        const fokusVal = savedData.fokus ? String(savedData.fokus) : "2";
        const border = savedData.sikap ? "5px solid #2ecc71" : "1px solid #ddd";

        const htmlSikap = `
            <option value="5" ${sikapVal==="5"?"selected":""}>🤩 (5) Sangat Baik</option>
            <option value="4" ${sikapVal==="4"?"selected":""}>👍 (4) Baik</option>
            <option value="3" ${sikapVal==="3"?"selected":""}>🙂 (3) Cukup</option>
            <option value="2" ${sikapVal==="2"?"selected":""}>🤐 (2) Kurang</option>
            <option value="1" ${sikapVal==="1"?"selected":""}>❌ (1) Buruk</option>
        `;
        
        const htmlFokus = `
            <option value="3" ${fokusVal==="3"?"selected":""}>🔥 (3) Fokus Penuh</option>
            <option value="2" ${fokusVal==="2"?"selected":""}>🙂 (2) Biasa</option>
            <option value="1" ${fokusVal==="1"?"selected":""}>😵 (1) Tidak Fokus</option>
        `;

        const trophyHTML = sessionTargets.length === 0 ? 
            `<div style="text-align:center; color:#ccc;">Belum ada target</div>` :
            sessionTargets.map((target, idx) => `
                <div class="star-row" data-score="0" data-ach-id="${target.id || ''}" style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px dashed #eee;">
                    <span style="font-size:0.85rem; font-weight:bold; color:#444; flex:1; padding-right:10px;">${escapeHtml(target.sub)}</span>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="score-label" style="font-size:0.75rem; color:#999; font-style:italic;">Belum</span>
                        <i class="fa-solid fa-trophy" style="font-size: 1.5rem; cursor: pointer; color: #e0e0e0;" onclick="toggleAchievement(this)"></i>
                    </div>
                </div>
            `).join('');

        container.innerHTML += `
            <div class="student-card" style="border-left:${border}; background:white; padding:15px; margin-bottom:15px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                <div style="font-weight:bold; font-size:1.1rem; margin-bottom:15px; color:#2c3e50;">
                    <i class="fa-solid fa-user-graduate"></i> ${s.name}
                </div>
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                    <div style="flex:1;"><label style="font-size:0.75rem; color:#666;">SIKAP</label><select id="sikap_${s.id}" class="android-safe">${htmlSikap}</select></div>
                    <div style="flex:1;"><label style="font-size:0.75rem; color:#666;">FOKUS</label><select id="fokus_${s.id}" class="android-safe">${htmlFokus}</select></div>
                </div>
                <div id="starsContainer-${s.id}" style="margin-bottom:15px;">${trophyHTML}</div>
                <textarea id="cat_${s.id}" rows="2" placeholder="Catatan..." style="width:100%; border:1px solid #ccc; padding:8px; border-radius:4px;">${savedData.catatan || ""}</textarea>
                <button onclick="saveMonitoringIndividual('${s.id}')" style="width:100%; background:#2196F3; color:white; border:none; padding:12px; margin-top:10px; border-radius:4px; font-weight:bold; cursor:pointer;"><i class="fa-solid fa-floppy-disk"></i> SIMPAN NILAI</button>
            </div>
        `;
        rehydrateIconValues(s.id);
    });
}

function renderTargetListUI() {
    const list = document.getElementById('targetList');
    const btnSimpan = document.getElementById('btnSimpanTarget');
    list.innerHTML = "";
    
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
        const trashColor = "#ff5252"; 
        
        list.innerHTML += `
            <div style="background:${color}; padding:10px; border-radius:5px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center; border:1px solid #ddd;">
                <div>
                    <div style="font-weight:bold; font-size:0.85rem; color:#333;">${t.main}</div>
                    <div style="font-size:0.8rem; color:#666;">${t.sub}</div>
                </div>
                <div style="display:flex; align-items:center;">
                    ${icon} 
                    <i class="fa-solid fa-trash-can" onclick="removeTarget(${idx})" style="color:${trashColor}; cursor:pointer; margin-left:10px;"></i>
                </div>
            </div>
        `;
    });
}

window.removeTarget = async (index) => {
    const target = sessionTargets[index];
    if (!target.id) {
        sessionTargets.splice(index, 1);
        renderTargetListUI();
        renderStudentCards();
        if (sessionTargets.length === 0) document.getElementById('btnSimpanTarget').style.display = 'none';
        return;
    }

    if(!confirm(`⚠️ HAPUS TARGET DARI DATABASE?\n\nTarget: "${target.main} - ${target.sub}"\n\nPenilaian siswa akan hilang.`)) return;

    try {
        await supabase.from('achievement_pertemuan').delete().eq('pertemuan_id', currentSessionId).eq('achievement_id', target.id);
        await supabase.from('achievement_target').delete().eq('pertemuan_id', currentSessionId).eq('achievement_id', target.id).eq('catatan', target.sub);

        sessionTargets.splice(index, 1);
        renderTargetListUI();
        renderStudentCards();
        alert("✅ Target dihapus.");
    } catch (err) { alert("Gagal hapus: " + err.message); }
};

function rehydrateIconValues(studentId) {
    const container = document.getElementById(`starsContainer-${studentId}`);
    if (!container) return;
    const rows = container.querySelectorAll('.star-row');
    rows.forEach((row, index) => {
        const targetObj = sessionTargets[index];
        if (!targetObj || !targetObj.id) return;
        const key = `${studentId}_${targetObj.id}`;
        const savedScore = achievementScoreMap[key]; 
        if (savedScore) {
            row.setAttribute('data-score', savedScore);
            updateIconVisual(row.querySelector('.fa-trophy'), parseInt(savedScore));
        }
    });
}

// =========================================
// 9. FETCH & HISTORY
// =========================================

async function loadHistory() {
    const grid = document.getElementById('historyGrid');
    if (!grid) return;
    const { data } = await supabase.from('pertemuan_private')
        .select(`id, tanggal, materi_private(judul)`).eq('class_id', classId).order('tanggal', {ascending:false}).limit(10);
    
    if(!data || data.length === 0) {
        grid.innerHTML = '<p style="padding:10px; color:#999;">Belum ada riwayat.</p>';
        return;
    }
    grid.innerHTML = data.map(item => `
        <div class="history-card" onclick="loadSessionForEdit('${item.id}')">
            <b>${new Date(item.tanggal).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</b>
            ${escapeHtml(item.materi_private?.judul)}
        </div>
    `).join('');
}

window.loadSessionForEdit = async (sessionId, askConfirm = true) => {
    if(askConfirm && currentSessionId && !confirm("Buka dan edit sesi ini? Input saat ini akan hilang.")) return;
    
    currentSessionId = sessionId;
    sessionTargets = [];
    attendanceMap = {};
    achievementScoreMap = {};

    try {
        const { data } = await supabase.from('pertemuan_private')
            .select('*, materi_private(judul)')
            .eq('id', sessionId)
            .single();
            
        if(data) {
            document.getElementById('tglPertemuan').value = data.tanggal;
            if(data.teacher_id) document.getElementById('pilihGuru').value = String(data.teacher_id);
            document.getElementById('materiUtama').value = data.materi_private?.judul || "";
            updateHeaderInfo(`${new Date(data.tanggal).toLocaleDateString('id-ID')} - ${data.materi_private?.judul}`, "EDIT MODE", true);
            
            // HANYA MODE BARU, TIDAK ADA TOMBOL HAPUS
            const btnReset = document.getElementById('btnResetMode');
            if(btnReset) btnReset.style.display = 'block';
            
            toggleSection('setupSection', true); 
            toggleSection('targetSection', true);
        }

        await Promise.all([
            fetchSessionTargets(sessionId),
            fetchSessionAttendance(sessionId),
            fetchAchievementScores(sessionId)
        ]);

        document.getElementById('formInputTarget').style.display = 'none';
        document.getElementById('btnSimpanTarget').style.display = 'none';
        document.getElementById('btnTambahLagi').style.display = 'block';

        unlockInterface();
        renderTargetListUI();
        renderStudentCards();
        
        if(askConfirm) window.scrollTo({top: 0, behavior: 'smooth'});
        
    } catch(e) { console.error(e); alert("Gagal memuat sesi."); }
};

async function fetchSessionTargets(sessionId) {
    const { data } = await supabase.from('achievement_target')
        .select(`achievement_id, catatan, achievement_private ( main_achievement )`)
        .eq('pertemuan_id', sessionId);
    if (data) {
        sessionTargets = data.map(item => ({
            id: item.achievement_id,
            main: item.achievement_private?.main_achievement || "Topik",
            sub: item.catatan || "(Tanpa Detail)" 
        }));
    }
}

async function fetchSessionAttendance(sessionId) {
    const { data } = await supabase.from('attendance_private').select('*').eq('pertemuan_id', sessionId);
    attendanceMap = {}; 
    if (data) data.forEach(row => attendanceMap[row.student_id] = row);
}

async function fetchAchievementScores(sessionId) {
    const { data } = await supabase.from('achievement_pertemuan').select('*').eq('pertemuan_id', sessionId);
    achievementScoreMap = {};
    if (data) data.forEach(row => achievementScoreMap[`${row.student_id}_${row.achievement_id}`] = row.indikator);
}

async function loadLastSession() {
    try {
        const { data } = await supabase.from('pertemuan_private')
            .select(`id, tanggal, teacher_id, materi_private (id, judul)`)
            .eq('class_id', classId)
            .order('tanggal', { ascending: false }).limit(1).maybeSingle();
        if (data) await loadSessionForEdit(data.id, false);
    } catch (err) { console.error(err); }
}

async function fetchTeachers() {
    const sel = document.getElementById('pilihGuru');
    const { data } = await supabase.from('teachers').select('id, name').order('name');
    if (data) sel.innerHTML = `<option value="">Pilih Guru...</option>` + data.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
}

async function fetchStudents() {
    const { data } = await supabase.from('students_private').select('id, name').eq('class_id', classId).order('name');
    studentList = data || [];
}

// =========================================
// 10. SMART INPUT ACTIONS
// =========================================

function addAchievementToTarget() {
    const mainAch = selectedMainAch || document.getElementById('mainAchSearch').value.trim();
    if (!mainAch) {
        alert("⚠️ Pilih atau ketik Topik Utama dulu!");
        document.getElementById('mainAchSearch').focus();
        return;
    }
    
    let subAch = '';
    const dropdown = document.getElementById('subAchSelect');
    const manualInput = document.getElementById('subAchManual');
    
    if (dropdown.style.display !== 'none') { subAch = dropdown.value; } 
    else if (manualInput.style.display !== 'none') { subAch = document.getElementById('subAchManual').value.trim(); }
    
    if (!subAch) return alert("⚠️ Pilih atau ketik Detail Target!");
    
    const isDuplicate = sessionTargets.some(t => t.main === mainAch && t.sub === subAch);
    if (isDuplicate) return alert("⚠️ Target ini sudah ada di list!");
    
    sessionTargets.push({ main: mainAch, sub: subAch, id: null });
    
    renderTargetListUI();
    renderStudentCards();
    document.getElementById('btnSimpanTarget').style.display = 'block';
    resetSmartInput();
}

function resetSmartInput() {
    selectedMainAch = null;
    document.getElementById('mainAchSearch').value = '';
    document.getElementById('achSuggestionBox').style.display = 'none';
    document.getElementById('subAchContainer').style.display = 'none';
    document.getElementById('subAchSelect').innerHTML = '<option value="">Pilih...</option>';
    document.getElementById('subAchManual').value = '';
    document.getElementById('mainAchSearch').focus();
}

function setupMainAchSearch() {
    const searchInput = document.getElementById('mainAchSearch');
    const suggestionBox = document.getElementById('achSuggestionBox');
    if (!searchInput || !suggestionBox) return;
    
    searchInput.addEventListener('input', (e) => {
        const keyword = e.target.value.trim();
        clearTimeout(debounceTimer);
        document.getElementById('subAchContainer').style.display = 'none';
        selectedMainAch = null;
        if (keyword.length < 2) { suggestionBox.style.display = 'none'; return; }
        debounceTimer = setTimeout(() => { searchMainAchievements(keyword); }, 300);
    });
    document.addEventListener('click', (e) => {
        if (e.target !== searchInput && e.target !== suggestionBox) { suggestionBox.style.display = 'none'; }
    });
}

async function searchMainAchievements(keyword) {
    const suggestionBox = document.getElementById('achSuggestionBox');
    const { data } = await supabase.from('achievement_private').select('main_achievement, sub_achievement')
        .eq('level_id', levelId).ilike('main_achievement', `%${keyword}%`).limit(10);
    
    const uniqueMain = {};
    if (data) {
        data.forEach(item => {
            const main = item.main_achievement;
            if (!uniqueMain[main]) uniqueMain[main] = [];
            if (item.sub_achievement) {
                const subs = item.sub_achievement.split('\n').map(s => s.trim()).filter(s => s);
                uniqueMain[main] = [...uniqueMain[main], ...subs];
            }
        });
    }
    
    let html = '';
    const entries = Object.entries(uniqueMain);
    const createNewHtml = `<div class="suggestion-item suggestion-new" onclick="selectNewMain('${escapeHtml(keyword)}')"><i class="fa-solid fa-plus-circle"></i> Buat Baru: "${keyword}"</div>`;

    if (entries.length === 0) { html = createNewHtml; } 
    else {
        entries.forEach(([mainAch, subs]) => {
            const uniqueSubs = [...new Set(subs)];
            const subsJson = JSON.stringify(uniqueSubs).replace(/"/g, '&quot;');
            html += `<div class="suggestion-item" onclick="selectMainAch('${mainAch}', ${subsJson})"><strong>${mainAch}</strong><small style="color:#999; display:block; margin-top:3px;">${uniqueSubs.length} rincian</small></div>`;
        });
        html += createNewHtml;
    }
    suggestionBox.innerHTML = html;
    suggestionBox.style.display = 'block';
}

window.selectMainAch = (mainAch, subs) => {
    selectedMainAch = mainAch;
    document.getElementById('mainAchSearch').value = mainAch;
    document.getElementById('achSuggestionBox').style.display = 'none';
    loadSubDropdown(subs);
};

window.selectNewMain = (mainText) => {
    selectedMainAch = mainText;
    document.getElementById('mainAchSearch').value = mainText;
    document.getElementById('achSuggestionBox').style.display = 'none';
    document.getElementById('subAchContainer').style.display = 'block';
    document.getElementById('subAchSelect').style.display = 'none';
    document.getElementById('subAchManual').style.display = 'block';
    setTimeout(() => { document.getElementById('subAchManual').focus(); }, 100);
};

function loadSubDropdown(subs) {
    const dropdown = document.getElementById('subAchSelect');
    document.getElementById('subAchContainer').style.display = 'block';
    dropdown.style.display = 'block';
    document.getElementById('subAchManual').style.display = 'none';
    
    let optionsHTML = '<option value="">Pilih Detail Target...</option>';
    if (subs && subs.length > 0) {
        subs.forEach(sub => { optionsHTML += `<option value="${escapeHtml(sub)}">${escapeHtml(sub)}</option>`; });
        dropdown.innerHTML = optionsHTML;
    } else {
        dropdown.style.display = 'none';
        document.getElementById('subAchManual').style.display = 'block';
    }
}

function setupEventListeners() {
    document.getElementById('btnSimpanSesi').onclick = savePertemuan;
    document.getElementById('btnAddAch').onclick = addAchievementToTarget;
    document.getElementById('btnSimpanTarget').onclick = saveTargetAch;
    
    document.getElementById('btnTambahLagi').onclick = () => {
        document.getElementById('formInputTarget').style.display = 'block';
        document.getElementById('btnSimpanTarget').style.display = 'block';
        document.getElementById('btnTambahLagi').style.display = 'none';
        resetSmartInput();
    };
    
    setupMainAchSearch();
    const btnToggle = document.getElementById('btnToggleManual');
    if(btnToggle) btnToggle.onclick = window.toggleManualSub;
}