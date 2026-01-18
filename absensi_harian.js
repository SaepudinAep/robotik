import { supabase } from "./config.js";

let siswaList = [];
let selectedPertemuanId = null;

// 🔹 HEADER KELAS
async function renderHeader() {
  const classId = localStorage.getItem("activeClassId");
  if (!classId) return;

  const { data: kelas } = await supabase
    .from("classes")
    .select(`
      name, jadwal,
      schools (id, name),
      semesters (name),
      academic_years (year)
    `)
    .eq("id", classId)
    .single();

  if (!kelas) return;

  document.getElementById("header-sekolah").textContent = kelas.schools?.name ?? "-";
  document.getElementById("header-tahun").textContent = kelas.academic_years?.year ?? "-";
  document.getElementById("header-semester").textContent = kelas.semesters?.name ?? "-";
  document.getElementById("header-kelas").textContent = kelas.name ?? "-";
  document.getElementById("header-jadwal").textContent = kelas.jadwal ?? "-";

  localStorage.setItem("activeSchoolId", kelas.schools?.id ?? "");
}

// 🔹 OPSI SIKAP
function getSikapOptions(selected = "0") {
  const options = [
    { value: "0", label: "❌" },
    { value: "1", label: "🤐 " },
    { value: "2", label: "🙈 " },
    { value: "3", label: "🙂 " },
    { value: "4", label: "👀 " },
    { value: "5", label: "🌀 " }
  ];

  return options
    .map(opt => `<option value="${opt.value}" ${opt.value === selected ? "selected" : ""}>${opt.label}</option>`)
    .join("");
}

// 🔹 OPSI FOKUS
function getFokusOptions(selected = "0") {
  const options = [
    { value: "0", label: "❌" },
    { value: "1", label: "😶" },
    { value: "2", label: "🙂" },
    { value: "3", label: "🔥" }
  ];

  return options
    .map(opt => `<option value="${opt.value}" ${opt.value === selected ? "selected" : ""}>${opt.label}</option>`)
    .join("");
}

// 🔹 MUAT ABSENSI
async function loadAbsensi(pertemuanId) {
  const { data } = await supabase
    .from("attendance")
    .select("student_id, status, sikap, fokus")
    .eq("pertemuan_id", pertemuanId);

  return data ?? [];
}

