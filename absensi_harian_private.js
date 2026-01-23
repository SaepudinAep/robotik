// --- 1. KONFIGURASI & STATE ---
const state = {
    currentPertemuanId: null,
    siswaId: "STUDENT-UUID-ABC", // Placeholder
    mainAchievements: [
        { id: 'm1', title: 'Mekanik' },
        { id: 'm2', title: 'Coding' },
        { id: 'm3', title: 'Artikulasi' }
    ]
};

// --- 2. LOGIKA WARNA (MODULUS 4) ---
function updateThemeColor(pertemuanKe) {
    const monitoringSection = document.getElementById('section-monitoring');
    const cycle = Math.ceil(pertemuanKe / 4);
    const colorIndex = (cycle - 1) % 4;
    
    const themeClasses = ['bg-cycle-green', 'bg-cycle-orange', 'bg-cycle-blue', 'bg-cycle-purple'];
    
    // Reset dan pasang class baru
    monitoringSection.classList.remove(...themeClasses);
    monitoringSection.classList.add(themeClasses[colorIndex]);
}

// --- 3. TRANSISI FORM (LOCK & EDIT) ---
document.getElementById('btn-lock').addEventListener('click', () => {
    const pertemuanKe = document.getElementById('pertemuan_ke').value;
    const materi = document.getElementById('materi-input').value;

    if (!pertemuanKe || !materi) return alert("Lengkapi data pertemuan!");

    // Update Header Summary
    document.getElementById('sum-pertemuan').innerText = `Pertemuan #${pertemuanKe}`;
    document.getElementById('sum-materi').innerText = materi;

    // Jalankan Warna & Show/Hide
    updateThemeColor(pertemuanKe);
    document.getElementById('section-pertemuan').classList.add('hidden');
    document.getElementById('summary-header').classList.remove('hidden');
    document.getElementById('section-monitoring').classList.remove('hidden');
    
    // Tambah baris pertama secara otomatis jika tabel kosong
    if (document.getElementById('achievement-tbody').children.length === 0) {
        addNewRow();
    }
});

document.getElementById('btn-edit-header').addEventListener('click', () => {
    document.getElementById('section-pertemuan').classList.remove('hidden');
    document.getElementById('summary-header').classList.add('hidden');
    document.getElementById('section-monitoring').classList.add('hidden');
});

// --- 4. MANAJEMEN BARIS TABEL (DYNAMIC LINEAR ROW) ---
function addNewRow() {
    const tbody = document.getElementById('achievement-tbody');
    const row = document.createElement('tr');
    row.className = 'achievement-row';

    // Generate Pilihan Main Achievement
    const mainOptions = state.mainAchievements.map(item => 
        `<option value="${item.id}">${item.title}</option>`
    ).join('');

    row.innerHTML = `
        <td class="text-center">${tbody.children.length + 1}</td>
        <td>
            <select class="select-main-linear">
                <option value="">- Pilih Main -</option>
                ${mainOptions}
            </select>
        </td>
        <td><input type="text" class="input-sub-linear" placeholder="Sub materi..."></td>
        <td>
            <div class="star-rating">
                ${[1, 2, 3, 4, 5].map(num => `<span class="star ${num === 5 ? 'active' : ''}" data-val="${num}">★</span>`).join('')}
                <input type="hidden" class="star-value" value="5">
            </div>
        </td>
        <td><input type="text" class="input-note-linear" placeholder="Catatan..."></td>
        <td class="text-center">
            <button type="button" class="btn-del-row">×</button>
        </td>
    `;

    // Event: Rating Bintang
    const stars = row.querySelectorAll('.star');
    stars.forEach(star => {
        star.addEventListener('click', (e) => {
            const val = e.target.dataset.val;
            row.querySelector('.star-value').value = val;
            stars.forEach(s => s.classList.toggle('active', s.dataset.val <= val));
        });
    });

    // Event: Hapus Baris
    row.querySelector('.btn-del-row').addEventListener('click', () => {
        row.remove();
        reorderRowNumbers();
    });

    tbody.appendChild(row);
}

function reorderRowNumbers() {
    const rows = document.querySelectorAll('#achievement-tbody tr');
    rows.forEach((row, index) => {
        row.cells[0].innerText = index + 1;
    });
}

document.getElementById('btn-add-row').addEventListener('click', addNewRow);

// --- 5. PENGUMPULAN DATA (SCRAPING) ---
document.getElementById('btn-save-final').addEventListener('click', async () => {
    const rows = document.querySelectorAll('.achievement-row');
    const payload = Array.from(rows).map(row => ({
        main: row.querySelector('.select-main-linear').value,
        sub: row.querySelector('.input-sub-linear').value,
        score: row.querySelector('.star-value').value,
        note: row.querySelector('.input-note-linear').value
    }));

    if (payload.some(p => !p.main || !p.sub)) {
        return alert("Harap lengkapi semua baris achievement!");
    }

    console.log("Data siap dikirim ke Supabase:", payload);
    alert("Data berhasil dikumpulkan! Cek console log.");
    // Di sini panggil fungsi insertSupabase(payload);
});

function renderHistory(dataHistory) {
    const grid = document.getElementById('history-grid');
    grid.innerHTML = ''; // Clear mockup

    dataHistory.forEach(item => {
        const cycleClass = getCycleClass(item.pertemuan_ke); // Fungsi modulus 4 kita tadi
        
        const card = document.createElement('div');
        card.className = `history-card ${cycleClass}`;
        card.innerHTML = `
            <span class="history-date">${item.tanggal}</span>
            <p class="history-materi"><b>P${item.pertemuan_ke}:</b> ${item.judul_materi}</p>
        `;
        grid.appendChild(card);
    });
}

// Helper untuk dapat nama class warna
function getCycleClass(no) {
    const cycle = Math.ceil(no / 4);
    const colors = ['cycle-green', 'cycle-orange', 'cycle-blue', 'cycle-purple'];
    return colors[(cycle - 1) % 4];
}