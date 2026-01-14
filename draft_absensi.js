// Versi: v1.4.1 (Bagian 1)

// Data siswa (dummy)
const students = ["Ahmad","Siti","Budi","Rina","Dewi","Andi","Lina","Rudi"];

// State global
let materiList = [];          // urutan terbaru di index 0
let activeColIndex = null;    // index kolom aktif (di thead)
let changed = false;

// Helper format tanggal dd-mmm
function formatDateDDMMM(dateStr) {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${day} ${monthNames[d.getMonth()]}`;
}

// Inisialisasi tabel dasar
function initTable() {
  const headRow = document.querySelector("#absensi-table thead tr");
  const tbody = document.querySelector("#absensi-table tbody");
  const totalsRow = document.getElementById("totals-row");

  headRow.innerHTML = "<th>No.</th><th>Nama Siswa</th><th>Kelas</th>";
  totalsRow.innerHTML = "<td colspan='3' style='text-align:center;'>Total</td>"; // tanpa angka 0 default

  tbody.innerHTML = "";
  students.forEach((s, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${i+1}</td><td>${s}</td><td>7A</td>`;
    tbody.appendChild(row);
  });
}

// Tambah pertemuan baru (terbaru masuk di kiri setelah kolom Kelas)
function addNewMeeting(date, title, guru, asisten) {
  const headRow = document.querySelector("#absensi-table thead tr");
  const totalsRow = document.getElementById("totals-row");
  const tbody = document.querySelector("#absensi-table tbody");

  const displayDate = formatDateDDMMM(date);

  // 1) Header tanggal (sisipkan di index 3 -> posisi kiri dari kolom tanggal)
  const newTh = document.createElement("th");
  newTh.dataset.date = date;
  newTh.textContent = displayDate;
  headRow.insertBefore(newTh, headRow.children[3]);

  // 2) Footer total (sisipkan sejajar: index 3)
  const newTotal = document.createElement("td");
  newTotal.textContent = "0";
  newTotal.className = "count-cell";
  totalsRow.insertBefore(newTotal, totalsRow.children[3]);

  // 3) Cell absensi per siswa (sisipkan di index 3)
  tbody.querySelectorAll("tr").forEach(row => {
    const newCell = document.createElement("td");
    newCell.className = "status none";
    newCell.dataset.date = date;
    newCell.textContent = "-";
    row.insertBefore(newCell, row.children[3]);
  });

  // 4) Card materi + state list (terbaru di depan)
  materiList.unshift({ date, title, guru, asisten });
  const cardGrid = document.getElementById("materi-card-grid");
  cardGrid.insertAdjacentHTML(
    "afterbegin",
    `<div class="card small-card">
       <h3>${displayDate} — ${title}</h3>
       <p>👨‍🏫 ${guru || "-"} — 🧑‍💻 ${asisten || "-"}</p>
     </div>`
  );

  // Reset kolom aktif (opsional): fokus ke kolom baru
  setActiveColumn(newTh);
  updateTotalsRow();
  updateSummary();
}

// Set kolom aktif (strict edit: hanya kolom ini yang bisa diubah)
function setActiveColumn(thEl) {
  const theadRow = thEl.parentNode;
  activeColIndex = Array.from(theadRow.children).indexOf(thEl);

  document.querySelectorAll("#absensi-table th, #absensi-table td")
    .forEach(cell => cell.classList.remove("active-col"));

  document.querySelectorAll("#absensi-table tr")
    .forEach(row => {
      if (row.children[activeColIndex]) {
        row.children[activeColIndex].classList.add("active-col");
      }
    });
}

// Toggle status hadir/tidak pada cell di kolom aktif saja
function toggleStatus(cell) {
  if (cell.classList.contains("none")) {
    cell.className = "status hadir"; cell.textContent = "✓";
  } else if (cell.classList.contains("hadir")) {
    cell.className = "status tidak"; cell.textContent = "x";
  } else {
    cell.className = "status none"; cell.textContent = "-";
  }
  changed = true;
  document.getElementById("save-absensi").style.display = "inline-block";
  updateTotalsRow();
  updateSummary();
}

// Ringkasan global (berapa hadir total dari semua tanggal)
function updateSummary() {
  const hadirCount = document.querySelectorAll("#absensi-table td.status.hadir").length;
  const totalStudents = document.querySelectorAll("#absensi-table tbody tr").length;
  document.getElementById("summary").textContent = `Jumlah Hadir: ${hadirCount} dari ${totalStudents} siswa`;
}

// Update angka total per tanggal (tfoot sejajar dengan th[data-date])
function updateTotalsRow() {
  const headRow = document.querySelector("#absensi-table thead tr");
  const totalsRow = document.getElementById("totals-row");
  const dateHeaders = headRow.querySelectorAll("th[data-date]");
  const totalCells = totalsRow.querySelectorAll("td.count-cell");

  // Safety: jumlah cell total harus sama dengan jumlah header tanggal
  if (totalCells.length !== dateHeaders.length) {
    // Sinkronkan: hapus semua, buat ulang sesuai header
    // Hapus semua count-cell
    totalCells.forEach(td => td.remove());
    // Tambah ulang sejajar, dari kiri ke kanan
    dateHeaders.forEach(() => {
      const td = document.createElement("td");
      td.className = "count-cell";
      td.textContent = "0";
      totalsRow.insertBefore(td, totalsRow.children[3]); // selalu di kiri setelah label
    });
  }

  // Hitung dan isi angka per tanggal
  dateHeaders.forEach((th, idx) => {
    const date = th.dataset.date;
    const count = document.querySelectorAll(`#absensi-table td.status.hadir[data-date="${date}"]`).length;
    const cell = totalsRow.querySelectorAll("td.count-cell")[idx];
    if (cell) cell.textContent = String(count);
  });
}

