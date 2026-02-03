import { supabaseUrl, supabaseKey } from './config.js';

// 1. Inisialisasi Supabase
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// URL Edge Function
const EDGE_URL = 'https://aedtrwpomswdqxarvsrg.supabase.co/functions/v1/add-user';

// State Global
let allUsers = [];
let allLevels = []; 
let currentTableTab = 'all'; 
let currentUserId = null; 
const loggedInUserRole = localStorage.getItem('user_role'); 

// ==========================================
// 1. INISIALISASI & SECURITY CHECK
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    // 1. SECURITY GUARD: Cek Token
    if (!loggedInUserRole) {
        document.body.innerHTML = `
            <div style="display:flex; height:100vh; justify-content:center; align-items:center; flex-direction:column; background:#f0f0f0;">
                <h1 style="color:#d32f2f; font-family:sans-serif;">AKSES DITOLAK</h1>
                <p style="color:#555;">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
                <button onclick="window.location.href='index.html'" style="padding:10px 20px; background:#333; color:white; border:none; border-radius:5px; margin-top:20px; cursor:pointer;">Kembali ke Login</button>
            </div>
        `;
        return;
    }

    // 2. LOGIKA TAMPILAN & PROTEKSI DROPDOWN (REVISI)
    if (loggedInUserRole !== 'super_admin') {
        // A. Sembunyikan Tab "Level Mengajar" (Ini fitur advance khusus Admin)
        const tabTeacher = document.getElementById('tab-teacher');
        if (tabTeacher) tabTeacher.style.display = 'none';

        // B. FORM INPUT USER TETAP MUNCUL (Sesuai request Bapak)
        // Teacher boleh tambah user.
        
        // C. PROTEKSI DROPDOWN: Hapus Opsi 'Super Admin'
        // Agar Teacher tidak bisa membuat akun Super Admin
        const roleSelect = document.getElementById('role');
        if (roleSelect) {
            const superAdminOption = roleSelect.querySelector('option[value="super_admin"]');
            if (superAdminOption) {
                superAdminOption.remove(); // Hapus opsi dari DOM
            }
        }
    }

    // Ambil ID User Login
    const { data: { user } } = await supabase.auth.getUser();
    currentUserId = user?.id || null;

    fetchLevels(); 
    fetchUsers();  
    setupEventListeners();
});

