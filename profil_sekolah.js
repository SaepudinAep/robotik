// profil_sekolah.js
import { supabase } from './config.js';

// Ambil elemen HTML
const form = document.getElementById('school-form');
const listEl = document.getElementById('school-list');
const deleteModal = document.getElementById('delete-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete');
const cancelDeleteBtn = document.getElementById('cancel-delete');

let deleteTargetId = null;

// Fungsi: ambil semua data sekolah
async function loadSchools() {
  console.log('🔄 Memuat data sekolah...');
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, address')
    .order('name');

  if (error) {
    console.error('❌ Error loadSchools:', error);
    listEl.innerHTML = '<tr><td colspan="3">Gagal memuat data sekolah</td></tr>';
    return;
  }

  if (!data || data.length === 0) {
    console.warn('⚠️ Tidak ada data sekolah.');
    listEl.innerHTML = '<tr><td colspan="3">Belum ada sekolah</td></tr>';
    return;
  }

  renderSchoolList(data);
}

// Fungsi: tampilkan daftar sekolah ke tabel
function renderSchoolList(data) {
  listEl.innerHTML = data.map(s => `
    <tr>
      <td>${s.name}</td>
      <td>${s.address}</td>
      <td>
        <button class="btn-edit" data-id="${s.id}">Edit</button>
        <button class="btn-delete" data-id="${s.id}">Hapus</button>
      </td>
    </tr>
  `).join('');

  // Tambahkan event listener ke tombol edit/hapus
  document.querySelectorAll('.btn-edit').forEach(btn =>
    btn.addEventListener('click', () => editSchool(btn.dataset.id))
  );
  document.querySelectorAll('.btn-delete').forEach(btn =>
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.id))
  );
}

// Fungsi: tambah atau update sekolah
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = form.school_name.value.trim();
  const address = form.school_address.value.trim();

  if (!name || !address) {
    alert('Nama dan alamat wajib diisi');
    return;
  }

  try {
    if (form.dataset.editId) {
      // Update sekolah
      const { error } = await supabase
        .from('schools')
        .update({ name, address })
        .eq('id', form.dataset.editId);
      if (error) throw error;
      alert('Sekolah berhasil diupdate');
      form.dataset.editId = '';
    } else {
      // Tambah sekolah baru
      const { error } = await supabase
        .from('schools')
        .insert([{ name, address }]);
      if (error) throw error;
      alert('Sekolah berhasil ditambahkan');
    }
    form.reset();
    loadSchools();
  } catch (err) {
    console.error('❌ Error simpan sekolah:', err);
    alert('Gagal menyimpan data');
  }
});

// Fungsi: edit sekolah
async function editSchool(id) {
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, address')
    .eq('id', id)
    .single();

  if (error) {
    console.error('❌ Error editSchool:', error);
    alert('Gagal mengambil data sekolah');
    return;
  }
  form.school_name.value = data.name;
  form.school_address.value = data.address;
  form.dataset.editId = id;
}

// Fungsi: hapus sekolah
function openDeleteModal(id) {
  deleteTargetId = id;
  deleteModal.style.display = 'block';
}

confirmDeleteBtn.addEventListener('click', async () => {
  if (!deleteTargetId) return;

  try {
    const { error } = await supabase
      .from('schools')
      .delete()
      .eq('id', deleteTargetId);
    if (error) throw error;
    alert('Sekolah berhasil dihapus');
    deleteTargetId = null;
    deleteModal.style.display = 'none';
    loadSchools();
  } catch (err) {
    console.error('❌ Error hapus sekolah:', err);
    alert('Gagal menghapus sekolah');
  }
});

cancelDeleteBtn.addEventListener('click', () => {
  deleteTargetId = null;
  deleteModal.style.display = 'none';
});

// Jalankan saat halaman selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
  loadSchools();
});