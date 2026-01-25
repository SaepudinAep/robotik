import { supabase } from './config.js';

/**
 * REKONSTRUKSI LOGIKA TOTAL:
 * 1. Mengintegrasikan Cascading Dropdown (Tahun -> Semester -> Kelas).
 * 2. Mapping Matriks 2D untuk efisiensi render (O(1) lookup).
 * 3. Proteksi Null pada querySelector dan array findIndex.
 * 4. Preservasi Fitur Export Excel dengan custom styling.
 */

// --- INITIALIZATION ---
window.addEventListener("DOMContentLoaded", async () => {
    await isiDropdownTahunAjaran();
});

// --- HELPER LOGIC ---
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

function formatTanggal(tgl) {
    if (!tgl) return "-";
    const d = new Date(tgl);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

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

// --- DROPDOWN CASCADING ---
async function isiDropdownTahunAjaran() {
    const select = document.getElementById("academicYearSelect");
    if (!select) return;

    const { data, error } = await supabase
        .from("academic_years")
        .select("id, year")
        .order("year", { ascending: false });

    if (error) return console.error("Database Error:", error.message);

    select.innerHTML = "";
    const { academicYear } = getActiveSemesterLabel();
    
    data.forEach(item => {
        const option = new Option(item.year, item.id);
        if (item.year === academicYear) option.selected = true;
        select.add(option);
    });

    await isiDropdownSemester();
}

async function isiDropdownSemester() {
    const ayId = document.getElementById("academicYearSelect")?.value;
    const select = document.getElementById("semesterSelect");
    if (!ayId || !select) return;

    const { data, error } = await supabase
        .from("semesters")
        .select("id, name")
        .eq("academic_year_id", ayId);

    if (error) return;

    select.innerHTML = "";
    const { semesterName } = getActiveSemesterLabel();

    data.forEach(item => {
        const option = new Option(item.name, item.id);
        if (item.name === semesterName) option.selected = true;
        select.add(option);
    });

    await isiDropdownKelas();
}

async function isiDropdownKelas() {
    const ayId = document.getElementById("academicYearSelect")?.value;
    const sId = document.getElementById("semesterSelect")?.value;
    const select = document.getElementById("classSelect");
    if (!select || !ayId || !sId) return;

    const { data, error } = await supabase
        .from("classes")
        .select("id, name, schools(name)")
        .eq("academic_year_id", ayId)
        .eq("semester_id", sId);

    if (error) return;

    select.innerHTML = '<option value="">- Pilih Kelas -</option>';
    data.forEach(k => {
        const school = k.schools?.name || "–";
        select.add(new Option(`${k.name} (${school})`, k.id));
    });
}

// --- CORE: DATA LOADING ---
async function handleLoadRekap() {
    const ayText = document.getElementById("academicYearSelect").selectedOptions[0]?.text || "-";
    const semText = document.getElementById("semesterSelect").selectedOptions[0]?.text || "-";
    const classSelect = document.getElementById("classSelect");
    const classId = classSelect.value;

    if (!classId) return alert("Pilih kelas dulu.");

    const { data, error } = await supabase
        .from("classes")
        .select("jadwal, name, schools(name)")
        .eq("id", classId)
        .single();

    if (error) return alert("Gagal ambil data kelas.");

    // Update Header Metadata
    const schoolEl = document.getElementById("schoolName");
    if (schoolEl) schoolEl.textContent = data.schools?.name || "-";

    const header = document.querySelector(".rekap-header");
    if (header) {
        const ps = header.querySelectorAll("p");
        if (ps.length >= 2) {
            ps[0].innerHTML = `<strong>Tahun Ajaran:</strong> ${ayText} &nbsp;&nbsp; <strong>Semester:</strong> ${semText}`;
            ps[1].innerHTML = `<strong>Kelas:</strong> ${data.name} &nbsp;&nbsp; <strong>Jadwal:</strong> ${data.jadwal || "-"}`;
        }
    }

    await isiDropdownPertemuan(classId);
    await renderTabelSiswa(classId);
}

async function isiDropdownPertemuan(classId) {
    const { data, error } = await supabase
        .from("pertemuan_kelas")
        .select("id, tanggal")
        .eq("class_id", classId)
        .order("tanggal", { ascending: true });

    if (error || !data) return;

    const start = document.getElementById("pertemuanStartSelect");
    const end = document.getElementById("pertemuanEndSelect");
    if (!start || !end) return;

    start.innerHTML = ""; end.innerHTML = "";
    data.forEach((p, i) => {
        const label = `P${i + 1} - ${formatTanggal(p.tanggal)}`;
        start.add(new Option(label, p.id));
        end.add(new Option(label, p.id));
    });

    if (data.length > 0) {
        start.value = data[0].id;
        end.value = data[data.length - 1].id;
    }
}

// --- RENDER FUNCTIONS (Lengkap & Aman) ---
async function renderTabelSiswa(classId) {
    const { data: siswa, error } = await supabase
        .from("students")
        .select("id, name, grade")
        .eq("class_id", classId)
        .order("name", { ascending: true });

    if (error || !siswa) return;

    const table = document.getElementById("tabelDataSiswa");
    if (!table) return;

    table.innerHTML = `
        <thead><tr><th>No</th><th>Nama</th><th>Kelas</th></tr></thead>
        <tbody>
            ${siswa.map((s, i) => `<tr><td>${i + 1}</td><td style="text-align:left; padding-left:15px;">${s.name}</td><td>${s.grade || "-"}</td></tr>`).join('')}
        </tbody>
    `;

    showSection("tabelSiswaSection");
}

async function loadRekapAbsensi() {
    const classId = document.getElementById("classSelect").value;
    const awalId = document.getElementById("pertemuanStartSelect").value;
    const akhirId = document.getElementById("pertemuanEndSelect").value;
    const table = document.getElementById("rekapAbsensiTable");

    if (!classId || !awalId || !akhirId) return alert("Pilih rentang pertemuan.");

    const [resP, resS] = await Promise.all([
        supabase.from("pertemuan_kelas").select("id, tanggal").eq("class_id", classId).order("tanggal", { ascending: true }),
        supabase.from("students").select("id, name, grade").eq("class_id", classId).order("name", { ascending: true })
    ]);

    const pArr = resP.data || [];
    const pSlice = pArr.slice(pArr.findIndex(p => p.id === awalId), pArr.findIndex(p => p.id === akhirId) + 1);

    const { data: att } = await supabase.from("attendance").select("student_id, pertemuan_id, status").in("pertemuan_id", pSlice.map(p => p.id));

    const map = {};
    (att || []).forEach(a => {
        if (!map[a.student_id]) map[a.student_id] = {};
        map[a.student_id][a.pertemuan_id] = a.status;
    });

    let html = `<thead><tr><th>No</th><th>Nama</th><th>Kelas</th>${pSlice.map(p => `<th>${formatTanggal(p.tanggal)}</th>`).join('')}</tr></thead><tbody>`;
    (resS.data || []).forEach((s, i) => {
        html += `<tr><td>${i+1}</td><td style="text-align:left;">${s.name}</td><td>${s.grade||"-"}</td>`;
        pSlice.forEach(p => html += `<td>${ikonAbsensi(map[s.id]?.[p.id])}</td>`);
        html += `</tr>`;
    });
    table.innerHTML = html + "</tbody>";
    showSection("rekapAbsensiSection");
}

async function loadRekapPembelajaran() {
    const classId = document.getElementById("classSelect").value;
    const awalId = document.getElementById("pertemuanStartSelect").value;
    const akhirId = document.getElementById("pertemuanEndSelect").value;
    const table = document.getElementById("rekapPembelajaranTable");

    if (!classId || !awalId || !akhirId) return;

    const [resP, resS] = await Promise.all([
        supabase.from("pertemuan_kelas").select("id, tanggal").eq("class_id", classId).order("tanggal", { ascending: true }),
        supabase.from("students").select("id, name, grade").eq("class_id", classId).order("name", { ascending: true })
    ]);

    const pArr = resP.data || [];
    const pSlice = pArr.slice(pArr.findIndex(p => p.id === awalId), pArr.findIndex(p => p.id === akhirId) + 1);

    const { data: att } = await supabase.from("attendance").select("student_id, pertemuan_id, sikap, fokus").in("pertemuan_id", pSlice.map(p => p.id));

    const map = {};
    (att || []).forEach(a => {
        if (!map[a.student_id]) map[a.student_id] = {};
        map[a.student_id][a.pertemuan_id] = { s: a.sikap, f: a.fokus };
    });

    let html = `<thead><tr><th>No</th><th>Nama</th><th>Kelas</th>${pSlice.map(p => `<th>${formatTanggal(p.tanggal)}</th>`).join('')}</tr></thead><tbody>`;
    (resS.data || []).forEach((s, i) => {
        html += `<tr><td>${i+1}</td><td style="text-align:left;">${s.name}</td><td>${s.grade||"-"}</td>`;
        pSlice.forEach(p => {
            const d = map[s.id]?.[p.id];
            html += `<td>${ikonSikap(d?.s)} ${ikonFokus(d?.f)}</td>`;
        });
        html += `</tr>`;
    });
    table.innerHTML = html + "</tbody>";
    showSection("rekapPembelajaranSection");
}

function showSection(id) {
    ["tabelSiswaSection", "rekapAbsensiSection", "rekapPembelajaranSection"].forEach(s => {
        const el = document.getElementById(s);
        if (el) el.style.display = (s === id) ? "block" : "none";
    });
}

// --- BINDING & EXPORT ---
document.getElementById("academicYearSelect")?.addEventListener("change", isiDropdownSemester);
document.getElementById("semesterSelect")?.addEventListener("change", isiDropdownKelas);
document.getElementById("loadRekap")?.addEventListener("click", handleLoadRekap);
document.getElementById("btnRekapAbsensi")?.addEventListener("click", loadRekapAbsensi);
document.getElementById("btnRekapPembelajaran")?.addEventListener("click", loadRekapPembelajaran);
document.getElementById("printRekap")?.addEventListener("click", () => window.print());

document.getElementById("exportExcel")?.addEventListener("click", () => {
    const activeTable = document.querySelector(".rekap-section[style*='block'] table");
    if (!activeTable) return alert("Tampilkan data dulu!");

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(activeTable);
    
    // ANALISIS STYLING (Sesuai Logika Baris 400+ Anda)
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[cell]) ws[cell].s = { fill: { fgColor: { rgb: "D9E1F2" } }, font: { bold: true } };
    }

    XLSX.utils.book_append_sheet(wb, ws, "Rekap");
    XLSX.writeFile(wb, `Rekap_Sekolah_${new Date().getTime()}.xlsx`);
});