// 🔹 TAMPILKAN TABEL ABSENSI
async function initTable(pertemuanId) {
  const classId = localStorage.getItem("activeClassId");
  if (!classId) return;

  const { data: students } = await supabase
    .from("students")
    .select("id, name, grade")
    .eq("class_id", classId)
    .order("grade", { ascending: true })
    .order("name", { ascending: true });

  if (!students) return;
  siswaList = students;

  const absensi = await loadAbsensi(pertemuanId);

  const table = document.getElementById("absensi-table");
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  thead.innerHTML = "";
  tbody.innerHTML = "";

  thead.innerHTML = `
    <tr>
      <th>No.</th>
      <th>Nama Siswa</th>
      <th>Kelas</th>
      <th>Status</th>
      <th>Sikap</th>
      <th>Fokus</th>
    </tr>
  `;

  students.forEach((siswa, index) => {
    const absen = absensi.find(a => a.student_id === siswa.id);
    const status = absen?.status ?? "0";
    const sikap = absen?.sikap ?? "3";
    const fokus = absen?.fokus ?? "2";

    const row = document.createElement("tr");
    row.dataset.studentId = siswa.id;
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${siswa.name}</td>
      <td>${siswa.grade ?? "-"}</td>
      <td>
        <select class="status-select">
          <option value="0" ${status === "0" ? "selected" : ""}>⬜ </option>
          <option value="1" ${status === "1" ? "selected" : ""}>✅ </option>
          <option value="2" ${status === "2" ? "selected" : ""}>❌ </option>
        </select>
      </td>
      <td>
        <select class="sikap-select">
          ${getSikapOptions(sikap)}
        </select>
      </td>
      <td>
        <select class="fokus-select">
          ${getFokusOptions(fokus)}
        </select>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// 🔹 GENERATE ABSENSI (dengan tanggal)
async function generateAbsensi(pertemuanId) {
  const classId = localStorage.getItem("activeClassId");
  if (!classId) return;

  const { data: students } = await supabase
    .from("students")
    .select("id")
    .eq("class_id", classId);

  const { data: pertemuan } = await supabase
    .from("pertemuan_kelas")
    .select("tanggal")
    .eq("id", pertemuanId)
    .single();

  if (!students || !pertemuan) return;

  const { data: existing } = await supabase
    .from("attendance")
    .select("id")
    .eq("pertemuan_id", pertemuanId);

  if (existing?.length) {
    const konfirmasi = confirm("Absensi sudah ada. Mau timpa ulang?");
    if (!konfirmasi) return;
    await supabase.from("attendance").delete().eq("pertemuan_id", pertemuanId);
  }

  const records = students.map(siswa => ({
    pertemuan_id: pertemuanId,
    student_id: siswa.id,
    status: "0",
    sikap: "0",
    fokus: "0",
    tanggal: pertemuan.tanggal
  }));

  await supabase.from("attendance").insert(records);
}

// 🔹 SIMPAN ABSENSI
document.getElementById("simpan-absensi").addEventListener("click", async () => {
  if (!selectedPertemuanId) {
    alert("Pertemuan belum dipilih.");
    return;
  }

  const { data: pertemuan } = await supabase
    .from("pertemuan_kelas")
    .select("tanggal")
    .eq("id", selectedPertemuanId)
    .single();

  if (!pertemuan) return;
  const tanggal = pertemuan.tanggal;

  const rows = document.querySelectorAll("#absensi-table tbody tr");
  const updates = [];

  rows.forEach(row => {
    const studentId = row.dataset.studentId;
    const status = row.querySelector(".status-select")?.value || "0";
    const sikap = row.querySelector(".sikap-select")?.value || "0";
    const fokus = row.querySelector(".fokus-select")?.value || "0";

    updates.push({
      pertemuan_id: selectedPertemuanId,
      student_id: studentId,
      status,
      sikap,
      fokus,
      tanggal
    });
  });

  await supabase.from("attendance").delete().eq("pertemuan_id", selectedPertemuanId);
  const { error } = await supabase.from("attendance").insert(updates);

  if (error) {
    alert("Gagal menyimpan absensi.");
    console.error(error);
  } else {
    alert("✅ Absensi berhasil disimpan.");
  }
});


// 🔹 TAMPILKAN CARD MATERI (versi baru dengan tampilan rapi)
async function tampilkanDaftarMateri() {
  const classId = localStorage.getItem("activeClassId");
  if (!classId) return;

  const { data } = await supabase
    .from("pertemuan_kelas")
    .select(`
      id, tanggal,
      materi:materi_id (title),
      guru:guru_id (name),
      asisten:asisten_id (name)
    `)
    .eq("class_id", classId)
    .order("tanggal", { ascending: false });

  const container = document.getElementById("materi-list");
  container.innerHTML = "";
  container.classList.add("card-grid");

  data.forEach(p => {
    const tanggal = new Date(p.tanggal).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short"
    });

    const card = document.createElement("div");
    card.className = "card";

card.innerHTML = `
  <p class="baris-tanggal">
    <strong>📅 ${tanggal} :</strong> <span class="judul-materi">${p.materi?.title ?? "-"}</span>
  </p>
  <p class="baris-pengajar">
    <span><strong>👤</strong> ${p.guru?.name ?? "-"}</span>
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <span><strong>👥</strong> ${p.asisten?.name ?? "-"}</span>
  </p>
`;


    container.appendChild(card);
  });
}



// 🔹 DROPDOWN PERTEMUAN
async function loadPertemuanOptions() {
  const classId = localStorage.getItem("activeClassId");
  const select = document.getElementById("pertemuan-selector");
  select.innerHTML = `<option value="">-- Pilih Pertemuan --</option>`;

  const { data } = await supabase
    .from("pertemuan_kelas")
    .select("id, tanggal, materi (title)")
    .eq("class_id", classId)
    .order("tanggal", { ascending: false });

  data.forEach(p => {
    const tgl = new Date(p.tanggal).toLocaleDateString("id-ID", {
      day: "2-digit", month: "short"
    });
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = `${tgl} — ${p.materi?.title ?? "-"}`;
    select.appendChild(option);
  });
}

// 🔹 DROPDOWN GURU & ASISTEN
async function loadGuruDropdowns() {
  const { data } = await supabase
    .from("teachers")
    .select("id, name")
    .order("name");

  const guruSelect = document.getElementById("materi-guru");
  const asistenSelect = document.getElementById("materi-asisten");

  guruSelect.innerHTML = `<option value="">-- Pilih Guru --</option>`;
  asistenSelect.innerHTML = `<option value="">-- Pilih Asisten --</option>`;

  data.forEach(t => {
    const opt1 = document.createElement("option");
    opt1.value = t.id;
    opt1.textContent = t.name;
    guruSelect.appendChild(opt1);

    const opt2 = opt1.cloneNode(true);
    asistenSelect.appendChild(opt2);
  });
}

// 🔹 DATALIST JUDUL MATERI
async function loadJudulMateriSuggestions() {
  const { data } = await supabase
    .from("materi")
    .select("title")
    .order("date", { ascending: false })
    .limit(30);

  const datalist = document.getElementById("judul-list");
  datalist.innerHTML = "";

  const uniqueTitles = [...new Set(data.map(m => m.title).filter(Boolean))];
  uniqueTitles.forEach(title => {
    const option = document.createElement("option");
    option.value = title;
    datalist.appendChild(option);
  });
}

// 🔹 SIMPAN FORM PERTEMUAN BARU
document.getElementById("materi-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const classId = localStorage.getItem("activeClassId");
  const schoolId = localStorage.getItem("activeSchoolId");

  const tanggal = document.getElementById("materi-date").value;
  const title = document.getElementById("materi-title").value.trim();
  const guruId = document.getElementById("materi-guru").value;
  const asistenId = document.getElementById("materi-asisten").value;

  if (!classId || !schoolId || !tanggal || !title || !guruId || !asistenId) {
    alert("Mohon lengkapi semua data.");
    return;
  }

  try {
    let { data: materi } = await supabase
      .from("materi")
      .select("id")
      .eq("title", title)
      .single();

    if (!materi) {
      const { data: newMateri } = await supabase
        .from("materi")
        .insert({ title })
        .select()
        .single();
      materi = newMateri;
    }

    const payload = {
      school_id: schoolId,
      class_id: classId,
      tanggal,
      materi_id: materi.id,
      guru_id: guruId,
      asisten_id: asistenId
    };

    const { data: pertemuanData } = await supabase
      .from("pertemuan_kelas")
      .insert([payload])
      .select("id")
      .single();

    selectedPertemuanId = pertemuanData.id;

    await generateAbsensi(selectedPertemuanId);
    await initTable(selectedPertemuanId);
    await tampilkanDaftarMateri();
    await loadPertemuanOptions();

    e.target.reset();
    document.getElementById("materi-form").style.display = "none";
    alert("✅ Pertemuan & absensi berhasil disimpan.");
  } catch (err) {
    alert("Terjadi kesalahan saat menyimpan.");
    console.error(err);
  }
});