// Simpan absensi
function saveAbsensi() {
  changed = false;
  document.getElementById("save-absensi").style.display = "none";
  showToast("✔ Absensi tersimpan");
}

// Toast sederhana
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.style.display = "block";
  setTimeout(() => toast.style.display = "none", 2000);
}

// Versi: v1.4.1 (Bagian 2)

document.addEventListener("DOMContentLoaded", () => {
  initTable();

  // Seed 4 pertemuan (terbaru muncul paling kiri)
  addNewMeeting("2026-01-04","Kontrol Motor","Pak Joko","Andi");
  addNewMeeting("2026-01-03","Dasar Pemrograman","Pak Joko","Dewi");
  addNewMeeting("2026-01-02","Sensor & Aktuator","Pak Budi","Rina");
  addNewMeeting("2026-01-01","Pengenalan Robotik","Pak Budi","Ani");

  // Klik header tanggal → set kolom aktif
  document.querySelector("#absensi-table thead").addEventListener("click", e => {
    if (e.target.tagName === "TH" && e.target.dataset.date) {
      setActiveColumn(e.target);
      showToast("✏ Edit absensi untuk tanggal " + e.target.textContent);
    }
  });

  // Klik cell tbody → hanya kolom aktif yang bisa diubah
  document.querySelector("#absensi-table tbody").addEventListener("click", e => {
    const cell = e.target;
    if (!cell.classList.contains("status")) return;
    const colIndex = Array.from(cell.parentNode.children).indexOf(cell);
    if (colIndex === activeColIndex) {
      toggleStatus(cell);
    } else {
      showToast("Kolom ini tidak aktif untuk edit");
    }
  });

  // Simpan absensi
  document.getElementById("save-absensi").addEventListener("click", saveAbsensi);

  // Toggle form tambah materi
  document.getElementById("add-materi").addEventListener("click", () => {
    const form = document.getElementById("materi-form");
    form.style.display = form.style.display === "none" ? "block" : "none";
  });

  // Submit form tambah materi → tambah kolom tanggal
  document.getElementById("materi-form").addEventListener("submit", e => {
    e.preventDefault();
    const date = document.getElementById("materi-date").value;
    const title = document.getElementById("materi-title").value;
    const guru = document.getElementById("materi-guru").value;
    const asisten = document.getElementById("materi-asisten").value;

    if (date && title) {
      addNewMeeting(date, title, guru, asisten);
      showToast("✔ Pertemuan baru ditambahkan");
      e.target.reset();
      e.target.style.display = "none";
    } else {
      showToast("Tanggal & Judul wajib diisi");
    }
  });

  // Klik card materi → buka popup edit
  document.getElementById("materi-card-grid").addEventListener("click", e => {
    const cardEl = e.target.closest(".card");
    if (!cardEl) return;
    const cards = Array.from(document.querySelectorAll("#materi-card-grid .card"));
    const idx = cards.indexOf(cardEl);
    if (idx < 0) return;

    // Isi popup berdasarkan materiList
    const m = materiList[idx];
    document.getElementById("edit-date").value = m.date;
    document.getElementById("edit-title").value = m.title;
    document.getElementById("edit-guru").value = m.guru;
    document.getElementById("edit-asisten").value = m.asisten;
    document.getElementById("popup-form").dataset.index = String(idx);
    document.getElementById("popup-materi").style.display = "flex";
  });

  // Submit popup → update card + metadata + header tanggal
  document.getElementById("popup-form").addEventListener("submit", e => {
    e.preventDefault();
    const idx = parseInt(e.target.dataset.index, 10);
    if (isNaN(idx)) return;

    const newDate = document.getElementById("edit-date").value;
    const newTitle = document.getElementById("edit-title").value;
    const newGuru = document.getElementById("edit-guru").value;
    const newAsisten = document.getElementById("edit-asisten").value;

    // Update state
    materiList[idx] = { date: newDate, title: newTitle, guru: newGuru, asisten: newAsisten };

    // Update card
    const card = document.querySelectorAll("#materi-card-grid .card")[idx];
    card.querySelector("h3").textContent = `${formatDateDDMMM(newDate)} — ${newTitle}`;
    card.querySelector("p").textContent = `👨‍🏫 ${newGuru || "-"} — 🧑‍💻 ${newAsisten || "-"}`;

    // Update header tanggal + semua cell data-date pada kolom itu
    const headRow = document.querySelector("#absensi-table thead tr");
    const thDates = headRow.querySelectorAll("th[data-date]");
    const targetTh = thDates[idx];
    if (targetTh) {
      const oldDate = targetTh.dataset.date;
      targetTh.dataset.date = newDate;
      targetTh.textContent = formatDateDDMMM(newDate);

      // Update cell tbody untuk kolom yang sama (idx sejajar dengan thDates)
      document.querySelectorAll("#absensi-table tbody tr").forEach(tr => {
        const dateCells = Array.from(tr.querySelectorAll("td[data-date]"));
        const targetCell = dateCells[idx];
        if (targetCell) {
          targetCell.dataset.date = newDate;
          // status & text tetap (✓/x/-), hanya meta tanggalnya yang berubah
        }
      });
    }

    // Rehitung total
    updateTotalsRow();
    showToast("✔ Materi berhasil diupdate");
    document.getElementById("popup-materi").style.display = "none";
  });

  // Cancel popup
  document.getElementById("cancel-popup").addEventListener("click", () => {
    document.getElementById("popup-materi").style.display = "none";
  });

  // Logout
  document.getElementById("logout-btn").addEventListener("click", () => {
    if (confirm("Apakah Anda yakin ingin logout?")) {
      showToast("✔ Logout berhasil");
    }
  });
});