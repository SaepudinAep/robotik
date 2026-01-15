// draft_absensi_v2.2.0_part1.js — Bagian 1
import { supabase } from './config.js';

// === 1. HEADER SEKOLAH & KELAS ===
async function renderHeader() {
  const classId = localStorage.getItem("activeClassId");
  if (!classId) return;

  const { data: kelas, error } = await supabase
    .from('classes')
    .select(`
      name, jadwal,
      schools (name),
      semesters (name),
      academic_years (year)
    `)
    .eq('id', classId)
    .single();

  if (kelas) {
    document.getElementById("school-name").textContent = kelas.schools?.name ?? "-";
    document.getElementById("semester-year").textContent = `${kelas.semesters?.name ?? "-"} — Tahun Ajaran ${kelas.academic_years?.year ?? "-"}`;
    document.getElementById("class-schedule").textContent = `${kelas.name} | Jadwal: ${kelas.jadwal ?? "-"}`;
  }
}

// === 2. TABEL SISWA ===
let siswaList = [];

async function initTable() {
  const classId = localStorage.getItem("activeClassId");
  if (!classId) return;

  const { data: students } = await supabase
    .from("students")
    .select("id, name, class_id, classes(name)")
    .eq("class_id", classId);

  siswaList = students;

  const tbody = document.querySelector("#absensi-table tbody");
  const headRow = document.querySelector("#absensi-table thead tr");
  const totalsRow = document.getElementById("totals-row");

  headRow.innerHTML = "<th>No.</th><th>Nama Siswa</th><th>Kelas</th>";
  totalsRow.innerHTML = "<td colspan='3' style='text-align:center;'>Total</td>";
  tbody.innerHTML = "";

  students.forEach((s, i) => {
    const row = document.createElement("tr");
    row.dataset.studentId = s.id;
    row.innerHTML = `<td>${i + 1}</td><td>${s.name}</td><td>${s.classes?.name ?? "-"}</td>`;
    tbody.appendChild(row);
  });
}

// === 3. FORM PILIH MATERI ===
function setupMateriForm() {
  const form = document.getElementById("materi-form");
  const addBtn = document.getElementById("add-materi");

  addBtn.addEventListener("click", () => {
    form.style.display = form.style.display === "none" ? "block" : "none";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const date = document.getElementById("materi-date").value;
    const title = document.getElementById("materi-title").value;
    const guru = document.getElementById("materi-guru").value;
    const asisten = document.getElementById("materi-asisten").value;

    if (!date || !title || !guru || !asisten) {
      alert("Tanggal, judul, guru, dan asisten wajib diisi.");
      return;
    }

    const { data: materi } = await supabase
      .from("materi")
      .select("id")
      .eq("title", title)
      .single();

    if (!materi) {
      alert("Materi tidak ditemukan.");
      return;
    }

    tambahKolomAbsensi(date, materi.id);
    form.reset();
    form.style.display = "none";
  });
}

// === 4. TAMBAH KOLOM ABSENSI ===
function tambahKolomAbsensi(date, materiId) {
  const headRow = document.querySelector("#absensi-table thead tr");
  const totalsRow = document.getElementById("totals-row");
  const tbody = document.querySelector("#absensi-table tbody");

  const formattedDate = new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short"
  });

  const th = document.createElement("th");
  th.textContent = formattedDate;
  headRow.appendChild(th);

  const tdTotal = document.createElement("td");
  tdTotal.textContent = "0";
  totalsRow.appendChild(tdTotal);

  tbody.querySelectorAll("tr").forEach(row => {
    const td = document.createElement("td");
    td.innerHTML = `<input type="checkbox" data-materi-id="${materiId}" />`;
    row.appendChild(td);
  });

  document.getElementById("save-absensi").style.display = "inline-block";
}

// === 5. DROPDOWN GURU & ASISTEN ===
async function loadGuruDropdowns() {
  const { data } = await supabase
    .from("teachers")
    .select("name")
    .order("name");

  const guruSelect = document.getElementById("materi-guru");
  const asistenSelect = document.getElementById("materi-asisten");

  guruSelect.innerHTML = `<option value="">-- Pilih Guru --</option>`;
  asistenSelect.innerHTML = `<option value="">-- Pilih Asisten --</option>`;

  data.forEach(t => {
    const opt1 = document.createElement("option");
    opt1.value = t.name;
    opt1.textContent = t.name;
    guruSelect.appendChild(opt1);

    const opt2 = opt1.cloneNode(true);
    asistenSelect.appendChild(opt2);
  });
}