function switchMainTab(tabId) {
    document.querySelectorAll('.tab-panel').forEach(panel => panel.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    let contentId = '';
    if (tabId === 'reg-user') contentId = 'reg-user-content';
    else if (tabId === 'scope') contentId = 'scope-content';
    else if (tabId === 'teacher') contentId = 'teacher-content';

    const contentPanel = document.getElementById(contentId);
    if (contentPanel) contentPanel.style.display = 'block';

    const btnId = `tab-${tabId}`;
    const activeBtn = document.getElementById(btnId);
    if (activeBtn) activeBtn.classList.add('active');
}

// ==========================================
// 2. DATA FETCHING
// ==========================================

async function fetchLevels() {
    const { data } = await supabase.from('levels').select('id, kode').order('kode');
    if (data) allLevels = data;
}

async function fetchUsers() {
    console.log("Sinkronisasi data...");
    
    const { data, error } = await supabase
        .from('user_profiles')
        .select(`
            id, role, email, is_active, school_id, class_id, group_id, class_private_id, level_id,
            schools(name), group_private(code), classes(name), class_private(name), levels(kode) 
        `);

    if (error) return showToast("Gagal sinkron: " + error.message, true);

    allUsers = data.map(u => ({
        ...u,
        email: u.email || "(Belum Sinkron)",
        role: u.role || "student",
        displayScope: formatScopeText(u),
        levelName: Array.isArray(u.levels) ? u.levels[0]?.kode : u.levels?.kode || "-"
    }));

    renderRegTable(); 
    renderScopeTable(); 
    
    if (loggedInUserRole === 'super_admin') {
        renderTeacherTable(); 
    }
}

function formatScopeText(u) {
    const getVal = (obj, prop) => (Array.isArray(obj) ? obj[0]?.[prop] : obj?.[prop]);
    if (u.role === 'pic') {
        const instansi = getVal(u.schools, 'name') || getVal(u.group_private, 'code') || "Belum diatur";
        return `<strong>Akses Full:</strong> ${instansi}`;
    } else if (u.role === 'student') {
        const instansi = getVal(u.schools, 'name') || getVal(u.group_private, 'code');
        const unit = getVal(u.classes, 'name') || getVal(u.class_private, 'name') || "Belum diatur";
        return instansi ? `${instansi} - ${unit}` : "Belum diatur";
    }
    return "-";
}

// ==========================================
// 3. RENDER TABEL
// ==========================================

function renderRegTable() {
    const searchInput = document.getElementById('searchUser');
    const search = searchInput ? searchInput.value.toLowerCase() : "";
    const tbody = document.getElementById('user-table-body');
    if (!tbody) return;

    const filtered = allUsers.filter(u => {
        // LOGIKA PRIVASI (VIEW)
        if (loggedInUserRole === 'teacher') {
            if (u.role === 'super_admin') return false; // Hide Admin
            if (u.role === 'teacher' && u.id !== currentUserId) return false; // Hide Guru Lain
        }
        
        const matchesTab = (currentTableTab === 'all' || u.role === currentTableTab);
        const matchesSearch = u.email.toLowerCase().includes(search);
        return matchesTab && matchesSearch;
    });

    tbody.innerHTML = filtered.map(u => {
        let actionButtons = '';
        
        if (loggedInUserRole === 'super_admin') {
            // Admin: Edit & Delete
            actionButtons = `
                <button class="btn-primary btn-edit" data-id="${u.id}">Edit</button>
                <button class="logout btn-delete" data-id="${u.id}">Hapus</button>
            `;
        } else {
            // Teacher: Edit & Disable Only
            const btnLabel = u.is_active ? "Nonaktifkan" : "Aktifkan";
            const btnStyle = u.is_active ? "logout" : "btn-primary";
            actionButtons = `
                <button class="btn-primary btn-edit" data-id="${u.id}">Edit</button>
                <button class="${btnStyle} btn-toggle-active" data-id="${u.id}" data-status="${u.is_active}">
                    ${btnLabel}
                </button>
            `;
        }

        const emailDisplay = u.is_active ? u.email : `${u.email} <br><span style="color:red; font-size:0.8em; font-weight:bold;">(NON-AKTIF)</span>`;
        const rowStyle = u.is_active ? '' : 'style="background-color: #fff0f0;"';

        return `
            <tr ${rowStyle}>
                <td>${emailDisplay}</td>
                <td><span class="badge ${u.role}">${u.role.toUpperCase()}</span></td>
                <td>${actionButtons}</td>
            </tr>`;
    }).join('');
}

function renderScopeTable() {
    const tbody = document.getElementById('scope-table-body');
    if (!tbody) return;
    const scopeUsers = allUsers.filter(u => u.role === 'pic' || u.role === 'student');
    if (scopeUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Belum ada data.</td></tr>';
        return;
    }
    tbody.innerHTML = scopeUsers.map(u => `
        <tr>
            <td>${u.email}</td>
            <td><span class="badge ${u.role}">${u.role.toUpperCase()}</span></td>
            <td>${u.displayScope}</td>
            <td><button class="btn-primary btn-set-scope" data-id="${u.id}">Atur Mapping</button></td>
        </tr>`).join('');
}

function renderTeacherTable() {
    const tbody = document.getElementById('teacher-table-body');
    if (!tbody) return;
    const teachers = allUsers.filter(u => u.role === 'teacher');
    if (teachers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Tidak ada data Guru.</td></tr>';
        return;
    }
    tbody.innerHTML = teachers.map(u => `
        <tr>
            <td>${u.email}</td>
            <td><span class="badge teacher">TEACHER</span></td>
            <td>${u.levelName}</td>
            <td><button class="btn-primary btn-set-level" data-id="${u.id}">Atur Level</button></td>
        </tr>`).join('');
}

// ==========================================
// 4. MODAL LOGIC (INJECTION)
// ==========================================

function restoreModalHTML() {
    const modalBody = document.querySelector('.modal-body');
    modalBody.innerHTML = `
        <input type="hidden" id="modal-user-id">
        <input type="hidden" id="modal-user-role">
        <div class="form-grid">
          <div class="form-group">
            <label>Tipe Program</label>
            <select id="scope-type">
              <option value="">-- Pilih Tipe --</option>
              <option value="sekolah">Jalur Sekolah</option>
              <option value="private">Jalur Private</option>
            </select>
          </div>
          <div class="form-group">
            <label id="label-scope-induk">Lembaga/Institusi</label>
            <select id="scope-induk"><option value="">-- Pilih Tipe Dulu --</option></select>
          </div>
          <div class="form-group" id="group-scope-anak" style="display:none;">
            <label id="label-scope-anak">Unit/Kelas</label>
            <select id="scope-anak"><option value="">-- Pilih Lembaga Dulu --</option></select>
          </div>
        </div>
    `;
    
    const modalFooter = document.querySelector('.modal-footer');
    modalFooter.innerHTML = `
        <button class="btn-secondary" id="btn-cancel-scope">Batal</button>
        <button class="btn-primary" id="btn-save-scope">Terapkan Hak Akses</button>
    `;

    document.getElementById('btn-cancel-scope').onclick = closeScopeModal;
    document.getElementById('btn-save-scope').onclick = saveScope;
    document.getElementById('scope-type').onchange = (e) => handleScopeTypeChange(e.target.value);
    document.getElementById('scope-induk').onchange = (e) => handleScopeIndukChange(e.target.value);
}

// --- OPEN MODAL SCOPE ---
async function openScopeModal(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    restoreModalHTML(); 

    document.getElementById('modal-user-email').innerText = `Atur Akses: ${user.email}`;
    document.getElementById('modal-user-id').value = user.id;
    document.getElementById('modal-user-role').value = user.role;
    
    const groupAnak = document.getElementById('group-scope-anak');
    if (groupAnak) groupAnak.style.display = (user.role === 'student') ? 'block' : 'none';

    document.getElementById('modal-scope').style.display = 'flex';
}

// --- OPEN MODAL LEVEL ---
function openLevelModal(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('modal-user-email').innerText = `Atur Level Guru: ${user.email}`;

    // Inject Dropdown
    const modalBody = document.querySelector('.modal-body');
    modalBody.innerHTML = `
        <div class="form-group">
            <label style="font-weight:bold; margin-bottom:10px; display:block;">Pilih Level Mengajar</label>
            <select id="select-level-guru" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:5px;">
                <option value="">-- Pilih Level --</option>
                ${allLevels.map(lvl => `
                    <option value="${lvl.id}" ${user.level_id === lvl.id ? 'selected' : ''}>${lvl.kode}</option>
                `).join('')}
            </select>
        </div>
    `;

    // Inject Footer
    const modalFooter = document.querySelector('.modal-footer');
    modalFooter.innerHTML = `
        <button class="btn-secondary" id="btn-cancel-level">Batal</button>
        <button class="btn-primary" id="btn-save-level">Simpan Level</button>
    `;

    document.getElementById('btn-cancel-level').onclick = closeScopeModal;
    document.getElementById('btn-save-level').onclick = () => saveLevel(user.id);

    document.getElementById('modal-scope').style.display = 'flex';
}

function closeScopeModal() {
    document.getElementById('modal-scope').style.display = 'none';
}

// ==========================================
// 5. ACTIONS
// ==========================================

async function saveLevel(userId) {
    const levelId = document.getElementById('select-level-guru').value;
    if (!levelId) return showToast("Pilih level terlebih dahulu!", true);
    showToast("Menyimpan level...");
    const { error } = await supabase.from('user_profiles').update({ level_id: levelId }).eq('id', userId);
    if (error) { showToast("Gagal: " + error.message, true); } 
    else { showToast("Level tersimpan!"); closeScopeModal(); fetchUsers(); }
}

async function saveScope() {
    const userId = document.getElementById('modal-user-id').value;
    const role = document.getElementById('modal-user-role').value;
    const type = document.getElementById('scope-type').value;
    const idInduk = document.getElementById('scope-induk').value;
    const idAnak = document.getElementById('scope-anak').value;

    if (!userId || !type || !idInduk) return showToast("Lengkapi data!", true);
    if (role === 'student' && !idAnak) return showToast("Siswa wajib pilih kelas!", true);
    showToast("Menyimpan...");
    const payload = { id: userId, role: role, school_id: type === 'sekolah' ? idInduk : null, class_id: type === 'sekolah' ? (idAnak || null) : null, group_id: type === 'private' ? idInduk : null, class_private_id: type === 'private' ? (idAnak || null) : null };
    const { error } = await supabase.from('user_profiles').upsert(payload, { onConflict: 'id' });
    if (error) showToast("Gagal: " + error.message, true); else { showToast("Tersimpan!"); closeScopeModal(); await fetchUsers(); }
}

async function saveUser() {
    const id = document.getElementById('userId').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    if (!email || (!id && !password)) return showToast("Email & Password wajib diisi!", true);
    showToast("Memproses...");
    try {
        const response = await fetch(EDGE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ action: id ? 'UPDATE' : 'CREATE', userId: id, email, password, role })
        });
        if (response.ok) { showToast("User disimpan"); resetForm(); fetchUsers(); }
        else { showToast("Gagal: " + await response.text(), true); }
    } catch (e) { showToast("Koneksi gagal", true); }
}

