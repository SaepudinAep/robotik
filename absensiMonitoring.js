import { supabase } from './config.js';

// =========================================
// 1. STATE & KONFIGURASI
// =========================================
const classId = localStorage.getItem("activePrivateClassId");
const levelId = localStorage.getItem("activeLevelId");
const levelKode = localStorage.getItem("activeLevelKode") || "--";


// AMBIL NAMA KELAS (Pastikan key ini sesuai dengan yang Anda simpan di halaman sebelumnya)
const className = localStorage.getItem("activeClassName") || ""; 

// State Data Global
let currentSessionId = null;     
let sessionTargets = [];         
let studentList = [];
let attendanceMap = {}; 

// =========================================
// 2. INITIALIZATION
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    // 1. Cek ID Kelas
    if (!classId) return alert("⚠️ Error: ID Kelas tidak ditemukan.");
    
    // 2. LOGIKA BARU: Tampilkan Nama Kelas di Header
    const titleEl = document.getElementById('headerClassName');
    // Cek apakah elemen ada DAN variabel className tidak kosong
    if (titleEl && className) {
        titleEl.innerText = ` - ${className}`; 
    }

    // 3. Set Default UI Header
    updateHeaderInfo("Level: " + levelKode, "Draft Sesi");
    
    // 4. Set Tanggal Hari Ini
    const tglInput = document.getElementById('tglPertemuan');
    if(tglInput) tglInput.valueAsDate = new Date();
    
    // 5. Load Data (JANGAN DIHAPUS)
    console.log("🚀 System Start...");
    await fetchStudents(); 
    await loadHistory();   
    
    // 6. Resume Sesi Terakhir
    await loadLastSession(); 
    
    // 7. Event Listeners (PENTING)
    setupEventListeners();
}

/**
 * Update Header Info (Status Bar)
 * Mengubah teks Level menjadi Materi saat sesi aktif
 */
function updateHeaderInfo(subTitle, statusTag, isSaved = false) {
    const lvlDisplay = document.getElementById('levelDisplay');
    const tag = document.getElementById('sessionTag');

    if (lvlDisplay) {
        lvlDisplay.innerText = subTitle;
        lvlDisplay.style.color = isSaved ? "#ffeb3b" : "rgba(255,255,255,0.9)"; // Kuning jika saved
        lvlDisplay.style.fontWeight = isSaved ? "bold" : "normal";
    }

    if (tag) {
        tag.innerText = statusTag;
        tag.style.color = isSaved ? "#2ecc71" : "#fff"; // Hijau jika aktif
        tag.style.fontSize = "1.2rem";
    }
}

// =========================================
// 3. LOGIKA UTAMA: LOAD SESI TERAKHIR
// =========================================
async function loadLastSession() {
    try {
        const { data, error } = await supabase
            .from('pertemuan_private')
            .select(`
                id, tanggal, teacher_id, 
                materi_private ( id, judul )
            `)
            .eq('class_id', classId)
            .order('tanggal', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) return;

        // Restore State
        currentSessionId = data.id;
        
        // Restore Form Setup
        document.getElementById('tglPertemuan').value = data.tanggal;
        if(data.teacher_id) document.getElementById('pilihGuru').value = data.teacher_id;
        
        const judulMateri = data.materi_private?.judul || "";
        document.getElementById('materiUtama').value = judulMateri;

        // Update Header (Tampilkan Materi & Tanggal)
        const tglInfo = new Date(data.tanggal).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'});
        updateHeaderInfo(` ${tglInfo} - ${judulMateri}`, "LANJUT", true);
        
        // Load Detail Lainnya
        await fetchSessionTargets(data.id);
        await fetchSessionAttendance(data.id);
        renderStudentCards();
        
    } catch (err) { console.error("Auto-Load Error:", err); }
}

// =========================================
// 4. DATABASE: FETCHING HELPER
// =========================================
async function fetchSessionTargets(sessionId) {
    try {
        const { data } = await supabase.from('achievement_target')
            .select(`achievement_private ( main_achievement, sub_achievement )`)
            .eq('pertemuan_id', sessionId);
            
        if (data && data.length > 0) {
            sessionTargets = data.map(item => ({
                main: item.achievement_private.main_achievement,
                sub: item.achievement_private.sub_achievement
            }));
            renderTargetListUI();
        }
    } catch (err) { console.error(err); }
}

async function fetchSessionAttendance(sessionId) {
    try {
        const { data } = await supabase.from('attendance_private')
            .select('student_id, sikap, fokus, catatan')
            .eq('pertemuan_id', sessionId);

        attendanceMap = {}; 
        if (data) data.forEach(row => attendanceMap[row.student_id] = row);
    } catch (err) { console.error(err); }
}

// =========================================
// 5. UI LOGIC (Accordion & Render)
// =========================================

