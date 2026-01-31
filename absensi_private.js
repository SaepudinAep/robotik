import { supabase } from './config.js';

const privateClassGrid = document.getElementById('private-class-grid');

async function loadPrivateClasses() {
  try {
    // 1. Ambil data kelas dengan relasi level secara akurat
    const { data, error } = await supabase
      .from('class_private')
      .select(`
        id, 
        name, 
        level_id,
        levels (id, kode)
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
  privateClassGrid.innerHTML = '';
  
  classes.forEach(cls => {
    const card = document.createElement('div');
    card.className = 'card'; 
    
    card.innerHTML = `
      <h3>${cls.name}</h3>
      <p>📍 Level: ${cls.levels?.kode || 'Privat'}</p>
    `;

    card.onclick = () => {
      // PENTING: Bersihkan data lama agar tidak terjadi bentrokan (data siswa melompat)
      localStorage.removeItem("activePrivateClassId");
      localStorage.removeItem("activeLevelId");
      localStorage.removeItem("activeLevelKode");
      localStorage.removeItem("activeClassName");

      // Simpan data baru yang benar-benar fresh dari klik user
      localStorage.setItem("activePrivateClassId", cls.id);
      localStorage.setItem("activeLevelId", cls.level_id); 
      localStorage.setItem("activeLevelKode", cls.levels?.kode || "");
      localStorage.setItem("activeClassName", cls.name);

      console.log("Menuju monitoring untuk kelas:", cls.name);
      window.location.href = 'absensiMonitoring.html';
    };

    privateClassGrid.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', loadPrivateClasses);