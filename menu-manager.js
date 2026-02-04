import { supabaseUrl, supabaseKey } from './config.js';

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// State Global
let allMenus = [];
let allLevels = [];
let allCategories = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cek Login
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'index.html';

    // 2. Cek Role Admin
    const { data: user } = await supabase.from('user_profiles').select('role').eq('id', session.user.id).single();
    if (user.role !== 'super_admin') {
        alert("Akses Ditolak!");
        window.location.href = 'dashboard.html';
        return;
    }

    // 3. Load Data
    await loadAllData();
    setupEventListeners();
});

async function loadAllData() {
    await fetchCategories();
    await fetchLevels();
    await fetchMenus();
}

// --- DATA FETCHING ---

async function fetchCategories() {
    // Ambil semua kolom termasuk target_app
    const { data } = await supabase.from('menu_categories').select('*').order('order_index', { ascending: true });
    if (data) {
        allCategories = data;
        renderCategoryOptions(); 
        renderCategoryListModal(); 
    }
}

async function fetchLevels() {
    const { data } = await supabase.from('levels').select('id, kode').order('kode');
    if (data) {
        allLevels = data;
        renderLevelCheckboxes();
    }
}

async function fetchMenus() {
    const { data, error } = await supabase.from('app_menus').select('*').order('order_index', { ascending: true });
    if (error) {
        alert('Gagal ambil menu: ' + error.message);
    } else {
        allMenus = data;
        renderMenuTable();
    }
}

// --- RENDERING MAIN TABLE ---

