<!-- sekolah.html -->
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Manajemen Sekolah</title>
  <link rel="stylesheet" href="style.css" />
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #f9f9f9; }
    h1 { margin-bottom: 1rem; }
    form { background: #fff; padding: 1rem; border-radius: 8px; box-shadow: 0 0 5px #ccc; margin-bottom: 2rem; }
    label { display: block; margin-top: 1rem; }
    input, textarea { width: 100%; padding: 0.5rem; margin-top: 0.25rem; }
    button { margin-top: 1rem; padding: 0.5rem 1rem; }
    table { width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 0 5px #ccc; }
    th, td { padding: 0.75rem; border: 1px solid #ddd; text-align: left; }
    tr.active { background: #e0f7fa; }
    .actions button { margin-right: 0.5rem; }
    .notif { margin-bottom: 1rem; padding: 0.75rem; border-radius: 5px; }
    .notif.success { background: #e0fbe0; color: #2e7d32; }
    .notif.error { background: #fdecea; color: #c62828; }
  </style>
</head>
<body>
  <h1>Manajemen Sekolah</h1>
  <a href="dashboard.html">⬅️ Kembali ke Dashboard</a>

  <div id="notif" class="notif" style="display:none;"></div>

  <form id="school-form">
    <input type="hidden" id="edit_id" />
    <label>Nama Sekolah</label>
    <input type="text" id="name" required />

    <label>Alamat</label>
    <textarea id="address" required></textarea>

    <label>
      <input type="checkbox" id="is_active" />
      Jadikan sekolah aktif
    </label>

    <button type="submit">💾 Simpan</button>
    <button type="reset" onclick="resetForm()">Batal</button>
  </form>

  <table>
    <thead>
      <tr>
        <th>Nama</th>
        <th>Alamat</th>
        <th>Aktif</th>
        <th>Aksi</th>
      </tr>
    </thead>
    <tbody id="school-table"></tbody>
  </table>

  <script type="module" src="sekolah.js"></script>
</body>
</html>// sekolah.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabase = createClient('https://YOUR_PROJECT.supabase.co', 'YOUR_PUBLIC_ANON_KEY');

const form = document.getElementById('school-form');
const table = document.getElementById('school-table');
const notif = document.getElementById('notif');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = form.name.value.trim();
  const address = form.address.value.trim();
  const is_active = form.is_active.checked;
  const edit_id = form.edit_id.value;

  if (!name || !address) return showNotif('Nama dan alamat wajib diisi', 'error');

  const { data: session } = await supabase.auth.getSession();
  const user_id = session?.session?.user?.id;
  if (!user_id) return showNotif('Anda belum login', 'error');

  if (is_active) {
    await supabase.from('schools').update({ is_active: false }).eq('user_id', user_id);
  }

  if (edit_id) {
    await supabase.from('schools').update({ name, address, is_active }).eq('id', edit_id);
    showNotif('Sekolah berhasil diperbarui', 'success');
  } else {
    await supabase.from('schools').insert([{ name, address, is_active, user_id }]);
    showNotif('Sekolah berhasil ditambahkan', 'success');
  }

  resetForm();
  loadSchools();
});

window.editSekolah = (s) => {
  form.name.value = s.name;
  form.address.value = s.address;
  form.is_active.checked = s.is_active;
  form.edit_id.value = s.id;
};

window.setActive = async (id) => {
  const { data: session } = await supabase.auth.getSession();
  const user_id = session?.session?.user?.id;
  await supabase.from('schools').update({ is_active: false }).eq('user_id', user_id);
  await supabase.from('schools').update({ is_active: true }).eq('id', id);
  showNotif('Sekolah diaktifkan', 'success');
  loadSchools();
};

window.hapus = async (id) => {
  if (!confirm('Yakin ingin menghapus sekolah ini?')) return;
  await supabase.from('schools').delete().eq('id', id);
  showNotif('Sekolah dihapus', 'success');
  loadSchools();
};

function resetForm() {
  form.reset();
  form.edit_id.value = '';
}

function showNotif(msg, type) {
  notif.textContent = msg;
  notif.className = `notif ${type}`;
  notif.style.display = 'block';
  setTimeout(() => notif.style.display = 'none', 3000);
}

async function loadSchools() {
  const { data: session } = await supabase.auth.getSession();
  const user_id = session?.session?.user?.id;
  const { data, error } = await supabase.from('schools').select('*').eq('user_id', user_id).order('created_at', { ascending: false });

  table.innerHTML = '';
  data.forEach((s) => {
    const row = document.createElement('tr');
    if (s.is_active) row.classList.add('active');
    row.innerHTML = `
      <td>${s.name}</td>
      <td>${s.address}</td>
      <td>${s.is_active ? '✅' : ''}</td>
      <td class="actions">
        <button onclick='editSekolah(${JSON.stringify(s)})'>✏️</button>
        <button onclick="setActive('${s.id}')">Aktifkan</button>
        <button onclick="hapus('${s.id}')">🗑️</button>
      </td>
    `;
    table.appendChild(row);
  });
}

loadSchools();