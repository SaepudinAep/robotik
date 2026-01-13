// v1.0 - absensi_sekolah.js (versi baru)
// --------------------------------------
// Koneksi Supabase
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseKey } from './config.js';

const supabase = createClient(supabaseUrl, supabaseKey);

// Ambil elemen container untuk card kelas
const container = document.getElementById("class-container");

// Fungsi ambil data kelas dari Supabase
async function loadClasses() {
  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, name, jadwal, school_name");

  if (error) {
    console.error("Gagal ambil data kelas:", error.message);
    return;
  }

  // Render card kelas
  classes.forEach(cls => {
    const card = document.createElement("div");
    card.className = "class-card";
    card.textContent = `${cls.name} - ${cls.school_name}`;

    // Event klik card
    card.addEventListener("click", () => {
      // Simpan data ke localStorage
      localStorage.setItem("activeClassId", cls.id);
      localStorage.setItem("activeClassName", cls.name);
      localStorage.setItem("activeSchoolName", cls.school_name);
      localStorage.setItem("activeClassJadwal", cls.jadwal);

      // Redirect ke halaman absensi kelas
      window.location.href = "absensi_kelas.html";
    });

    container.appendChild(card);
  });
}

// Jalankan fungsi saat halaman dimuat
document.addEventListener("DOMContentLoaded", loadClasses);