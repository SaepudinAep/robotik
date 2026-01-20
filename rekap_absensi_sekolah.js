import { supabase } from './config.js';

// Load Tahun Ajaran saat halaman dibuka
window.addEventListener("DOMContentLoaded", async () => {
  await isiDropdownTahunAjaran();
});

function getActiveSemesterLabel() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  let semesterName, academicYear;

  if (month >= 7 && month <= 12) {
    semesterName = "Semester 1";
    academicYear = `${year}/${year + 1}`;
  } else {
    semesterName = "Semester 2";
    academicYear = `${year - 1}/${year}`;
  }

  return { semesterName, academicYear };
}

async function isiDropdownTahunAjaran() {
  const select = document.getElementById("academicYearSelect");
  select.innerHTML = "";

  const { data, error } = await supabase
    .from("academic_years")
    .select("id, year")
    .order("year", { ascending: false });

  if (error) return console.error("Gagal ambil tahun ajaran:", error.message);

  const { academicYear } = getActiveSemesterLabel();
  let activeId = null;

  data.forEach(item => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.year;

    if (item.year === academicYear) {
      option.selected = true;
      activeId = item.id;
      localStorage.setItem("activeAcademicYear", item.year);
    }

    select.appendChild(option);
  });

  // Fallback jika tidak ditemukan yang cocok
  if (!activeId && data.length > 0) {
    select.value = data[0].id;
    localStorage.setItem("activeAcademicYear", data[0].year);
  }

  await isiDropdownSemester();
}

async function isiDropdownSemester() {
  const academicYearId = document.getElementById("academicYearSelect").value;
  const select = document.getElementById("semesterSelect");
  select.innerHTML = "";

  const { data, error } = await supabase
    .from("semesters")
    .select("id, name")
    .eq("academic_year_id", academicYearId);

  if (error) return console.error("Gagal ambil semester:", error.message);

  const { semesterName } = getActiveSemesterLabel();
  let activeId = null;

  data.forEach(item => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;

    if (item.name === semesterName) {
      option.selected = true;
      activeId = item.id;
      localStorage.setItem("activeSemester", item.name);
    }

    select.appendChild(option);
  });

  // Fallback jika tidak ditemukan yang cocok
  if (!activeId && data.length > 0) {
    select.value = data[0].id;
    localStorage.setItem("activeSemester", data[0].name);
  }

  await isiDropdownKelas();
}



// Isi dropdown Kelas berdasarkan Tahun Ajaran & Semester
async function isiDropdownKelas() {
  const academicYearId = document.getElementById("academicYearSelect").value;
  const semesterId = document.getElementById("semesterSelect").value;
  const select = document.getElementById("classSelect");
  select.innerHTML = "";

const { data, error } = await supabase
  .from("classes")
  .select("id, name, schools(name)")
  .eq("academic_year_id", academicYearId)
  .eq("semester_id", semesterId);
  if (error) return console.error("Gagal ambil kelas:", error.message);

data.forEach(kelas => {
  const option = document.createElement("option");
  option.value = kelas.id;
  const namaSekolah = kelas.schools?.name || "–";
  option.textContent = `${kelas.name} (${namaSekolah})`;
  select.appendChild(option);
  });
}

// Event berantai
document.getElementById("academicYearSelect").addEventListener("change", isiDropdownSemester);
document.getElementById("semesterSelect").addEventListener("change", isiDropdownKelas);

/// Load Rekap [Header page dan pertemuan selector]
document.getElementById("loadRekap").addEventListener("click", async () => {
  const academicYearText = document.getElementById("academicYearSelect").selectedOptions[0]?.text || "-";
  const semesterText = document.getElementById("semesterSelect").selectedOptions[0]?.text || "-";
  const classSelect = document.getElementById("classSelect");
  const classId = classSelect.value;
  const classText = classSelect.selectedOptions[0]?.text || "-";

  if (!classId) {
    alert("Pilih kelas terlebih dahulu.");
    return;
  }

  const { data, error } = await supabase
    .from("classes")
    .select("jadwal, name, schools(name)")
    .eq("id", classId)
    .single();

  if (error) return alert("Gagal ambil data kelas.");

  const schoolName = data.schools?.name || "-";
  const jadwal = data.jadwal || "-";
  const namaKelas = data.name || "-";

  document.getElementById("schoolName").textContent = schoolName;

  const header = document.querySelector(".rekap-header");
  const paragraphs = header.querySelectorAll("p");

  if (paragraphs.length >= 2) {
    paragraphs[0].innerHTML = `<strong>Tahun Ajaran:</strong> ${academicYearText} &nbsp;&nbsp; <strong>Semester:</strong> ${semesterText}`;
    paragraphs[1].innerHTML = `<strong>Kelas:</strong> ${namaKelas} &nbsp;&nbsp; <strong>Jadwal:</strong> ${jadwal}`;
  }

  // ⬇️ Tambahan penting agar dropdown pertemuan muncul
  await isiDropdownPertemuan(classId);
  await renderTabelSiswa(classId);

});


