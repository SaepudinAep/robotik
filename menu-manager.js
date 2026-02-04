/**
 * Project: Menu Manager (Admin V2)
 * Update: Fixed UUID Logic (Category ID Binding)
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { supabaseUrl, supabaseKey } from './config.js';

const supabase = createClient(supabaseUrl, supabaseKey);

// State Global
let allMenus = [];
let allLevels = [];
let allCategories = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cek Login
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    // 2. Cek Role Admin (Double Security)
    const { data: user } = await supabase.from('user_profiles').select('role').eq('id', session.user.id).single();
    if (!user || user.role !== 'super_admin') {
        alert("Akses Ditolak! Hanya Super Admin.");
        window.location.href = 'index.html'; // Lempar keluar jika bukan admin
        return;
    }

    // 3. Load Data
    await loadAllData();
    setupEventListeners();
});

async function loadAllData() {
    // Urutan penting: Level & Kategori dulu, baru Menu (biar mapping lancar)
    await Promise.all([fetchCategories(), fetchLevels()]);
    await fetchMenus();
}

// --- DATA FETCHING ---

async function fetchCategories() {
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

// --- RENDERING MAIN TABLE (FIXED UUID LOGIC) ---

function renderMenuTable() {
    const container = document.getElementById('menu-table-body');
    if (!container) return; // Guard clause jika elemen tidak ada
    container.innerHTML = '';

    allCategories.forEach(cat => {
        // [FIX UTAMA] Filter menggunakan ID (UUID), bukan Text Key
        const menusInCategory = allMenus.filter(m => m.category == cat.id);
        
        // Label Target App
        let targetLabel = '';
        if(cat.target_app === 'admin') targetLabel = '<span style="font-size:0.7em; background:#3f51b5; color:white; padding:2px 5px; border-radius:3px; margin-left:10px;">ADMIN (OLD)</span>';
        else if(cat.target_app === 'admin_v2') targetLabel = '<span style="font-size:0.7em; background:#4d97ff; color:white; padding:2px 5px; border-radius:3px; margin-left:10px;">ADMIN V2</span>';
        else if(cat.target_app === 'public') targetLabel = '<span style="font-size:0.7em; background:#4caf50; color:white; padding:2px 5px; border-radius:3px; margin-left:10px;">PUBLIC / SISWA</span>';
        else targetLabel = '<span style="font-size:0.7em; background:#ff9800; color:white; padding:2px 5px; border-radius:3px; margin-left:10px;">ALL APPS</span>';

        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `<td colspan="6" style="background-color:#e3f2fd; font-weight:bold; padding:15px 10px; color:#1565c0; border-bottom:2px solid #bbdefb;">
            <i class="fa-solid fa-layer-group"></i> ${cat.title} ${targetLabel} 
            <small style="color:#666; font-weight:normal;">(Key: ${cat.category_key})</small>
        </td>`;
        container.appendChild(headerRow);

        if (menusInCategory.length === 0) {
            container.innerHTML += `<tr><td colspan="6" style="text-align:center; color:#999; font-style:italic; padding:15px;">Belum ada menu di kategori ini</td></tr>`;
        } else {
            menusInCategory.sort((a,b) => a.order_index - b.order_index).forEach(menu => {
                const isActive = menu.is_active 
                    ? '<span style="color:green; font-weight:bold; background:#e8f5e9; padding:2px 6px; border-radius:4px;">Aktif</span>' 
                    : '<span style="color:red; background:#ffebee; padding:2px 6px; border-radius:4px;">Mati</span>';
                
                // Parsing Roles safely
                let roles = [];
                try { roles = typeof menu.allowed_roles === 'string' ? JSON.parse(menu.allowed_roles) : menu.allowed_roles; } catch(e){}
                const roleBadges = Array.isArray(roles) 
                    ? roles.map(r => `<span class="badge" style="background:#f5f5f5; border:1px solid #ddd; color:#333; font-size:0.75em; padding:2px 5px; margin-right:2px; border-radius:3px;">${r}</span>`).join('')
                    : '-';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="text-align:center;">${menu.order_index}</td>
                    <td style="text-align:center;"><i class="${menu.icon_class}" style="font-size:1.2em; color:#555;"></i></td>
                    <td>
                        <strong style="font-size:0.95em;">${menu.title}</strong><br>
                        <small style="color:#888; font-family:monospace;">${menu.route}</small>
                    </td>
                    <td>${roleBadges}</td>
                    <td>${isActive}</td>
                    <td style="text-align:right;">
                        <button class="btn-primary btn-edit" data-id="${menu.id}" style="padding:5px 10px; font-size:0.8rem; border:none; background:#ffca28; color:#333; border-radius:4px; cursor:pointer; margin-right:5px;">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="logout btn-delete" data-id="${menu.id}" style="padding:5px 10px; font-size:0.8rem; border:none; background:#ef5350; color:white; border-radius:4px; cursor:pointer;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
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
    if (!selectCat) return;

    selectCat.innerHTML = '<option value="">-- Pilih Kategori --</option>';
    allCategories.forEach(cat => {
        const option = document.createElement('option');
        // [FIX UTAMA] Value harus ID (UUID), bukan Text Key
        option.value = cat.id; 
        option.textContent = `${cat.title} (${cat.target_app.toUpperCase()})`;
        selectCat.appendChild(option);
    });
}

function renderCategoryListModal() {
    const container = document.getElementById('category-list-container');
    if (!container) return;
    container.innerHTML = '';
    
    allCategories.forEach(cat => {
        // Warna Badge Target App
        let badgeColor = '#999';
        let badgeText = 'Unknown';
        
        if(cat.target_app === 'admin') { badgeColor = '#3f51b5'; badgeText = 'ADMIN (OLD)'; } 
        else if(cat.target_app === 'admin_v2') { badgeColor = '#4d97ff'; badgeText = 'ADMIN V2'; }
        else if(cat.target_app === 'public') { badgeColor = '#4caf50'; badgeText = 'PUBLIC'; } 
        else if(cat.target_app === 'all') { badgeColor = '#ff9800'; badgeText = 'ALL'; }

        const div = document.createElement('div');
        div.className = 'cat-list-item';
        div.style.cssText = "display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding:10px 0;";
        div.innerHTML = `
            <div>
                <strong style="font-size:1rem;">${cat.title}</strong> 
                <span style="background:#eee; padding:2px 6px; border-radius:4px; font-size:0.8em; color:#555;">${cat.category_key}</span>
                <span style="background:${badgeColor}; color:white; padding:2px 6px; border-radius:4px; font-size:0.7em; font-weight:bold;">${badgeText}</span>
                <br><small style="color:#666;">Urutan: ${cat.order_index}</small>
            </div>
            <div>
                <button onclick="window.editCategory('${cat.id}')" style="background:#FFC107; color:#333; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; margin-right:5px;">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button onclick="window.deleteCategory('${cat.id}')" style="background:#ff5252; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderLevelCheckboxes() {
    const container = document.getElementById('container-cb-levels');
    if (!container) return;
    container.innerHTML = allLevels.map(l => `
        <label class="checkbox-item" style="display:inline-block; margin-right:10px; margin-bottom:5px;">
            <input type="checkbox" class="cb-level" value="${l.id}"> Level ${l.kode}
        </label>
    `).join('');
}

// --- LOGIC MENU CRUD ---

function openModal(menu = null) {
    const modal = document.getElementById('modal-menu');
    if (!modal) return;
    modal.style.display = 'block';
    
    if (menu) {
        document.getElementById('modal-title').innerText = "Edit Menu";
        document.getElementById('menu-id').value = menu.id;
        document.getElementById('menu-title').value = menu.title;
        document.getElementById('menu-route').value = menu.route;
        
        // [FIX] Ini sekarang mengisi UUID ke dropdown
        document.getElementById('menu-category').value = menu.category; 
        
        document.getElementById('menu-icon').value = menu.icon_class;
        document.getElementById('menu-order').value = menu.order_index;
        document.getElementById('menu-active').checked = menu.is_active;
        
        // Handle Roles Checkbox
        let roles = [];
        try { roles = typeof menu.allowed_roles === 'string' ? JSON.parse(menu.allowed_roles) : menu.allowed_roles; } catch(e){}
        document.querySelectorAll('.cb-role').forEach(cb => cb.checked = Array.isArray(roles) && roles.includes(cb.value));

        // Handle Levels Checkbox
        let levels = [];
        try { levels = typeof menu.allowed_level_ids === 'string' ? JSON.parse(menu.allowed_level_ids) : menu.allowed_level_ids; } catch(e){}
        document.querySelectorAll('.cb-level').forEach(cb => cb.checked = Array.isArray(levels) && levels.includes(cb.value));

    } else {
        document.getElementById('modal-title').innerText = "Tambah Menu Baru";
        document.getElementById('menu-id').value = '';
        
        // Reset Inputs
        const inputs = modal.querySelectorAll('input[type="text"], input[type="number"], select');
        inputs.forEach(i => i.value = '');
        
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
    const category = document.getElementById('menu-category').value; // Ini sekarang UUID
    const icon = document.getElementById('menu-icon').value;
    const order = document.getElementById('menu-order').value;
    const isActive = document.getElementById('menu-active').checked;
    
    const roles = Array.from(document.querySelectorAll('.cb-role:checked')).map(cb => cb.value);
    const levelIds = Array.from(document.querySelectorAll('.cb-level:checked')).map(cb => cb.value);

    if (!title || !route || !category) return alert("Judul, Route, dan Kategori wajib diisi!");

    const payload = { 
        title, 
        route, 
        category, // UUID dikirim ke DB
        icon_class: icon, 
        order_index: parseInt(order) || 0, 
        allowed_roles: roles, 
        allowed_level_ids: levelIds.length ? levelIds : null, 
        is_active: isActive 
    };
    
    const { error } = id 
        ? await supabase.from('app_menus').update(payload).eq('id', id)
        : await supabase.from('app_menus').insert([payload]);

    if (error) alert("Error: " + error.message);
    else { 
        document.getElementById('modal-menu').style.display='none'; 
        fetchMenus(); 
    }
}

async function deleteMenu(id) {
    if(confirm("Hapus menu ini?")) {
        await supabase.from('app_menus').delete().eq('id', id);
        fetchMenus();
    }
}

// --- LOGIC CATEGORY CRUD (FIXED) ---

// 1. Edit Category
window.editCategory = function(id) {
    const cat = allCategories.find(c => c.id === id);
    if(!cat) return;

    document.getElementById('cat-id').value = cat.id;
    document.getElementById('cat-title').value = cat.title;
    document.getElementById('cat-key').value = cat.category_key;
    document.getElementById('cat-order').value = cat.order_index;
    document.getElementById('cat-target').value = cat.target_app || 'admin'; 

    document.getElementById('cat-form-title').innerText = "Edit Kategori";
    document.getElementById('btn-save-cat').innerText = "Update";
    document.getElementById('btn-cancel-cat').style.display = "inline-block";
}

// 2. Reset Form
function resetCategoryForm() {
    document.getElementById('cat-id').value = '';
    document.getElementById('cat-title').value = '';
    document.getElementById('cat-key').value = '';
    document.getElementById('cat-order').value = '1';
    document.getElementById('cat-target').value = 'admin_v2'; // Default ke V2

    document.getElementById('cat-form-title').innerText = "Tambah Baru";
    document.getElementById('btn-save-cat').innerText = "Simpan Kategori";
    document.getElementById('btn-cancel-cat').style.display = "none";
}

// 3. Simpan Kategori
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
        order_index: parseInt(order) || 0,
        target_app: target 
    };

    let error;
    if (id) {
        const res = await supabase.from('menu_categories').update(payload).eq('id', id);
        error = res.error;
    } else {
        const res = await supabase.from('menu_categories').insert([payload]);
        error = res.error;
    }
    
    if(error) {
        alert("Gagal: " + error.message);
    } else {
        resetCategoryForm();
        await fetchCategories();
        // Refresh menu juga karena Dropdown Kategori di form menu perlu diupdate
        await fetchMenus(); 
    }
}

// 4. Delete Category
window.deleteCategory = async function(id) {
    if(!confirm("Yakin hapus kategori ini? Semua menu di dalamnya akan ikut terhapus (Cascade).")) return;
    const { error } = await supabase.from('menu_categories').delete().eq('id', id);
    if(error) alert("Gagal: " + error.message);
    else { await fetchCategories(); await fetchMenus(); }
}

// --- EVENTS ---

function setupEventListeners() {
    // Menu Events
    const btnAddMenu = document.getElementById('btn-add-menu');
    if (btnAddMenu) btnAddMenu.addEventListener('click', () => openModal());
    
    const btnCancelMenu = document.getElementById('btn-cancel');
    if (btnCancelMenu) btnCancelMenu.addEventListener('click', () => document.getElementById('modal-menu').style.display='none');
    
    const btnSaveMenu = document.getElementById('btn-save');
    if (btnSaveMenu) btnSaveMenu.addEventListener('click', saveMenu);
    
    // Delegation for Edit/Delete Buttons in Table
    const menuTableBody = document.getElementById('menu-table-body');
    if (menuTableBody) {
        menuTableBody.addEventListener('click', (e) => {
            const btnEdit = e.target.closest('.btn-edit');
            const btnDelete = e.target.closest('.btn-delete');
            
            if (btnEdit) openModal(allMenus.find(m => m.id === btnEdit.dataset.id));
            if (btnDelete) deleteMenu(btnDelete.dataset.id);
        });
    }

    // Category Events
    const btnManageCat = document.getElementById('btn-manage-cat');
    if (btnManageCat) btnManageCat.addEventListener('click', () => document.getElementById('modal-categories').style.display='block');
    
    const btnCloseCat = document.getElementById('btn-close-cat');
    if (btnCloseCat) btnCloseCat.addEventListener('click', () => document.getElementById('modal-categories').style.display='none');
    
    const btnSaveCat = document.getElementById('btn-save-cat');
    if (btnSaveCat) btnSaveCat.addEventListener('click', saveCategory);
    
    const btnCancelCat = document.getElementById('btn-cancel-cat');
    if (btnCancelCat) btnCancelCat.addEventListener('click', resetCategoryForm);
}