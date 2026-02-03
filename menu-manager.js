import { supabaseUrl, supabaseKey } from './config.js';

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let allMenus = [];
let allLevels = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cek Login & Role (Wajib Super Admin)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'index.html';

    const { data: user } = await supabase.from('user_profiles').select('role').eq('id', session.user.id).single();
    if (user.role !== 'super_admin') {
        alert("Akses Ditolak!");
        window.location.href = 'dashboard.html';
        return;
    }

    // 2. Load Data Awal
    await fetchLevels(); // Load Referensi Level (READ ONLY)
    await fetchMenus();  // Load Data Menu (CRUD)
    
    setupEventListeners();
});

// --- DATA FETCHING ---

async function fetchLevels() {
    // AMAN: Hanya SELECT (Baca), tidak ada fungsi edit level di sini.
    const { data } = await supabase.from('levels').select('id, kode').order('kode');
    if (data) {
        allLevels = data;
        renderLevelCheckboxes(); 
    }
}

async function fetchMenus() {
    const { data, error } = await supabase
        .from('app_menus')
        .select('*')
        .order('category')
        .order('order_index');

    if (error) console.error(error);
    else {
        allMenus = data;
        renderTable();
    }
}

// --- RENDERING ---

function renderLevelCheckboxes() {
    const container = document.getElementById('container-cb-levels');
    // Hanya menampilkan checkbox untuk dipilih ID-nya
    container.innerHTML = allLevels.map(lvl => `
        <label class="checkbox-item">
            <input type="checkbox" class="cb-level" value="${lvl.id}"> ${lvl.kode}
        </label>
    `).join('');
}

function renderTable() {
    const tbody = document.getElementById('menu-table-body');
    tbody.innerHTML = allMenus.map(menu => {
        // Format Tampilan Level (Hanya memapping ID ke Nama Level)
        let levelBadges = '<span style="color:#aaa;">Semua Level</span>';
        if (menu.allowed_level_ids && menu.allowed_level_ids.length > 0) {
            const levelNames = menu.allowed_level_ids.map(id => {
                const lvl = allLevels.find(l => l.id === id);
                return lvl ? lvl.kode : '?';
            });
            levelBadges = levelNames.map(name => `<span class="badge-level">${name}</span>`).join(' ');
        }

        const roles = (menu.allowed_roles || []).join(', ');

        return `
            <tr style="${!menu.is_active ? 'opacity:0.6; background:#f9f9f9;' : ''}">
                <td>
                    <i class="${menu.icon_class}" style="margin-right:5px;"></i> 
                    <strong>${menu.title}</strong>
                    <br><small style="color:#666;">${menu.route}</small>
                </td>
                <td><span class="badge ${menu.category}">${menu.category.toUpperCase()}</span></td>
                <td>${roles}</td>
                <td>${levelBadges}</td>
                <td>${menu.is_active ? '✅ Aktif' : '❌ Nonaktif'}</td>
                <td>
                    <button class="btn-primary btn-edit" data-id="${menu.id}" style="padding:5px 10px; font-size:0.8em;">Edit</button>
                    <button class="logout btn-delete" data-id="${menu.id}" style="padding:5px 10px; font-size:0.8em;">Hapus</button>
                </td>
            </tr>
        `;
    }).join('');
}

// --- ACTIONS ---

async function saveMenu() {
    const id = document.getElementById('menu-id').value;
    
    // Ambil Data Simple
    const payload = {
        title: document.getElementById('menu-title').value,
        route: document.getElementById('menu-route').value,
        category: document.getElementById('menu-category').value,
        icon_class: document.getElementById('menu-icon').value,
        order_index: parseInt(document.getElementById('menu-order').value) || 0,
        is_active: document.getElementById('menu-active').checked
    };

    // Ambil Checkbox Role
    const selectedRoles = Array.from(document.querySelectorAll('.cb-role:checked')).map(cb => cb.value);
    payload.allowed_roles = selectedRoles;

    // Ambil Checkbox Level
    // AMAN: Kita hanya mengambil ID level yang dipilih user, tidak mengubah data level.
    const selectedLevels = Array.from(document.querySelectorAll('.cb-level:checked')).map(cb => cb.value);
    payload.allowed_level_ids = selectedLevels.length > 0 ? selectedLevels : null;

    if (!payload.title || !payload.route) {
        alert("Judul dan Route wajib diisi!");
        return;
    }

    let error;
    if (id) {
        // UPDATE tabel APP_MENUS (Bukan tabel Levels)
        ({ error } = await supabase.from('app_menus').update(payload).eq('id', id));
    } else {
        // INSERT tabel APP_MENUS
        ({ error } = await supabase.from('app_menus').insert([payload]));
    }

    if (error) {
        alert("Gagal: " + error.message);
    } else {
        alert("Berhasil disimpan!");
        closeModal();
        fetchMenus();
    }
}

async function deleteMenu(id) {
    if (!confirm("Hapus menu ini permanen?")) return;
    const { error } = await supabase.from('app_menus').delete().eq('id', id);
    if (!error) fetchMenus();
    else alert("Gagal hapus: " + error.message);
}

// --- MODAL LOGIC ---

function openModal(menu = null) {
    const modal = document.getElementById('modal-menu');
    modal.style.display = 'flex';

    if (menu) {
        // Mode Edit
        document.getElementById('modal-title').innerText = "Edit Menu";
        document.getElementById('menu-id').value = menu.id;
        document.getElementById('menu-title').value = menu.title;
        document.getElementById('menu-route').value = menu.route;
        document.getElementById('menu-category').value = menu.category;
        document.getElementById('menu-icon').value = menu.icon_class;
        document.getElementById('menu-order').value = menu.order_index;
        document.getElementById('menu-active').checked = menu.is_active;

        // Set Checkbox Roles
        document.querySelectorAll('.cb-role').forEach(cb => {
            cb.checked = menu.allowed_roles && menu.allowed_roles.includes(cb.value);
        });

        // Set Checkbox Levels
        document.querySelectorAll('.cb-level').forEach(cb => {
            cb.checked = menu.allowed_level_ids && menu.allowed_level_ids.includes(cb.value);
        });

    } else {
        // Mode Create Baru
        document.getElementById('modal-title').innerText = "Tambah Menu Baru";
        document.getElementById('menu-id').value = '';
        document.querySelectorAll('input[type="text"], input[type="number"]').forEach(i => i.value = '');
        document.getElementById('menu-order').value = 1;
        document.getElementById('menu-active').checked = true;
        document.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
        document.getElementById('menu-active').checked = true; 
    }
}

function closeModal() {
    document.getElementById('modal-menu').style.display = 'none';
}

function setupEventListeners() {
    document.getElementById('btn-add-menu').addEventListener('click', () => openModal());
    document.getElementById('btn-cancel').addEventListener('click', closeModal);
    document.getElementById('btn-save').addEventListener('click', saveMenu);

    document.getElementById('menu-table-body').addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        if (e.target.classList.contains('btn-edit')) {
            const menu = allMenus.find(m => m.id === id);
            openModal(menu);
        }
        if (e.target.classList.contains('btn-delete')) {
            deleteMenu(id);
        }
    });
}