function renderMenuTable() {
    const container = document.getElementById('menu-table-body');
    container.innerHTML = '';

    allCategories.forEach(cat => {
        const menusInCategory = allMenus.filter(m => m.category === cat.category_key);
        
        // Header Kategori (Tampilkan juga Targetnya dimana)
        let targetLabel = '';
        if(cat.target_app === 'admin') targetLabel = '<span style="font-size:0.7em; background:#3f51b5; color:white; padding:2px 5px; border-radius:3px; margin-left:10px;">ADMIN ONLY</span>';
        else if(cat.target_app === 'public') targetLabel = '<span style="font-size:0.7em; background:#4caf50; color:white; padding:2px 5px; border-radius:3px; margin-left:10px;">PUBLIC ONLY</span>';
        else targetLabel = '<span style="font-size:0.7em; background:#ff9800; color:white; padding:2px 5px; border-radius:3px; margin-left:10px;">ALL APPS</span>';

        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `<td colspan="6" style="background-color:#e3f2fd; font-weight:bold; padding:15px 10px; color:#1565c0;">
            <i class="fa-solid fa-layer-group"></i> ${cat.title} ${targetLabel}
        </td>`;
        container.appendChild(headerRow);

        if (menusInCategory.length === 0) {
            container.innerHTML += `<tr><td colspan="6" style="text-align:center; color:#999; font-style:italic; padding:10px;">Belum ada menu di kategori ini</td></tr>`;
        } else {
            menusInCategory.forEach(menu => {
                const isActive = menu.is_active ? '<span style="color:green; font-weight:bold;">Aktif</span>' : '<span style="color:red;">Non-Aktif</span>';
                const roleBadges = (menu.allowed_roles || []).map(r => `<span class="badge" style="background:#eee; color:#333; font-size:0.8em; padding:2px 5px; margin-right:2px; border-radius:3px;">${r}</span>`).join('');
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="text-align:center;">${menu.order_index}</td>
                    <td style="text-align:center;"><i class="${menu.icon_class}"></i></td>
                    <td><strong>${menu.title}</strong><br><small style="color:#666;">${menu.route}</small></td>
                    <td>${roleBadges}</td>
                    <td>${isActive}</td>
                    <td>
                        <button class="btn-primary btn-edit" data-id="${menu.id}" style="padding:4px 8px; font-size:0.8rem;">Edit</button>
                        <button class="logout btn-delete" data-id="${menu.id}" style="padding:4px 8px; font-size:0.8rem;">Hapus</button>
                    </td>
                `;
                container.appendChild(row);
            });
        }
    });
}

// --- RENDERING UTILS ---

function renderCategoryOptions() {
    const selectCat = document.getElementById('menu-category');
    selectCat.innerHTML = '<option value="">-- Pilih Kategori --</option>';
    allCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.category_key;
        option.textContent = `${cat.title} (${cat.target_app.toUpperCase()})`;
        selectCat.appendChild(option);
    });
}

function renderCategoryListModal() {
    const container = document.getElementById('category-list-container');
    container.innerHTML = '';
    
    allCategories.forEach(cat => {
        // Tentukan Warna Badge Target
        let badgeColor = '#999';
        let badgeText = 'Unknown';
// Di dalam menu-manager.js fungsi renderCategoryListModal()
      if(cat.target_app === 'admin') { badgeColor = '#3f51b5'; badgeText = 'ADMIN'; } 
      else if(cat.target_app === 'admin_v2') { badgeColor = '#4d97ff'; badgeText = 'ADMIN V2'; } // Tambah ini
      else if(cat.target_app === 'public') { badgeColor = '#4caf50'; badgeText = 'PUBLIC'; } 
      else if(cat.target_app === 'all') { badgeColor = '#ff9800'; badgeText = 'ALL'; }

        const div = document.createElement('div');
        div.className = 'cat-list-item';
        div.innerHTML = `
            <div>
                <strong>${cat.title}</strong> 
                <span class="cat-badge">${cat.category_key}</span>
                <span class="target-badge" style="background:${badgeColor};">${badgeText}</span>
                <br><small style="color:#666;">Urutan: ${cat.order_index}</small>
            </div>
            <div>
                <button onclick="window.editCategory('${cat.id}')" style="background:#FFC107; color:#333; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; margin-right:5px;">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button onclick="window.deleteCategory('${cat.id}')" style="background:#ff5252; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderLevelCheckboxes() {
    const container = document.getElementById('container-cb-levels');
    container.innerHTML = allLevels.map(l => `
        <label class="checkbox-item"><input type="checkbox" class="cb-level" value="${l.id}"> Level ${l.kode}</label>
    `).join('');
}

// --- LOGIC MENU CRUD ---

function openModal(menu = null) {
    document.getElementById('modal-menu').style.display = 'block';
    
    if (menu) {
        document.getElementById('modal-title').innerText = "Edit Menu";
        document.getElementById('menu-id').value = menu.id;
        document.getElementById('menu-title').value = menu.title;
        document.getElementById('menu-route').value = menu.route;
        document.getElementById('menu-category').value = menu.category;
        document.getElementById('menu-icon').value = menu.icon_class;
        document.getElementById('menu-order').value = menu.order_index;
        document.getElementById('menu-active').checked = menu.is_active;
        
        document.querySelectorAll('.cb-role').forEach(cb => cb.checked = menu.allowed_roles?.includes(cb.value));
        document.querySelectorAll('.cb-level').forEach(cb => cb.checked = menu.allowed_level_ids?.includes(cb.value));
    } else {
        document.getElementById('modal-title').innerText = "Tambah Menu Baru";
        document.getElementById('menu-id').value = '';
        document.querySelectorAll('#modal-menu input[type="text"], #modal-menu input[type="number"]').forEach(i => i.value = '');
        document.getElementById('menu-order').value = 1;
        document.getElementById('menu-active').checked = true;
        document.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
        document.getElementById('menu-active').checked = true; 
    }
}

async function saveMenu() {
    const id = document.getElementById('menu-id').value;
    const title = document.getElementById('menu-title').value;
    const route = document.getElementById('menu-route').value;
    const category = document.getElementById('menu-category').value;
    const icon = document.getElementById('menu-icon').value;
    const order = document.getElementById('menu-order').value;
    const isActive = document.getElementById('menu-active').checked;
    
    const roles = Array.from(document.querySelectorAll('.cb-role:checked')).map(cb => cb.value);
    const levelIds = Array.from(document.querySelectorAll('.cb-level:checked')).map(cb => cb.value);

    if (!title || !route || !category) return alert("Data wajib diisi!");

    const payload = { title, route, category, icon_class: icon, order_index: parseInt(order), allowed_roles: roles, allowed_level_ids: levelIds.length ? levelIds : null, is_active: isActive };
    
    const { error } = id 
        ? await supabase.from('app_menus').update(payload).eq('id', id)
        : await supabase.from('app_menus').insert([payload]);

    if (error) alert("Error: " + error.message);
    else { document.getElementById('modal-menu').style.display='none'; fetchMenus(); }
}

async function deleteMenu(id) {
    if(confirm("Hapus menu ini?")) {
        await supabase.from('app_menus').delete().eq('id', id);
        fetchMenus();
    }
}

// --- LOGIC CATEGORY CRUD (FIXED EDIT & TARGET APP) ---

// 1. Fungsi Edit Category
window.editCategory = function(id) {
    const cat = allCategories.find(c => c.id === id);
    if(!cat) return;

    // Isi Form
    document.getElementById('cat-id').value = cat.id;
    document.getElementById('cat-title').value = cat.title;
    document.getElementById('cat-key').value = cat.category_key;
    document.getElementById('cat-order').value = cat.order_index;
    
    // Set Dropdown Target
    document.getElementById('cat-target').value = cat.target_app || 'admin'; 

    // UI Mode Edit
    document.getElementById('cat-form-title').innerText = "Edit Kategori";
    document.getElementById('btn-save-cat').innerText = "Update Kategori";
    document.getElementById('btn-cancel-cat').style.display = "block";
}

// 2. Fungsi Reset Form / Batal
function resetCategoryForm() {
    document.getElementById('cat-id').value = '';
    document.getElementById('cat-title').value = '';
    document.getElementById('cat-key').value = '';
    document.getElementById('cat-order').value = '10';
    document.getElementById('cat-target').value = 'admin';

    document.getElementById('cat-form-title').innerText = "Tambah Baru";
    document.getElementById('btn-save-cat').innerText = "Simpan Kategori";
    document.getElementById('btn-cancel-cat').style.display = "none";
}

// 3. Fungsi Simpan (Insert/Update)
async function saveCategory() {
    const id = document.getElementById('cat-id').value;
    const title = document.getElementById('cat-title').value;
    const key = document.getElementById('cat-key').value.toLowerCase().replace(/\s/g, '');
    const order = document.getElementById('cat-order').value;
    const target = document.getElementById('cat-target').value;

    if(!title || !key) return alert("Judul dan Key wajib diisi!");

    const payload = { 
        title, 
        category_key: key, 
        order_index: parseInt(order),
        target_app: target // <--- INI KUNCI PEMISAH REPO
    };

    let error;
    if (id) {
        // Update
        const res = await supabase.from('menu_categories').update(payload).eq('id', id);
        error = res.error;
    } else {
        // Create
        const res = await supabase.from('menu_categories').insert([payload]);
        error = res.error;
    }
    
    if(error) {
        alert("Gagal: " + error.message);
    } else {
        resetCategoryForm();
        await fetchCategories();
        await fetchMenus(); 
    }
}

// 4. Delete Category
window.deleteCategory = async function(id) {
    if(!confirm("Yakin hapus kategori ini? Menu di dalamnya mungkin akan hilang/error.")) return;
    const { error } = await supabase.from('menu_categories').delete().eq('id', id);
    if(error) alert("Gagal: " + error.message);
    else { await fetchCategories(); await fetchMenus(); }
}

// --- EVENTS ---

function setupEventListeners() {
    // Menu Events
    document.getElementById('btn-add-menu').addEventListener('click', () => openModal());
    document.getElementById('btn-cancel').addEventListener('click', () => document.getElementById('modal-menu').style.display='none');
    document.getElementById('btn-save').addEventListener('click', saveMenu);
    
    document.getElementById('menu-table-body').addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-edit')) openModal(allMenus.find(m => m.id === e.target.dataset.id));
        if (e.target.classList.contains('btn-delete')) deleteMenu(e.target.dataset.id);
    });

    // Category Events
    document.getElementById('btn-manage-cat').addEventListener('click', () => document.getElementById('modal-categories').style.display='block');
    document.getElementById('btn-close-cat').addEventListener('click', () => document.getElementById('modal-categories').style.display='none');
    
    document.getElementById('btn-save-cat').addEventListener('click', saveCategory);
    document.getElementById('btn-cancel-cat').addEventListener('click', resetCategoryForm);
}