# Wedding Studio — Dokumentasi Keamanan & Arsitektur Produksi

Platform SaaS pembuatan undangan pernikahan digital yang telah melalui proses *security hardening*, arsitektur relasional ACID, mitigasi *race condition*, dan sistem *file upload* produksi.

---

## 1. Arsitektur Produksi & Keamanan

### A. Autentikasi & Manajemen Sesi (Hardened)
- **Password Hashing**: Menggunakan algoritma **bcrypt** (salt rounds 10) dengan proteksi *rainbow table* dan *brute-force resistance*.
- **Migrasi Transparan**: Akun lama yang sebelumnya menggunakan SHA-256 diverifikasi secara aman dan otomatis di-upgrade ke bcrypt pada saat login berikutnya tanpa kehilangan data atau menyimpan password mentah.
- **Session Tokens**: Token acak kriptografis 256-bit (`crypto.randomBytes(32).toString('hex')`) berpanjang 64 karakter heksadesimal.
- **Pencabutan Sesi (Revocation)**: Hash SHA-256 dari token disimpan di tabel `sessions`. Logout via `POST /api/auth/logout` secara eksplisit mencabut sesi (`is_revoked = 1`).
- **Masa Berlaku (TTL)**: Setiap sesi dibatasi masa berlaku 7 hari (`expires_at`), mencegah token aktif tanpa batas.
- **Identitas Terverifikasi**: Seluruh endpoint privat mengambil `user_id` dari sesi terverifikasi di server (`req.authUser.id`), bukan dari parameter input klien.

### B. Database Relasional Produksi (ACID & WAL Mode)
- **Engine**: SQLite Relasional Produksi (`data/production_wedding_studio.sqlite3`) dengan mode **WAL (Write-Ahead Logging)** dan penegakan **Foreign Keys** aktif.
- **Tabel Relasional**:
  - `users`: Data akun dan tingkat paket (`free`, `pro_monthly`, `pro_yearly`).
  - `sessions`: Tabel sesi kriptografis server-side dengan indeks `expires_at`.
  - `weddings`: Data proyek undangan pernikahan lengkap.
  - `rsvps`: Konfirmasi kehadiran tamu dengan relasi kaskade (`ON DELETE CASCADE`).
  - `guest_messages`: Buku tamu dan doa restu.
  - `media_files`: Metadata file foto fisik yang diunggah pengguna.
- **Supabase / PostgreSQL**: Disediakan migrasi SQL sinkron di `supabase/migrations/001_initial_schema.sql` jika aplikasi dihubungkan langsung ke Supabase melalui `.env`.

### C. Pencegahan Race Condition & Penegakan Kuota Free
- **Transaksi Kritis**: Publikasi undangan menggunakan transaksi `BEGIN IMMEDIATE` yang mengunci operasi tulis sebelum memeriksa kuota.
- **Uji Konkurensi**: Teruji dengan dua request publikasi simultan (`Promise.all`); tepat 1 request berhasil (HTTP 200) dan 1 request ditolak (HTTP 400), membuktikan kuota Free 1 undangan aktif tidak dapat ditembus via serangan *race condition*.

### D. File Upload Fisik Produksi (Multer)
- **Endpoint**: `POST /api/media/upload` (memerlukan autentikasi sesi).
- **Validasi Server-Side**:
  - Batas ukuran file maksimum 5MB.
  - Hanya menerima MIME type gambar aman: `image/jpeg`, `image/png`, `image/webp`. File berbahaya (.sh, .exe, .html) ditolak dengan HTTP 400.
  - Nama file pengguna diabaikan sepenuhnya; server menghasilkan UUID acak unik (`crypto.randomUUID() + ext`).
  - File disimpan di folder persisten `uploads/` dan disajikan statis dengan header keamanan `X-Content-Type-Options: nosniff`.

---

## 2. Ringkasan Hasil Pengujian Otomatis (18/18 Lulus)

Skrip pengujian otomatis dijalankan melalui `node tests/production_security_suite.cjs`:

1. `[PASS]` Registrasi Akun baru dengan Bcrypt (Status 201).
2. `[PASS]` Pembuatan Token Acak 256-bit (64 hex characters).
3. `[PASS]` Verifikasi Login dengan Bcrypt (Status 200).
4. `[PASS]` Penolakan Token Palsu / Tampered Token (Status 401).
5. `[PASS]` Logout & Pencabutan Sesi di Server (Status 200).
6. `[PASS]` Token yang Telah Dicabut Ditolak pada Request Selanjutnya (Status 401).
7. `[PASS]` Pembuatan Undangan Pernikahan oleh Akun A (Status 201).
8. `[PASS]` Akun B Ditolak saat Membaca Undangan Akun A - IDOR Blocked (Status 403).
9. `[PASS]` Akun B Ditolak saat Mengubah Undangan Akun A - IDOR Blocked (Status 403).
10. `[PASS]` Akun B Ditolak saat Menghapus Undangan Akun A - IDOR Blocked (Status 403).
11. `[PASS]` Undangan Kedua Otomatis Menjadi Draf Privat pada Paket Free.
12. `[PASS]` Penolakan Permintaan Publikasi Undangan Kedua via API (Status 400).
13. `[PASS]` Transaksi Atomik Menggagalkan Race Condition Publikasi Bersamaan (1 Lolos, 1 Ditolak).
14. `[PASS]` Pengiriman RSVP Normal (Status 201).
15. `[PASS]` Rate Limiting RSVP Memblokir Permintaan Beruntun < 3 Detik (Status 429).
16. `[PASS]` Upload File Gambar Valid JPG/PNG/WebP Berhasil (Status 201).
17. `[PASS]` Upload Tipe File Terlarang Ditolak oleh Server (Status 400).
18. `[PASS]` Integritas Persistensi Data Relasional SQLite Terverifikasi.
