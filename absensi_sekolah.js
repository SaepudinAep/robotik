// Ambil data dari localStorage
window.addEventListener("DOMContentLoaded", () => {
  const schoolName = localStorage.getItem("activeSchoolName");
  const className = localStorage.getItem("activeClassName");

  // Update header
  document.getElementById("headerSekolah").textContent = schoolName || "Sekolah Default";
  document.getElementById("headerKelas").textContent = className || "Kelas Default";

  // Ambil ID kelas untuk load tabel absensi
  const classId = localStorage.getItem("activeClassId");
  if (classId) {
    loadAbsensi(classId);
  }
});

// Contoh fungsi load absensi (Supabase)
async function loadAbsensi(classId) {
  const { data, error } = await supabase
    .from("attendances")
    .select("id, students(name), status")
    .eq("class_id", classId);

  if (error) {
    console.error("Gagal load absensi:", error);
    return;
  }

  const tbody = document.querySelector("#tableAbsensi tbody");
  tbody.innerHTML = "";
  data.forEach((row, i) => {
    tbody.innerHTML += `
      <tr>
        <td>${i+1}</td>
        <td>${row.students?.name ?? "-"}</td>
        <td>${row.status ?? "-"}</td>
      </tr>`;
  });
}