// FUNGSI ACCORDION (Lipat/Buka Form)
window.toggleFormArea = () => {
    const setup = document.getElementById('setupSection');
    if (setup) {
        setup.style.display = (setup.style.display === 'none') ? 'block' : 'none';
    }
};

function renderTargetListUI() {
    const list = document.getElementById('targetList');
    if(list) {
        list.innerHTML = sessionTargets.map((t, i) => `
            <div class="ach-tag">
                <span>${t.sub}</span>
                <i class="fa-solid fa-xmark" style="color:red; cursor:pointer; margin-left:5px;" onclick="removeTarget(${i})"></i>
            </div>
        `).join('');
    }
}

function renderStudentCards() {
    const container = document.getElementById('studentContainer');
    if(!container) return;
    container.innerHTML = ''; 

    if (studentList.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:20px; color:#888;">⚠️ Belum ada data siswa.</p>`;
        return;
    }

    studentList.forEach(item => {
        const sId = item.id;
        const savedData = attendanceMap[sId] || {}; 
        
        // Visual Feedback: Border Hijau jika sudah dinilai
        const borderStyle = savedData.sikap ? "5px solid #2ecc71" : "1px solid #ddd";

        const card = document.createElement('div');
        card.className = 'student-card';
        card.style.borderLeft = borderStyle;

        card.innerHTML = `
            <div class="s-header">
                <i class="fa-solid fa-user-astronaut" style="color:var(--scratch-blue)"></i> ${item.name}
            </div>
            
            <div class="metrics-row">
                <div>
                    <label>SIKAP</label>
                    <select id="sikap-${sId}">
                        <option value="5" ${savedData.sikap==5?'selected':''}>🌀 (5) Sangat Baik</option>
                        <option value="4" ${savedData.sikap==4?'selected':''}>👀 (4) Baik</option>
                        <option value="3" ${savedData.sikap==3?'selected':''}>🙂 (3) Cukup</option>
                        <option value="2" ${savedData.sikap==2?'selected':''}>🙈 (2) Kurang</option>
                        <option value="1" ${savedData.sikap==1?'selected':''}>🤐 (1) Buruk</option>
                    </select>
                </div>
                <div>
                    <label>FOKUS</label>
                    <select id="fokus-${sId}">
                        <option value="3" ${savedData.fokus==3?'selected':''}>🔥 (3) Fokus Penuh</option>
                        <option value="2" ${savedData.fokus==2?'selected':''}>🙂 (2) Biasa</option>
                        <option value="1" ${savedData.fokus==1?'selected':''}>😶 (1) Tidak Fokus</option>
                    </select>
                </div>
            </div>

            <div class="stars-wrapper" id="starsContainer-${sId}">
                ${renderTargetStarsHTML(sId)}
            </div>

            <textarea id="catatan-${sId}" rows="2" placeholder="Catatan...">${savedData.catatan || ""}</textarea>
            
            <button class="btn-action" onclick="saveMonitoringIndividual('${sId}')" style="margin-top:10px;">
                <i class="fa-solid fa-check"></i> ${savedData.sikap ? 'Update Data' : 'Simpan'}
            </button>
        `;
        container.appendChild(card);
    });
    
    // Pastikan monitoring tampil
    const monSec = document.getElementById('monitoringSection');
    if(monSec) monSec.style.display = 'block';
}

function renderTargetStarsHTML(studentId) {
    if (sessionTargets.length === 0) {
        return `<div style="font-size:0.8rem; color:#888; text-align:center; padding:10px;">🎯 Target belum diset.</div>`;
    }
    // Render bintang (Logika simpan bintang per siswa bisa dikembangkan di iterasi selanjutnya)
    return sessionTargets.map((target, idx) => `
        <div class="star-row" data-score="0">
            <span style="font-size:0.9rem; font-weight:600; color:#444;">${target.sub}</span>
            <div class="stars">
                ${[1,2,3,4,5].map(n => `<i class="fa-solid fa-star star-item" onclick="setStar(this, ${n})"></i>`).join('')}
            </div>
        </div>
    `).join('');
}

// =========================================
// 6. DATABASE OPERATIONS (SAVE)
// =========================================

async function savePertemuan() {
    const tgl = document.getElementById('tglPertemuan').value;
    const guru = document.getElementById('pilihGuru').value; 
    const materiText = document.getElementById('materiUtama').value;

    if (!tgl || !materiText) return alert("⚠️ Isi Tanggal & Judul Materi!");

    try {
        // 1. Upsert Materi
        const { data: mData } = await supabase.from('materi_private')
            .upsert({ judul: materiText, level_id: levelId }, { onConflict: 'judul, level_id' })
            .select('id').single();

        // 2. Upsert Pertemuan
        const payload = { 
            class_id: classId, tanggal: tgl, teacher_id: guru || null, materi_id: mData?.id
        };
        if (currentSessionId) payload.id = currentSessionId;

        const { data, error } = await supabase.from('pertemuan_private')
            .upsert(payload).select().single();

        if (error) throw error;

        currentSessionId = data.id; 
        alert("✅ Sesi Tersimpan!");

        // Update Header Langsung
        const tglInfo = new Date(tgl).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'});
        updateHeaderInfo(`${materiText} (${tglInfo})`, "AKTIF", true);
        
        // Auto Accordion: Tutup Form Setup agar lega
        const setup = document.getElementById('setupSection');
        if(setup) setup.style.display = 'none'; 

        loadHistory(); 

    } catch (err) { alert(`Gagal: ${err.message}`); }
}

