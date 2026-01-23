/**
 * Project: Manajemen Data Sekolah Terpadu
 * Version: 2.3 (Full Production Ready)
 * Last Update: 2026-01-22
 * Description: Integrasi CRUD Sekolah, Kelas, dan Siswa dengan fitur Dynamic Rows & Modal.
 */

import { supabase } from './config.js';

// --- 1. GLOBAL STATE & SELECTORS ---
let deleteTargetId = null;
let deleteCategory = ''; // 'school', 'class', 'student'

// Form & Table Elements
const schoolForm = document.getElementById('school-form');
const classForm = document.getElementById('class-form');
const studentForm = document.getElementById('student-form');

const schoolTableBody = document.querySelector('#school-list tbody');
const classTableBody = document.querySelector('#class-list tbody');
const studentTableBody = document.querySelector('#student-list tbody');
const studentInputTableBody = document.querySelector('#student-input-table tbody');

// Dropdowns
const schoolSelectKelas = document.getElementById('school_id');
const schoolSelectSiswa = document.getElementById('school_id_siswa');
const classSelectSiswa = document.getElementById('class_id_siswa');
const yearSelect = document.getElementById('academic_year');
const semesterSelect = document.getElementById('semester');

// --- 2. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initDynamicStudentRows();
    await refreshInitialData();
});

async function refreshInitialData() {
    await loadSchools();       // Load data sekolah & dropdown
    await loadAcademicYears(); // Load tahun ajaran
    await loadClassesTable();  // Load tabel kelas
    setupLevelOptions();       // Load opsi level
}

// --- 3. LOGIKA NAVIGATION (TAB) ---
function initTabs() {
    const tabs = document.querySelectorAll('.tab-menu button');
    const sections = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            tab.classList.add('active');
            const targetId = tab.id.replace('btn-', 'tab-');
            document.getElementById(targetId).classList.add('active');
        });
    });
}

// --- 4. LOGIKA TAB SEKOLAH ---
async function loadSchools() {
    const { data, error } = await supabase.from('schools').select('*').order('name');
    if (error) return console.error(error);

    // Update Tabel
    schoolTableBody.innerHTML = data.map((s, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${s.name}</td>
            <td>${s.address}</td>
            <td>
                <button onclick="editSchool('${s.id}')">Edit</button>
                <button onclick="openDeleteModal('${s.id}', 'school')" class="btn-delete">Hapus</button>
            </td>
        </tr>
    `).join('');

    // Update Dropdowns di tab lain
    const options = ['<option value="">-- Pilih Sekolah --</option>', ...data.map(s => `<option value="${s.id}">${s.name}</option>`)].join('');
    schoolSelectKelas.innerHTML = options;
    schoolSelectSiswa.innerHTML = options;
}

schoolForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = schoolForm.dataset.editId;
    const payload = {
        name: document.getElementById('school_name').value,
        address: document.getElementById('school_address').value
    };

    const { error } = id 
        ? await supabase.from('schools').update(payload).eq('id', id)
        : await supabase.from('schools').insert([payload]);

    if (!error) {
        alert('Sekolah berhasil disimpan');
        schoolForm.reset();
        delete schoolForm.dataset.editId;
        loadSchools();
    }
});

// --- 5. LOGIKA TAB KELAS ---
async function loadAcademicYears() {
    const { data } = await supabase.from('academic_years').select('*').order('year');
    yearSelect.innerHTML = '<option value="">-- Tahun Ajaran --</option>' + 
        data.map(y => `<option value="${y.id}">${y.year}</option>`).join('');
}

yearSelect.addEventListener('change', async (e) => {
    const { data } = await supabase.from('semesters').select('*').eq('academic_year_id', e.target.value);
    semesterSelect.innerHTML = '<option value="">-- Pilih Semester --</option>' + 
        data.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
});

function setupLevelOptions() {
    const levels = ['Kiddy', 'Beginner', 'Intermediate', 'Advanced'];
    document.getElementById('level').innerHTML = '<option value="">-- Pilih Level --</option>' + 
        levels.map(l => `<option value="${l}">${l}</option>`).join('');
}

async function loadClassesTable() {
    const { data } = await supabase.from('classes').select('*, schools(name), academic_years(year), semesters(name)');
    classTableBody.innerHTML = data.map((c, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${c.name}</td>
            <td>${c.schools?.name || '-'}</td>
            <td>${c.academic_years?.year || '-'}</td>
            <td>${c.semesters?.name || '-'}</td>
            <td>${c.level}</td>
            <td>${c.jadwal}</td>
            <td>
                <button onclick="editClass('${c.id}')">Edit</button>
                <button onclick="openDeleteModal('${c.id}', 'class')" class="btn-delete">Hapus</button>
            </td>
        </tr>
    `).join('');
}

classForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = classForm.dataset.editId;
    const payload = {
        name: document.getElementById('class_name').value,
        school_id: schoolSelectKelas.value,
        academic_year_id: yearSelect.value,
        semester_id: semesterSelect.value,
        level: document.getElementById('level').value,
        jadwal: document.getElementById('schedule').value
    };

    const { error } = id 
        ? await supabase.from('classes').update(payload).eq('id', id)
        : await supabase.from('classes').insert([payload]);

    if (!error) {
        alert('Kelas berhasil disimpan');
        classForm.reset();
        delete classForm.dataset.editId;
        loadClassesTable();
    }
});

