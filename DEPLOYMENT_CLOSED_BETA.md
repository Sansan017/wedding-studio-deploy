# WEDDING STUDIO FREE — BUKU PANDUAN DEPLOYMENT CLOSED BETA

Dokumen operasional resmi untuk arsitektur, migrasi cloud persisten, backup, pemulihan bencana (disaster recovery), dan pelaksanaan uji coba tertutup (*Closed Beta* 2–5 pengguna).

---

## 1. Audit Platform & Arsitektur Hosting

### Lingkungan Hosting Aktual:
- **Platform**: Google Cloud Run (Serverless Containerized Runtime pada Google Cloud Platform, Region `asia-east1`).
- **Dev URL**: `https://ais-dev-k3e332jyesdkykimbnexr5-415559490732.asia-east1.run.app`
- **Shared App URL**: `https://ais-pre-k3e332jyesdkykimbnexr5-415559490732.asia-east1.run.app`
- **Metode Deployment**: Container image build (`npm run build`, `npm run start` via `tsx server.ts`).
- **Karakteristik Filesystem**: **EPHEMERAL (Sementara / Stateless)**.

### Analisis Risiko Ephemeral Storage:
1. **Database Lokal (`data/production_wedding_studio.sqlite3`)**:
   - Jika container di-*restart*, mengalami *cold-start* ulang, atau platform memutar instance baru (*scale-out*), data yang ditulis ke filesystem lokal akan kembali ke status saat *image* dibangun.
   - **Data Berisiko**: Akun baru pendaftar beta, token sesi, proyek undangan baru, konfirmasi RSVP tamu, dan ucapan doa.
2. **Penyimpanan Media Lokal (`uploads/`)**:
   - File foto cover dan galeri yang diunggah pengguna ke direktori lokal container juga berisiko hilang saat instance berganti.
3. **Kesimpulan Arsitektur**:
   - Untuk demonstrasi lokal atau *single-session testing*, SQLite WAL dan local storage berfungsi sangat cepat dan aman.
   - Namun, **untuk Closed Beta multi-hari dengan pengguna nyata (2–5 pengantin)**, aplikasi memerlukan **External Persistent Database (PostgreSQL/Supabase)** dan **Object Storage (Supabase Storage)**.

---

## 2. Arsitektur Adapter & Kesiapan Dual-Engine

Aplikasi kini telah dilengkapi dengan **Adapter Pattern** yang secara otomatis mendeteksi lingkungan tanpa merusak mode lokal:

```
                      ┌──────────────────────────────────────────────┐
                      │            Wedding Studio Backend            │
                      │               (Express + TS)                 │
                      └───────────────┬──────────────┬───────────────┘
                                      │              │
                   ┌──────────────────▼──┐        ┌──▼──────────────────┐
                   │   DatabaseAdapter   │        │   StorageAdapter    │
                   └──────────┬──────────┘        └──────────┬──────────┘
                              │                              │
              ┌───────────────┴──────────────┐       ┌───────┴───────┐
              ▼                              ▼       ▼               ▼
      [SqliteAdapter]               [PostgresAdapter][LocalStorage] [SupabaseStorage]
  (Default/Zero-Config)            (Cloud Persistent) (Default /uploads)(CDN Persistent)
```

1. **Database Adapter (`src/server/database_adapter.ts`)**:
   - `SqliteDatabaseAdapter`: Berjalan secara default tanpa variabel tambahan.
   - `PostgresDatabaseAdapter`: Otomatis aktif saat `DATABASE_URL` atau `SUPABASE_DATABASE_URL` dikonfigurasi di server.
2. **Storage Adapter (`src/server/storage_adapter.ts`)**:
   - `LocalStorageAdapter`: Menyimpan ke `/uploads/` dan memvalidasi *magic bytes*.
   - `SupabaseStorageAdapter`: Otomatis aktif saat `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` dikonfigurasi, mengunggah ke bucket `wedding-media` dan mengembalikan URL CDN publik permanen.
3. **System Status API (`/api/system/status`)**:
   - Menyediakan status real-time mengenai database aktif, storage aktif, dan peringatan *ephemeral filesystem*.

---

## 3. Layanan Eksternal & Konfigurasi yang Dibutuhkan

Bila siap menghubungkan ke persistent cloud (rekomendasi: **Supabase Free Tier**):

| Layanan | Komponen | Rekomendasi Paket | Biaya |
| :--- | :--- | :--- | :--- |
| **Database** | Managed PostgreSQL (Supabase / Neon) | Free Tier (500MB DB, 2 proyek gratis) | **$0 / Bulan** |
| **Object Storage** | Supabase Storage (Bucket: `wedding-media`) | Free Tier (1GB Storage, 2GB Bandwidth) | **$0 / Bulan** |
| **Compute** | Google Cloud Run (AI Studio Build Runtime) | Free Tier (2M requests/bulan) | **$0 / Bulan** |

### Environment Variables Server-Side (HANYA di Server / Secret Manager):
```bash
# Opsi A: Koneksi PostgreSQL Langsung
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

# Opsi B: Koneksi Supabase Storage & Database
SUPABASE_URL="https://[YOUR_PROJECT_REF].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="[YOUR_SERVICE_ROLE_KEY]"
SUPABASE_STORAGE_BUCKET="wedding-media"
```
*CATATAN KEAMANAN: Kredensial ini HANYA dibaca oleh server Express di backend. Tidak ada satupun secret yang terekspos ke bundle React frontend.*

