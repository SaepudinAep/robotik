// Import Supabase client dari CDN + config lokal
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { supabaseUrl, supabaseKey } from './config.js';

const supabase = createClient(supabaseUrl, supabaseKey);
const btnGuru = document.getElementById("btnGuru");
const btnMateri = document.getElementById("btnMateri");
const sectionGuru = document.getElementById("guru");
const sectionMateri = document.getElementById("materi");

// Default tampil Guru saat load
window.addEventListener("DOMContentLoaded", () => {
  sectionGuru.classList.add("active");
});

// Event tombol tab
btnGuru.addEventListener("click", (e) => {
  e.preventDefault();
  sectionGuru.classList.add("active");
  sectionMateri.classList.remove("active");
});

btnMateri.addEventListener("click", (e) => {
  e.preventDefault();
  sectionMateri.classList.add("active");
  sectionGuru.classList.remove("active");
});

// ===== CRUD Guru =====
const formGuru = document.getElementById("formGuru");
const resetGuru = document.getElementById("resetGuru");
const tableGuruBody = document.querySelector("#tableGuru tbody");
let editingGuruId = null;

// Insert/Update Guru
async function saveGuru(name, role) {
  if (editingGuruId) {
    const { error } = await supabase
      .from("teachers")
      .update({ name, role })
      .eq("id", editingGuruId);
    if (error) {
      console.error(error);
      alert("Gagal update Guru: " + error.message);
    } else {
      alert("Guru berhasil diperbarui");
    }
    editingGuruId = null;
  } else {
    const { error } = await supabase.from("teachers").insert([{ name, role }]);
    if (error) {
      console.error(error);
      alert("Gagal simpan Guru: " + error.message);
    } else {
      alert("Guru berhasil disimpan");
    }
  }
  loadGuru();
}

// Load Guru
async function loadGuru() {
  const { data, error } = await supabase.from("teachers").select();
  if (error) {
    console.error(error);
    return;
  }
  tableGuruBody.innerHTML = "";
  data.forEach((row, i) => {
    tableGuruBody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${row.name}</td>
        <td>${row.role}</td>
        <td>
          <button onclick="editGuru('${row.id}', '${row.name}', '${row.role}')">Edit</button>
          <button onclick="deleteGuru('${row.id}')">Delete</button>
        </td>
      </tr>`;
  });
}

// Delete Guru
window.deleteGuru = async function(id) {
  if (confirm("Yakin hapus data Guru?")) {
    const { error } = await supabase.from("teachers").delete().eq("id", id);
    if (error) {
      console.error(error);
      alert("Gagal hapus Guru: " + error.message);
    } else {
      loadGuru();
    }
  }
};

// Edit Guru
window.editGuru = function(id, name, role) {
  document.getElementById("guruName").value = name;
  document.getElementById("guruRole").value = role;
  editingGuruId = id;
};

// Event submit Guru
formGuru.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("guruName").value;
  const role = document.getElementById("guruRole").value;
  await saveGuru(name, role);
  formGuru.reset();
});

resetGuru.addEventListener("click", () => {
  formGuru.reset();
  editingGuruId = null;
});

// ===== CRUD Materi =====
const formMateri = document.getElementById("formMateri");
const resetMateri = document.getElementById("resetMateri");
const tableMateriBody = document.querySelector("#tableMateri tbody");
let editingMateriId = null;

// Insert/Update Materi
async function saveMateri(title, level, description, detail) {
  if (editingMateriId) {
    const { error } = await supabase
      .from("materi")
      .update({ title, level, description, detail })
      .eq("id", editingMateriId);
    if (error) {
      console.error(error);
      alert("Gagal update Materi: " + error.message);
    } else {
      alert("Materi berhasil diperbarui");
    }
    editingMateriId = null;
  } else {
    const { error } = await supabase
      .from("materi")
      .insert([{ title, level, description, detail }]);
    if (error) {
      console.error(error);
      alert("Gagal simpan Materi: " + error.message);
    } else {
      alert("Materi berhasil disimpan");
    }
  }
  loadMateri();
}

// Load Materi
async function loadMateri() {
  const { data, error } = await supabase.from("materi").select();
  if (error) {
    console.error(error);
    return;
  }
  tableMateriBody.innerHTML = "";
  data.forEach((row, i) => {
    tableMateriBody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${row.title}</td>
        <td>${row.level || ""}</td>
        <td>${row.description || ""}</td>
        <td>${row.detail || ""}</td>
        <td>
          <button onclick="editMateri('${row.id}', \`${row.title}\`, \`${row.level ?? ""}\`, \`${row.description ?? ""}\`, \`${row.detail ?? ""}\`)">Edit</button>
          <button onclick="deleteMateri('${row.id}')">Delete</button>
        </td>
      </tr>`;
  });
}

// Delete Materi
window.deleteMateri = async function(id) {
  if (confirm("Yakin hapus data Materi?")) {
    const { error } = await supabase.from("materi").delete().eq("id", id);
    if (error) {
      console.error(error);
      alert("Gagal hapus Materi: " + error.message);
    } else {
      loadMateri();
    }
  }
};

// Edit Materi
window.editMateri = function(id, title, level, description, detail) {
  document.getElementById("materiTitle").value = title;
  document.getElementById("materiLevel").value = level;
  document.getElementById("materiDesc").value = description;
  document.getElementById("materiDetail").value = detail;
  editingMateriId = id;
};

// Event submit Materi
formMateri.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("materiTitle").value;
  const level = document.getElementById("materiLevel").value;
  const description = document.getElementById("materiDesc").value;
  const detail = document.getElementById("materiDetail").value;
  await saveMateri(title, level, description, detail);
  formMateri.reset();
});

resetMateri.addEventListener("click", () => {
  formMateri.reset();
  editingMateriId = null;
});

// ===== Load awal =====
loadGuru();
loadMateri();
