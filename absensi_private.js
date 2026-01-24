import { supabase } from './config.js';

const privateClassGrid = document.getElementById('private-class-grid');

async function loadPrivateClasses() {
  try {
    // Ambil data kelas dan gabungkan dengan tabel levels untuk mendapatkan 'kode' warna
    const { data, error } = await supabase
      .from('class_private')
      .select(`
        id, 
        name, 
        level_id,
        levels (id, kode),
        group_private (code)
      `);

    if (error) throw error;
    
    if (!data || data.length === 0) {
      privateClassGrid.innerHTML = '<p class="empty-state">Belum ada kelas private terdaftar.</p>';
      return;
    }

    renderCards(data);
  } catch (err) {
    console.error('Gagal memuat kelas private:', err);
    privateClassGrid.innerHTML = `<p class="error">Gagal memuat data: ${err.message}</p>`;
  }
}
function renderCards(classes) {
  const container = document.getElementById('private-class-grid');
  container.innerHTML = '';
  
  classes.forEach(cls => {
    const card = document.createElement('div');
    card.className = 'card'; // Otomatis diwarnai oleh nth-child di CSS
    
    card.innerHTML = `
      <h3>${cls.name}</h3>
      <p>📍 ${cls.levels?.kode || 'Privat'}</p>
      <small style="margin-top:10px; display:block; opacity:0.8;">
        ${cls.level || ''}
      </small>
    `;

card.onclick = () => {
  localStorage.setItem("activePrivateClassId", cls.id);
  // Simpan juga Level ID dan Kode Level agar bisa digunakan di halaman monitoring
  localStorage.setItem("activeLevelId", cls.level_id); 
  localStorage.setItem("activeLevelKode", cls.levels?.kode || "");
  window.location.href = 'absensiMonitoring.html';
};

    container.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', loadPrivateClasses);