// --- 6. LOGIKA TAB SISWA ---
function initDynamicStudentRows() {
    document.getElementById('add-row-btn').addEventListener('click', () => {
        if (studentForm.dataset.editId) return alert('Selesaikan edit siswa terlebih dahulu!');
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="text" name="student_name" required style="width: 95%;"></td>
            <td><input type="text" name="student_grade" style="width: 95%;"></td>
            <td><button type="button" class="btn-remove-row" style="color:red; border:none; background:none; cursor:pointer;">x</button></td>
        `;
        studentInputTableBody.appendChild(row);
        row.querySelector('.btn-remove-row').onclick = () => row.remove();
    });
}

schoolSelectSiswa.addEventListener('change', async (e) => {
    const { data } = await supabase.from('classes').select('id, name').eq('school_id', e.target.value);
    classSelectSiswa.innerHTML = '<option value="">-- Pilih Kelas --</option>' + 
        data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
});

classSelectSiswa.addEventListener('change', (e) => {
    if (e.target.value) loadStudentsList(e.target.value);
});

async function loadStudentsList(classId) {
    const { data } = await supabase.from('students').select('*').eq('class_id', classId).order('name');
    studentTableBody.innerHTML = data.length ? data.map((s, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${s.name}</td>
            <td>${s.grade || '-'}</td>
            <td>
                <button onclick="editStudent('${s.id}')">Edit</button>
                <button onclick="openDeleteModal('${s.id}', 'student')" class="btn-delete">Hapus</button>
            </td>
        </tr>
    `).join('') : '<tr><td colspan="4">Tidak ada siswa</td></tr>';
}

studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = studentForm.dataset.editId;
    const classId = classSelectSiswa.value;

    if (editId) {
        const row = studentInputTableBody.querySelector('tr');
        const payload = {
            name: row.querySelector('input[name="student_name"]').value.trim(),
            grade: row.querySelector('input[name="student_grade"]').value.trim()
        };
        await supabase.from('students').update(payload).eq('id', editId);
        delete studentForm.dataset.editId;
        document.getElementById('save-students-btn').textContent = 'Simpan Semua Siswa';
    } else {
        const students = Array.from(studentInputTableBody.querySelectorAll('tr')).map(row => ({
            name: row.querySelector('input[name="student_name"]').value,
            grade: row.querySelector('input[name="student_grade"]').value,
            school_id: schoolSelectSiswa.value,
            class_id: classId
        })).filter(s => s.name);

        await supabase.from('students').insert(students);
    }

    studentInputTableBody.innerHTML = `<tr><td><input type="text" name="student_name" required style="width: 95%;"></td><td><input type="text" name="student_grade" style="width: 95%;"></td><td></td></tr>`;
    loadStudentsList(classId);
});

// --- 7. MODAL & GLOBAL FUNCTIONS ---
window.openDeleteModal = (id, category) => {
    deleteTargetId = id;
    deleteCategory = category;
    document.getElementById('delete-modal').style.display = 'block';
};

document.getElementById('cancel-delete').onclick = () => {
    document.getElementById('delete-modal').style.display = 'none';
};

document.getElementById('confirm-delete').onclick = async () => {
    const tableMap = { 'school': 'schools', 'class': 'classes', 'student': 'students' };
    const { error } = await supabase.from(tableMap[deleteCategory]).delete().eq('id', deleteTargetId);
    
    if (!error) {
        document.getElementById('delete-modal').style.display = 'none';
        if (deleteCategory === 'school') loadSchools();
        if (deleteCategory === 'class') loadClassesTable();
        if (deleteCategory === 'student') loadStudentsList(classSelectSiswa.value);
    }
};

window.editSchool = async (id) => {
    const { data } = await supabase.from('schools').select('*').eq('id', id).single();
    document.getElementById('school_name').value = data.name;
    document.getElementById('school_address').value = data.address;
    schoolForm.dataset.editId = id;
    document.getElementById('btn-sekolah').click();
};

window.editClass = async (id) => {
    const { data } = await supabase.from('classes').select('*').eq('id', id).single();
    schoolSelectKelas.value = data.school_id;
    yearSelect.value = data.academic_year_id;
    await yearSelect.dispatchEvent(new Event('change'));
    semesterSelect.value = data.semester_id;
    document.getElementById('class_name').value = data.name;
    document.getElementById('level').value = data.level;
    document.getElementById('schedule').value = data.jadwal;
    classForm.dataset.editId = id;
    document.getElementById('btn-kelas').click();
};

window.editStudent = async (id) => {
    const { data } = await supabase.from('students').select('*').eq('id', id).single();
    const firstRow = studentInputTableBody.querySelector('tr');
    firstRow.querySelector('input[name="student_name"]').value = data.name;
    firstRow.querySelector('input[name="student_grade"]').value = data.grade;
    studentForm.dataset.editId = id;
    document.getElementById('save-students-btn').textContent = 'Update Siswa';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};