---

## 4. Prosedur Backup & Pemulihan Bencana (Disaster Recovery)

Semua skrip operasional telah dibuat dan diverifikasi:

### A. Melakukan Backup Lengkap:
```bash
node scripts/backup_system.cjs
```
- Menghasilkan snapshot database SQLite (`production_wedding_studio.sqlite3`).
- Menghasilkan export data terstruktur format JSON portabel (`database_export.json`).
- Mengarsipkan seluruh file media dari `/uploads/`.
- Menghasilkan `manifest.json` berisi checksum SHA-256 dan hitungan baris setiap tabel.
- Folder keluaran: `backups/backup-YYYY-MM-DDTHH-mm-ss/`.

### B. Melakukan Pemulihan (Restore):
```bash
node scripts/restore_system.cjs [path_ke_folder_backup]
# Contoh jika tanpa argumen, otomatis mengambil backup terbaru:
node scripts/restore_system.cjs
```
- Memvalidasi checksum SHA-256 database.
- Mengembalikan SQLite dan folder `/uploads/`.
- Memverifikasi konsistensi tautan media (memastikan 0 missing files).

---

## 5. Prosedur Migrasi ke PostgreSQL & Rollback

### A. Uji Coba Simulasi (Dry-Run):
```bash
node scripts/migrate_to_postgres.cjs --dry-run
```
Memeriksa skema data SQLite dan mensimulasikan migrasi tanpa menyentuh target database.

### B. Eksekusi Migrasi Nyata:
```bash
export DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
node scripts/migrate_to_postgres.cjs
```
- Menerapkan DDL dari `supabase/migrations/002_standalone_postgres_schema.sql`.
- Menghitung jumlah data sebelum migrasi.
- Memindahkan data dalam urutan *foreign keys*: `users` -> `sessions` -> `weddings` -> `rsvps` -> `guest_messages` -> `media_files`.
- Menggunakan `ON CONFLICT DO NOTHING` / upsert aman sehingga **dapat dihentikan dan diulang berkali-kali tanpa duplikasi**.
- Verifikasi otomatis perbandingan baris sumber vs target.

### C. Prosedur Rollback:
Jika terjadi kegagalan atau ingin membatalkan migrasi:
1. Kosongkan variabel `DATABASE_URL` atau setel `DATABASE_PROVIDER=sqlite`.
2. Server Express secara instan kembali menggunakan SQLite lokal (`data/production_wedding_studio.sqlite3`).
3. File SQLite lokal **sama sekali tidak diubah atau dihapus** selama proses migrasi.

---

## 6. Hasil Verifikasi Test Suite (24/24 LULUS)

Pengujian nyata dilakukan melalui `node tests/closed_beta_verification.cjs`:
1. `[PASS]` Endpoint `/api/system/status` Berfungsi (HTTP 200).
2. `[PASS]` SQLite Berjalan pada Mode WAL Concurrency.
3. `[PASS]` Peringatan Resiko Ephemeral Filesystem Aktif.
4. `[PASS]` Registrasi Akun A Berhasil.
5. `[PASS]` Login Akun A Berhasil (Token 256-bit).
6. `[PASS]` Password Hash Menggunakan Bcrypt Cost 10.
7. `[PASS]` Session Token 256-bit Hexadecimal Kriptografis.
8. `[PASS]` Logout Sesi Berhasil.
9. `[PASS]` Token yang Telah Dicabut Ditolak (HTTP 401).
10. `[PASS]` User A Membuat Undangan Pernikahan.
11. `[PASS]` User B Ditolak Mengakses Undangan User A — Anti-IDOR (HTTP 403).
12. `[PASS]` User B Ditolak Mengubah Undangan User A — Anti-IDOR (HTTP 403).
13. `[PASS]` User B Ditolak Menghapus Undangan User A — Anti-IDOR (HTTP 403).
14. `[PASS]` Kuota Free: Tepat 1 Undangan Berhasil Dipublikasikan.
15. `[PASS]` Kuota Free: Undangan Kedua Simultan Ditolak — Race Condition Blocked (HTTP 400).
16. `[PASS]` Halaman Publik Undangan Berhasil Dibuka.
17. `[PASS]` Field Sensitif `owner_id` Dihapus dari Respon Publik.
18. `[PASS]` Field Sensitif `password_hash` Tidak Pernah Terekspos ke Publik.
19. `[PASS]` File Kamuflase (.png palsu berisi skrip) Ditolak oleh Magic Bytes (HTTP 400).
20. `[PASS]` File Gambar PNG Asli Berhasil Diunggah dan Diberi Nama Acak UUID.
21. `[PASS]` Backup Database & Media Berhasil Dibuat dengan Checksum SHA-256.
22. `[PASS]` Restore Database Berhasil Diverifikasi 100%.
23. `[PASS]` Integritas Referensi File Media Sempurna (0 Missing Files).
24. `[PASS]` Simulasi Migrasi Aman ke PostgreSQL Berjalan Lancar.