// 🔹 PILIH PERTEMUAN DARI DROPDOWN
document.getElementById("pertemuan-selector").addEventListener("change", async (e) => {
  const pertemuanId = e.target.value;
  if (!pertemuanId) return;

  selectedPertemuanId = pertemuanId;
  await initTable(pertemuanId);
});
// 🔹 AUTO PILIH PERTEMUAN PERTAMA
async function autoSelectPertemuanAwal() {
  const select = document.getElementById("pertemuan-selector");
  const firstOption = select.querySelector("option[value]:not([value=''])");
  if (firstOption) {
    selectedPertemuanId = firstOption.value;
    select.value = selectedPertemuanId;
    await initTable(selectedPertemuanId);
  }
}

// 🔹 INISIALISASI SAAT DOM DIMUAT
document.addEventListener("DOMContentLoaded", async () => {
  await renderHeader();
  await loadGuruDropdowns();
  await loadJudulMateriSuggestions();
  await tampilkanDaftarMateri();
  await loadPertemuanOptions();
  await autoSelectPertemuanAwal();

  // 🔹 Toggle Form Materi
  const toggleBtn = document.getElementById("toggle-materi-form");
  const form = document.getElementById("materi-form");

  toggleBtn.addEventListener("click", () => {
    const isHidden = form.style.display === "none";
    form.style.display = isHidden ? "block" : "none";
    toggleBtn.textContent = isHidden ? "− Tutup Form" : "+ Tambah Pertemuan";
  });
});