//=========================Render tabel rekap absensi dan pembelajaran
// === MAPPING SIMBOL NILAI ===
function ikonAbsensi(nilai) {
  const map = { 0: "⬜", 1: "✅", 2: "❌" };
  return map[nilai] ?? "–";
}

function ikonSikap(nilai) {
  const map = { 0: "❌", 1: "🤐", 2: "🙈", 3: "🙂", 4: "👀", 5: "🌀" };
  return map[nilai] ?? "–";
}

function ikonFokus(nilai) {
  const map = { 0: "❌", 1: "😶", 2: "🙂", 3: "🔥" };
  return map[nilai] ?? "–";
}

// === UTILITAS TANGGAL & MAPPING ===
function formatTanggal(tgl) {
  const d = new Date(tgl);
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

function buatMappingPertemuan(pertemuanList) {
  const map = {};
  pertemuanList.forEach((p, i) => { map[p.id] = i + 1; });
  return map;
}

// === ISI DROPDOWN PERTEMUAN ===
async function isiDropdownPertemuan(classId) {
  const { data, error } = await supabase
    .from("pertemuan_kelas")
    .select("id, tanggal")
    .eq("class_id", classId)
    .order("tanggal", { ascending: true });

  if (error || !data || data.length === 0) {
    alert("Data pertemuan tidak ditemukan.");
    return;
  }

  const startSelect = document.getElementById("pertemuanStartSelect");
  const endSelect = document.getElementById("pertemuanEndSelect");
  startSelect.innerHTML = "";
  endSelect.innerHTML = "";

  data.forEach((p, i) => {
    const label = `P ${i + 1} - ${formatTanggal(p.tanggal)}`;
    const option = new Option(label, p.id);
    startSelect.appendChild(option.cloneNode(true));
    endSelect.appendChild(option.cloneNode(true));
  });

  startSelect.value = data[0].id;
  endSelect.value = data[data.length - 1].id;
}

async function renderTabelSiswa(classId) {
  const { data: siswa, error } = await supabase
    .from("students")
    .select("id, name, grade")
    .eq("class_id", classId)
    .order("grade", { ascending: true })
    .order("name", { ascending: true });


  if (error || !siswa) {
    console.error("Gagal ambil data siswa:", error.message);
    return;
  }

  const table = document.getElementById("tabelDataSiswa");
  table.innerHTML = "";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>No</th>
      <th>Nama</th>
      <th>Kelas</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  siswa.forEach((s, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${i + 1}</td>
      <td>${s.name}</td>
      <td>${s.grade || "-"}</td>
    `;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  document.getElementById("tabelSiswaSection").style.display = "block";
  document.getElementById("rekapAbsensiSection").style.display = "none";
  document.getElementById("rekapPembelajaranSection").style.display = "none";
}

//===============Rekap Absensi========================
async function loadRekapAbsensi(classId, awalId, akhirId) {
  const table = document.getElementById("rekapAbsensiTable");
  table.innerHTML = ""; // 🔄 Kosongkan isi lama

  // 1. Ambil daftar siswa
  const { data: siswaList, error: siswaError } = await supabase
    .from("students")
    .select("id, name, grade")
    .eq("class_id", classId)
    .order("grade", { ascending: true })
    .order("name", { ascending: true });


  if (siswaError || !siswaList) {
    console.error("❌ Gagal ambil data siswa:", siswaError?.message);
    return;
  }

  // 2. Ambil daftar pertemuan
  const { data: pertemuanList, error: pertemuanError } = await supabase
    .from("pertemuan_kelas")
    .select("id, tanggal")
    .eq("class_id", classId)
    .gte("id", awalId)
    .lte("id", akhirId)
    .order("tanggal", { ascending: true });

  if (pertemuanError || !pertemuanList || pertemuanList.length === 0) {
    console.error("❌ Gagal ambil data pertemuan:", pertemuanError?.message);
    return;
  }

  // 3. Ambil data absensi
  const { data: absensiList, error: absensiError } = await supabase
    .from("attendance")
    .select("student_id, pertemuan_id, status")
    .in("pertemuan_id", pertemuanList.map(p => p.id));

  if (absensiError || !absensiList) {
    console.error("❌ Gagal ambil data absensi:", absensiError?.message);
    return;
  }

  // 4. Buat mapping absensi: { [student_id][pertemuan_id] = status }
  const absensiMap = {};
  absensiList.forEach(a => {
    if (!absensiMap[a.student_id]) absensiMap[a.student_id] = {};
    absensiMap[a.student_id][a.pertemuan_id] = parseInt(a.status);
  });

  // 5. Format tanggal header
  function formatTanggalHeader(tgl) {
    const d = new Date(tgl);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  }

  // 6. Bangun <thead>
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.innerHTML = `
    <th>No</th>
    <th>Nama</th>
    <th>Kelas</th>
    ${pertemuanList.map(p => `<th>${formatTanggalHeader(p.tanggal)}</th>`).join("")}
  `;
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // 7. Bangun <tbody>
  const tbody = document.createElement("tbody");
  siswaList.forEach((siswa, i) => {
    const row = document.createElement("tr");
    const absensiSiswa = absensiMap[siswa.id] || {};

    row.innerHTML = `
      <td>${i + 1}</td>
      <td>${siswa.name}</td>
      <td>${siswa.grade || "-"}</td>
      ${pertemuanList.map(p => {
        const status = absensiSiswa[p.id] ?? null;
        return `<td>${ikonAbsensi(status)}</td>`;
      }).join("")}
    `;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
}

//============================================
async function loadRekapPembelajaran(classId, awalId, akhirId) {
  const table = document.getElementById("rekapPembelajaranTable");
  table.innerHTML = ""; // 🔄 Kosongkan isi lama

  // 1. Ambil daftar siswa
  const { data: siswaList, error: siswaError } = await supabase
    .from("students")
    .select("id, name, grade")
    .eq("class_id", classId)
    .order("grade", { ascending: true })
    .order("name", { ascending: true });


  if (siswaError || !siswaList) {
    console.error("❌ Gagal ambil data siswa:", siswaError?.message);
    return;
  }

  // 2. Ambil daftar pertemuan
  const { data: pertemuanList, error: pertemuanError } = await supabase
    .from("pertemuan_kelas")
    .select("id, tanggal")
    .eq("class_id", classId)
    .gte("id", awalId)
    .lte("id", akhirId)
    .order("tanggal", { ascending: true });

  if (pertemuanError || !pertemuanList || pertemuanList.length === 0) {
    console.error("❌ Gagal ambil data pertemuan:", pertemuanError?.message);
    return;
  }

  // 3. Ambil data pembelajaran (sikap & fokus)
  const { data: pembelajaranList, error: pembelajaranError } = await supabase
    .from("attendance")
    .select("student_id, pertemuan_id, sikap, fokus")
    .in("pertemuan_id", pertemuanList.map(p => p.id));

  if (pembelajaranError || !pembelajaranList) {
    console.error("❌ Gagal ambil data pembelajaran:", pembelajaranError?.message);
    return;
  }

  // 4. Buat mapping: { [student_id][pertemuan_id] = { sikap, fokus } }
  const pembelajaranMap = {};
  pembelajaranList.forEach(a => {
    if (!pembelajaranMap[a.student_id]) pembelajaranMap[a.student_id] = {};
    pembelajaranMap[a.student_id][a.pertemuan_id] = {
      sikap: parseInt(a.sikap),
      fokus: parseInt(a.fokus)
    };
  });

  // 5. Format tanggal header
  function formatTanggalHeader(tgl) {
    const d = new Date(tgl);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  }

  // 6. Bangun <thead>
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.innerHTML = `
    <th>No</th>
    <th>Nama</th>
    <th>Kelas</th>
    ${pertemuanList.map(p => `<th>${formatTanggalHeader(p.tanggal)}</th>`).join("")}
  `;
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // 7. Bangun <tbody>
  const tbody = document.createElement("tbody");
  siswaList.forEach((siswa, i) => {
    const row = document.createElement("tr");
    const dataSiswa = pembelajaranMap[siswa.id] || {};

    row.innerHTML = `
      <td>${i + 1}</td>
      <td>${siswa.name}</td>
      <td>${siswa.grade || "-"}</td>
      ${pertemuanList.map(p => {
      const data = dataSiswa[p.id] || {};
      const sikapIcon = ikonSikap(data.sikap);
      const fokusIcon = ikonFokus(data.fokus);
      return `<td>${sikapIcon} ${fokusIcon}</td>`;
      }).join("")}

    `;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
}

//============================================

document.getElementById("btnRekapAbsensi").addEventListener("click", async () => {
  const classId = document.getElementById("classSelect").value;
  const awalId = document.getElementById("pertemuanStartSelect").value;
  const akhirId = document.getElementById("pertemuanEndSelect").value;
  
  document.getElementById("tabelSiswaSection").style.display = "none";
  document.getElementById("rekapAbsensiSection").style.display = "block";
  document.getElementById("rekapPembelajaranSection").style.display = "none";


  if (!classId || !awalId || !akhirId) {
    alert("Pastikan kelas dan rentang pertemuan sudah dipilih.");
    return;
  }

  await loadRekapAbsensi(classId, awalId, akhirId);
});


//====================================

document.getElementById("btnRekapPembelajaran").addEventListener("click", async () => {
  const classId = document.getElementById("classSelect").value;
  const awalId = document.getElementById("pertemuanStartSelect").value;
  const akhirId = document.getElementById("pertemuanEndSelect").value;

  document.getElementById("tabelSiswaSection").style.display = "none";
  document.getElementById("rekapAbsensiSection").style.display = "none";
  document.getElementById("rekapPembelajaranSection").style.display = "block";

  if (!classId || !awalId || !akhirId) {
    alert("Pastikan kelas dan rentang pertemuan sudah dipilih.");
    return;
  }

  await loadRekapPembelajaran(classId, awalId, akhirId);
});


//===========Print================
document.getElementById('printRekap').addEventListener('click', function () {
  window.print();
});

//===========Export Excel================
document.getElementById('exportExcel').addEventListener('click', function () {
  const absensiVisible = document.getElementById('rekapAbsensiSection').style.display !== 'none';
  const table = absensiVisible
    ? document.getElementById('rekapAbsensiTable')
    : document.getElementById('rekapPembelajaranTable');

  if (!table || table.rows.length === 0) {
    alert('Tidak ada data untuk diekspor.');
    return;
  }

  // Ambil header halaman
  const schoolName = document.getElementById('schoolName')?.innerText || '';
  const headerLines = Array.from(document.querySelectorAll('.rekap-header p')).map(p => p.innerText);

  // Buat array data awal (judul + info)
  const headerData = [
    [schoolName],
    ...headerLines.map(line => [line]),
    [], // spasi kosong sebelum tabel
  ];

  // Ambil data tabel sebagai array 2D
  const tableData = XLSX.utils.sheet_to_json(XLSX.utils.table_to_sheet(table), { header: 1 });

  // Gabungkan header + tabel
  const finalData = [...headerData, ...tableData];

  // Buat worksheet
  const ws = XLSX.utils.aoa_to_sheet(finalData);

  // Styling: warna latar belakang header kolom
  const headerRowIndex = headerData.length;
  const headerRow = tableData[0];
  for (let c = 0; c < headerRow.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c });
    if (!ws[cellRef]) continue;
    ws[cellRef].s = {
      fill: { fgColor: { rgb: "D9E1F2" } }, // biru muda
      font: { bold: true },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "999999" } },
        bottom: { style: "thin", color: { rgb: "999999" } },
        left: { style: "thin", color: { rgb: "999999" } },
        right: { style: "thin", color: { rgb: "999999" } }
      }
    };
  }

  // Styling isi sel berdasarkan simbol
  for (let r = headerRowIndex + 1; r < finalData.length; r++) {
    for (let c = 0; c < finalData[r].length; c++) {
      const value = finalData[r][c];
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellRef]) continue;

      if (value === '✅') {
        ws[cellRef].s = { fill: { fgColor: { rgb: "C6EFCE" } } }; // hijau muda
      } else if (value === '⬜') {
        ws[cellRef].s = { fill: { fgColor: { rgb: "E0E0E0" } } }; // abu terang
      }
    }
  }

  // Buat workbook dan simpan
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap');
  const filename = absensiVisible ? 'rekap_absensi.xlsx' : 'rekap_pembelajaran.xlsx';
  XLSX.writeFile(wb, filename);
});