// draft_absensi_v2.2.0_part2.js — Bagian 2

// === 6. SIMPAN ABSENSI KE SUPABASE ===
function setupSimpanAbsensi() {
  const btn = document.getElementById("save-absensi");
  btn.addEventListener("click", async () => {
    const rows = document.querySelectorAll("#absensi-table tbody tr");
    const absensiData = [];

    const tanggal = document.getElementById("materi-date").value;
    const guruName = document.getElementById("materi-guru").value;
    const asistenName = document.getElementById("materi-asisten").value;

    // Ambil ID guru dan asisten
    const { data: guruData } = await supabase
      .from("teachers")
      .select("id")
      .eq("name", guruName)
      .single();

    const { data: asistenData } = await supabase
      .from("teachers")
      .select("id")
      .eq("name", asistenName)
      .single();

    const teacherId = guruData?.id;
    const assistantId = asistenData?.id;

    if (!teacherId || !assistantId || !tanggal) {
      alert("Data guru, asisten, dan tanggal wajib diisi.");
      return;
    }

    rows.forEach(row => {
      const studentId = row.dataset.studentId;
      row.querySelectorAll("input[type='checkbox']").forEach(input => {
        const materiId = input.dataset.materiId;
        const status = input.checked ? "hadir" : "alfa";

        absensiData.push({
          student_id: studentId,
          materi_id: materiId,
          status,
          teacher_id: teacherId,
          assistant_id: assistantId,
          tanggal
        });
      });
    });

    if (absensiData.length === 0) {
      alert("Tidak ada data absensi yang dipilih.");
      return;
    }

    const { error } = await supabase.from("attendances").insert(absensiData);
    if (error) {
      alert("Gagal menyimpan absensi.");
      console.error(error);
    } else {
      const toast = document.getElementById("toast");
      toast.textContent = "✅ Absensi berhasil disimpan";
      toast.style.display = "block";
      setTimeout(() => (toast.style.display = "none"), 3000);
    }
  });
}

// === 7. AUTO-SUGGESTION JUDUL MATERI ===
async function loadJudulMateriSuggestions() {
  const { data } = await supabase
    .from("materi")
    .select("title")
    .order("date", { ascending: false })
    .limit(30);

  const datalist = document.getElementById("judul-list");
  datalist.innerHTML = "";

  const uniqueTitles = [...new Set(data.map(m => m.title))];
  uniqueTitles.forEach(title => {
    const option = document.createElement("option");
    option.value = title;
    datalist.appendChild(option);
  });
}

// === 8. TAMPILKAN CARD MATERI ===
async function tampilkanDaftarMateri() {
  const { data } = await supabase
    .from("materi")
    .select(`
      id, date, title,
      teachers:teachers!materi_guru_id_fkey(name),
      asisten:teachers!materi_asisten_id_fkey(name)
    `)
    .order("date", { ascending: false });

  const container = document.getElementById("materi-list");
  container.innerHTML = "";

  data.forEach(m => {
    const tanggal = new Date(m.date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short"
    });

    const card = document.createElement("div");
    card.className = "materi-card";
    card.innerHTML = `
      <h4>${m.title}</h4>
      <p><strong>Tanggal:</strong> ${tanggal}</p>
      <p><strong>Guru:</strong> ${m.teachers?.name ?? "-"}</p>
      <p><strong>Asisten:</strong> ${m.asisten?.name ?? "-"}</p>
    `;
    container.appendChild(card);
  });
}

// === 9. INISIALISASI ===
document.addEventListener("DOMContentLoaded", () => {
  renderHeader();               // Tampilkan info sekolah & kelas
  initTable();                  // Tampilkan daftar siswa
  setupMateriForm();            // Setup form pilih materi
  setupSimpanAbsensi();         // Setup tombol simpan absensi
  loadJudulMateriSuggestions(); // Isi auto-suggestion judul
  loadGuruDropdowns();          // Isi dropdown guru & asisten
  tampilkanDaftarMateri();      // Tampilkan card materi
});
