// v1.3.9 - draft_absensi.js
// --------------------------
// Import Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { supabaseUrl, supabaseKey } from './config.js';

const supabase = createClient(supabaseUrl, supabaseKey);

// === Part 1: Header Info ===
function renderHeader() {
  const schoolName = localStorage.getItem("activeSchoolName");
  const semester = localStorage.getItem("activeSemester");
  const year = localStorage.getItem("activeAcademicYear");
  const className = localStorage.getItem("activeClassName");
  const jadwal = localStorage.getItem("activeClassJadwal");

  document.getElementById("school-name").textContent = schoolName ?? "-";
  document.getElementById("semester-year").textContent = `${semester} — Tahun Ajaran ${year}`;
  document.getElementById("class-schedule").textContent = `${className} | Jadwal: ${jadwal ?? "-"}`;
}

// === Part 2: Tabel Absensi ===
async function renderAbsensiTable() {
  const classId = localStorage.getItem("activeClassId");

  const { data: students, error } = await supabase
    .from("students")
    .select("id, name, class_id, kelas")
    .eq("class_id", classId);

  if (error) {
    console.error("Gagal ambil data siswa:", error);
    return;
  }

  const tbody = document.querySelector("#absensi-table tbody");
  tbody.innerHTML = "";

  students.forEach((s, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${i + 1}</td>
      <td>${s.name}</td>
      <td>${s.kelas}</td>
    `;
    tbody.appendChild(row);
  });

  // Update summary
  document.getElementById("summary").textContent =
    `Jumlah Bulan ini: ${students.length} dari ${students.length} siswa`;
}

// === Part 3: Materi Section ===
function setupMateriForm() {
  const addBtn = document.getElementById("add-materi");
  const form = document.getElementById("materi-form");

  addBtn.addEventListener("click", () => {
    form.style.display = form.style.display === "none" ? "block" : "none";
  });

  form.addEventListener("submit", e => {
    e.preventDefault();
    const date = document.getElementById("materi-date").value;
    const title = document.getElementById("materi-title").value;
    const guru = document.getElementById("materi-guru").value;
    const asisten = document.getElementById("materi-asisten").value;

    console.log("Materi disimpan:", { date, title, guru, asisten });
    form.reset();
    form.style.display = "none";
  });
}

// === Part 4: Logout & Actions ===
function setupActions() {
  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
  });

  const saveBtn = document.getElementById("save-absensi");
  saveBtn?.addEventListener("click", () => {
    document.getElementById("toast").style.display = "block";
    setTimeout(() => {
      document.getElementById("toast").style.display = "none";
    }, 2000);
  });
}

// === Init ===
document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderAbsensiTable();
  setupMateriForm();
  setupActions();
});