async function deleteUser(id) {
    if (!confirm("PERINGATAN: Hapus user ini PERMANEN?")) return;
    showToast("Menghapus...");
    try {
        const response = await fetch(EDGE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ action: 'DELETE', userId: id })
        });
        if (response.ok) { showToast("Terhapus"); fetchUsers(); }
        else { showToast("Gagal hapus", true); }
    } catch (e) { showToast("Error sistem", true); }
}

async function toggleUserActive(userId, currentStatus) {
    const newStatus = !currentStatus;
    if (!confirm(`Yakin ingin ${newStatus ? 'MENGAKTIFKAN' : 'MENONAKTIFKAN'} user ini?`)) return;
    showToast("Update status...");
    const { error } = await supabase.from('user_profiles').update({ is_active: newStatus }).eq('id', userId);
    if (error) showToast("Gagal: " + error.message, true); else { showToast("Status berhasil diubah"); await fetchUsers(); }
}

// Helpers Dropdown
async function handleScopeTypeChange(type) {
    const select = document.getElementById('scope-induk');
    select.innerHTML = '<option value="">-- Memuat... --</option>';
    if (type === 'sekolah') {
        const { data } = await supabase.from('schools').select('id, name').order('name');
        select.innerHTML = '<option value="">-- Pilih Sekolah --</option>' + data.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    } else if (type === 'private') {
        const { data } = await supabase.from('group_private').select('id, code').order('code');
        select.innerHTML = '<option value="">-- Pilih Group --</option>' + data.map(d => `<option value="${d.id}">${d.code}</option>`).join('');
    }
}
async function handleScopeIndukChange(idInduk) {
    const role = document.getElementById('modal-user-role').value;
    const type = document.getElementById('scope-type').value;
    const select = document.getElementById('scope-anak');
    if (role !== 'student' || !idInduk) return;
    select.innerHTML = '<option value="">-- Memuat... --</option>';
    const table = type === 'sekolah' ? 'classes' : 'class_private';
    const filter = type === 'sekolah' ? 'school_id' : 'group_id';
    const { data } = await supabase.from(table).select('id, name').eq(filter, idInduk).order('name');
    select.innerHTML = '<option value="">-- Pilih Kelas --</option>' + data.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
}

