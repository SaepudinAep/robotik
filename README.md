# Sistem Absensi Siswa

Proyek ini adalah aplikasi web sederhana untuk **absensi siswa** berbasis Supabase.  
Didesain dengan gaya visual konsisten (Scratch colors, Fredoka One + Roboto font) dan navigasi modular untuk sekolah maupun kelas private.

---

## ✨ Fitur Utama

- **Dashboard Utama** dengan 6 card navigasi (Sekolah, Private, Registrasi Siswa, Registrasi Private, Profil Sekolah, Profil Kelas).
- **Absensi Sekolah**: menampilkan daftar kelas sesuai semester & tahun ajaran aktif.
- **Filter otomatis** berdasarkan semester (`Semester 1` / `Semester 2`) dan tahun ajaran (`2025/2026`).
- **Relasi Supabase**:
  - `classes → schools`
  - `classes → academic_years`
- **Card Kelas** hanya menampilkan nama kelas dan nama sekolah.
- **Autentikasi Supabase** dengan tombol logout.

---

## 🛠️ Teknologi

- **Frontend**: HTML, CSS, JavaScript (modular ES6).
- **Backend**: Supabase (PostgreSQL + Auth).
- **Styling**: Scratch color palette (#4d97ff, #ffab19, #fff3d6), font Fredoka One + Roboto.

---