async function saveTargetAch() {
    if (!currentSessionId) return alert("⚠️ Simpan Sesi dulu!");
    if (!sessionTargets.length) return alert("⚠️ Tambah target dulu!");

    try {
        for (const t of sessionTargets) {
            const { data: achData } = await supabase.from('achievement_private')
                .upsert({ main_achievement: t.main, sub_achievement: t.sub, level_id: levelId }, {onConflict: 'main_achievement, sub_achievement, level_id'})
                .select('id').single();

            if (achData) {
                await supabase.from('achievement_target')
                    .upsert({ pertemuan_id: currentSessionId, achievement_id: achData.id }, {onConflict: 'pertemuan_id, achievement_id'});
            }
        }
        alert("✅ Target Tersinkron!");
        renderStudentCards(); 
    } catch (err) { alert(`Error: ${err.message}`); }
}

window.saveMonitoringIndividual = async (studentId) => {
    if (!currentSessionId) return alert("⚠️ Sesi belum aktif!");

    const sikap = document.getElementById(`sikap-${studentId}`).value;
    const fokus = document.getElementById(`fokus-${studentId}`).value;
    const catatan = document.getElementById(`catatan-${studentId}`).value;

    try {
        await supabase.from('attendance_private').upsert({
            student_id: studentId, pertemuan_id: currentSessionId,
            sikap: parseInt(sikap), fokus: parseInt(fokus), catatan: catatan
        });

        // Update Cache & UI
        attendanceMap[studentId] = { sikap: parseInt(sikap), fokus: parseInt(fokus), catatan: catatan };
        renderStudentCards(); 

        alert("✅ Data Tersimpan!");
    } catch (err) { alert("Gagal simpan data."); }
};

// =========================================
// 7. HELPER & EVENTS
// =========================================

async function loadHistory() {
    const grid = document.getElementById('historyGrid');
    if (!grid) return;
    try {
        const { data } = await supabase
            .from('pertemuan_private')
            .select(`id, tanggal, materi_private ( judul )`)
            .eq('class_id', classId)
            .order('tanggal', { ascending: false }).limit(10);

        grid.innerHTML = '';
        data?.forEach((item, idx) => {
            const tgl = new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            const judul = item.materi_private?.judul || "-";
            const card = document.createElement('div');
            card.className = 'history-card';
            card.style.borderLeftColor = ['#4d97ff', '#ffab19', '#4caf50', '#9c27b0'][idx % 4];
            card.innerHTML = `<div class="h-date">${tgl}</div><div class="h-materi">${judul}</div>`;
            
            // Klik History = Load Sesi Tersebut
            card.onclick = () => {
                if(confirm("Muat sesi ini untuk diedit?")) {
                    currentSessionId = item.id;
                    loadLastSession(); 
                    
                    // Buka Accordion agar user tahu data masuk form
                    const setup = document.getElementById('setupSection');
                    if(setup) setup.style.display = 'block';
                }
            };
            grid.appendChild(card);
        });
    } catch (e) { grid.innerHTML = 'Error history'; }
}

async function fetchStudents() {
    const { data } = await supabase.from('students_private').select('id, name').eq('class_id', classId).order('name', {ascending:true});
    studentList = data || [];
}

window.addAchievementToTarget = () => {
    const main = document.getElementById('mainAch').value;
    const sub = document.getElementById('subAch').value;
    if(!main || !sub) return;
    sessionTargets.push({ main, sub });
    renderTargetListUI();
    renderStudentCards();
    document.getElementById('mainAch').value = ''; document.getElementById('subAch').value = '';
};

window.removeTarget = (i) => { sessionTargets.splice(i, 1); renderTargetListUI(); renderStudentCards(); };

window.setStar = (el, score) => {
    const stars = el.parentElement.querySelectorAll('.star-item');
    stars.forEach((s, i) => s.classList.toggle('active', i < score));
    el.parentElement.parentElement.setAttribute('data-score', score);
};

function setupEventListeners() {
    const btnSesi = document.getElementById('btnSimpanSesi');
    if(btnSesi) btnSesi.onclick = savePertemuan;
    const btnTarget = document.getElementById('btnSimpanTarget');
    if(btnTarget) btnTarget.onclick = saveTargetAch;
}