// ==========================================
// 6. EVENT LISTENERS
// ==========================================

function setupEventListeners() {
    // Navigasi Tab
    document.getElementById('tab-reg')?.addEventListener('click', () => switchMainTab('reg-user'));
    document.getElementById('tab-scope')?.addEventListener('click', () => switchMainTab('scope'));
    document.getElementById('tab-teacher')?.addEventListener('click', () => switchMainTab('teacher'));

    // Form
    document.getElementById('btn-save')?.addEventListener('click', saveUser);
    document.getElementById('btn-cancel')?.addEventListener('click', resetForm);
    document.getElementById('searchUser')?.addEventListener('input', renderRegTable);

    // Filter Group Tab
    document.getElementById('tab-group')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-item')) {
            document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentTableTab = e.target.dataset.role;
            renderRegTable();
        }
    });

    // Klik Tabel User
    document.getElementById('user-table-body')?.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        if (e.target.classList.contains('btn-edit')) {
            const u = allUsers.find(user => user.id === id);
            if (u) {
                document.getElementById('userId').value = u.id;
                document.getElementById('email').value = u.email;
                document.getElementById('role').value = u.role;
                document.getElementById('form-title').innerText = "Edit User";
                document.getElementById('btn-cancel').style.display = 'inline-block';
                window.scrollTo(0, 0);
            }
        }
        if (e.target.classList.contains('btn-delete')) deleteUser(id);
        if (e.target.classList.contains('btn-toggle-active')) toggleUserActive(id, e.target.dataset.status === "true");
    });

    // Klik Tabel Teacher & Scope
    document.getElementById('teacher-table-body')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-set-level')) openLevelModal(e.target.dataset.id);
    });
    document.getElementById('scope-table-body')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-set-scope')) openScopeModal(e.target.dataset.id);
    });

    // Modal & Logout
    document.getElementById('btn-close-modal')?.addEventListener('click', closeScopeModal);
    document.getElementById('btn-logout')?.addEventListener('click', () => {
        supabase.auth.signOut();
        localStorage.clear();
        window.location.href = 'index.html';
    });
}

function resetForm() {
    ['userId', 'email', 'password'].forEach(f => document.getElementById(f).value = '');
    document.getElementById('role').value = 'student';
    document.getElementById('form-title').innerText = "Tambah User Baru";
    document.getElementById('btn-cancel').style.display = 'none';
}

function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.innerText = msg;
    t.className = isError ? 'toast error' : 'toast';
    t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 3000);
}