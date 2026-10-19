# Dokumentasi Fitur `vault init`

## 1. Gambaran Umum

Perintah `vault init` digunakan untuk membuat vault baru yang terenkripsi. Vault dibuat dalam keadaan kosong dan tidak boleh menimpa file vault yang sudah ada.

Saat inisialisasi, pengguna diminta memasukkan master password dua kali melalui prompt tersembunyi. Password tidak ditampilkan di terminal dan tidak boleh diberikan sebagai argumen CLI atau variabel lingkungan.

## 2. Cara Menjalankan

Jalankan salah satu perintah berikut dari root proyek:

**Menggunakan CLI secara langsung:**

```bash
node src/cli.js init
```

**Menggunakan command `vault-init`:**

```bash
vault-init
```

Ikuti prompt untuk memasukkan master password dan mengonfirmasinya.

Jika berhasil, CLI menampilkan pesan dengan format:

```text
Vault created at <path>.
```

Lokasi yang ditampilkan adalah path vault yang digunakan oleh aplikasi.

## 3. Lokasi Vault

Lokasi vault ditentukan oleh fungsi `resolveVaultPath()` dengan urutan prioritas berikut:

1. Path override yang diberikan kepada fungsi.
2. Variabel lingkungan `VAULT_PATH`.
3. Lokasi default `~/.local/share/vault-cli/vault.json`.

Contoh menentukan lokasi melalui variabel lingkungan:

```bash
VAULT_PATH="$HOME/my-vault/vault.json" node src/cli.js init
```

Path yang dipakai saat inisialisasi ditentukan oleh konfigurasi tersebut. Pastikan lokasi yang dipilih sesuai dengan kebutuhan.

## 4. Alur Inisialisasi

Secara umum, proses `vault init` berjalan sebagai berikut:

1. CLI meminta master password secara tersembunyi.
2. CLI meminta konfirmasi master password.
3. CLI menentukan lokasi vault.
4. Service memvalidasi master password.
5. Service memeriksa apakah vault sudah ada.
6. Service membuat struktur data awal.
7. Data dienkripsi menggunakan modul kriptografi.
8. Envelope hasil enkripsi disimpan melalui modul storage.
9. CLI menampilkan pesan keberhasilan.

Jika terjadi kegagalan, penanganan error dilakukan oleh handler utama CLI.

## 5. Struktur Data Awal

Vault baru dimulai dengan struktur data berikut sebelum dienkripsi:

```json
{
  "version": 1,
  "credentials": []
}
```

Artinya, vault menggunakan versi struktur data `1` dan belum memiliki credential.

## 6. Enkripsi dan Penyimpanan

Modul kriptografi bertanggung jawab untuk mengenkripsi data vault. Implementasi saat ini menggunakan:

- **Algoritma enkripsi:** AES-256-GCM.
- **Derivasi kunci:** PBKDF2 dengan HMAC-SHA-256.
- **Jumlah iterasi PBKDF2:** 600.000.
- **Panjang kunci:** 32 byte.
- **Salt:** 16 byte acak.
- **Nonce:** 12 byte acak.

Envelope menyimpan metadata algoritma, salt, nonce, authentication tag, dan ciphertext dalam representasi yang sesuai dengan implementasi.

Modul storage menangani penulisan file dan menggunakan izin direktori serta file yang dibatasi. Implementasi juga menggunakan file sementara dan operasi rename untuk membantu proses penulisan secara atomik.

## 7. Penanganan Error

Perintah dapat mengalami kegagalan dalam kondisi berikut:

| Kode error | Kondisi |
|---|---|
| `VAULT_ALREADY_EXISTS` | File vault sudah ada; vault tidak boleh ditimpa. |
| `INVALID_INPUT` | Master password tidak valid atau kedua password tidak cocok. |
| `STORAGE_ERROR` | Terjadi masalah saat memeriksa atau menyimpan file vault. |

Error ditangani oleh handler utama CLI. Pesan error tidak boleh membocorkan master password, data rahasia, atau detail internal yang sensitif.

Perintah ini tidak menyediakan opsi `--force` untuk menimpa vault yang sudah ada.

## 8. Batasan

- Vault baru dibuat tanpa credential.
- Master password dimasukkan melalui prompt tersembunyi.
- Aturan kekuatan password tambahan belum ditetapkan dalam kontrak yang tersedia; jangan mengasumsikan batas minimum panjang atau aturan kompleksitas tertentu.
- Penggunaan vault untuk menyimpan password produksi belum boleh dianggap siap sebelum kesiapan keamanan proyek dikonfirmasi.
- Perilaku pada lingkungan non-interaktif mengikuti ketentuan yang telah disepakati dalam proyek.

## 9. Pengujian dan Lint

Jalankan pengujian:

```bash
npm test
```

Jalankan pemeriksaan lint:

```bash
npm run lint
```

Periksa perubahan sebelum melakukan commit:

```bash
git diff --check
git diff --cached --check
git status --short
```

## 10. Batas Tanggung Jawab dan Arsitektur Modul

Arsitektur `vault init` mengikuti arah dependensi berikut:

```text
CLI (src/cli.js)
 ├── Commands (src/commands/)
 │    └── Init Command
 │         ├── Vault Service
 │         └── Storage (resolveVaultPath)
 │
 └── Error Handler
      └── Menampilkan error yang aman kepada pengguna

Vault Service
 ├── Crypto
 ├── Storage
 └── Validation

Shared Error Definitions
 └── VaultError dan ErrorCode
```

### Tanggung Jawab Modul

- **CLI (`src/cli.js`):** membuat program CLI, mendaftarkan command, dan menangani error pada tingkat teratas. CLI menjadi satu-satunya lapisan yang menampilkan pesan kepada pengguna dan menentukan status keluar proses.
- **Commands (`src/commands/`):** mendaftarkan command dan menjalankan alur interaksi pengguna. `Init Command` mengambil master password melalui prompt tersembunyi, menentukan path vault, memanggil service, dan menampilkan pesan sukses.
- **Vault Service (`src/services/`):** mengoordinasikan proses inisialisasi vault, termasuk validasi password, pemeriksaan keberadaan vault, enkripsi data awal, dan penyimpanan hasilnya.
- **Crypto (`src/crypto/`):** mengenkripsi data vault dan menghasilkan envelope terenkripsi.
- **Storage (`src/storage/`):** menentukan lokasi vault serta menangani pemeriksaan keberadaan dan operasi file vault.
- **Validation (`src/utils/validation.js`):** memvalidasi input seperti master password dan menghasilkan error validasi jika input tidak memenuhi ketentuan.
- **Shared Error Definitions (`src/utils/errors.js`):** menyediakan `VaultError` dan `ErrorCode` agar modul dapat menyampaikan kegagalan secara konsisten tanpa menampilkan pesan langsung ke terminal.

### Aturan Dependensi dan Penanganan Error

1. CLI boleh memanggil command, service, dan utilitas yang diperlukan oleh lapisan CLI.
2. Command memanggil service untuk menjalankan operasi vault; command tidak menangani penyimpanan atau enkripsi secara langsung.
3. Vault Service mengoordinasikan Crypto, Storage, dan Validation.
4. Crypto, Storage, dan Validation tidak bergantung satu sama lain maupun pada Vault Service.
5. Modul selain CLI tidak boleh menampilkan pesan ke terminal atau meminta input langsung dari pengguna.
6. Modul dapat melempar `VaultError` dengan kode error yang sesuai. Error diteruskan ke error handler tingkat teratas di CLI untuk ditampilkan secara aman.
7. Informasi internal atau penyebab teknis yang sensitif tidak boleh ditampilkan kepada pengguna. Untuk error yang tidak dikenal, CLI menampilkan pesan umum.

Dengan pemisahan ini, command menangani interaksi, service mengoordinasikan logika bisnis, modul pendukung menjalankan tanggung jawab spesifik, dan CLI menjadi pusat penanganan output serta error untuk pengguna.

## 11. Workflow Inisialisasi Vault

Alur inisialisasi vault berjalan sebagai berikut:

```text
User
  │
  ▼
CLI (src/cli.js)
  │
  ▼
Init Command (src/commands/init.js)
  │
  ├── Meminta master password secara tersembunyi
  │   dan mengonfirmasinya
  │
  ├── Menentukan lokasi vault
  │
  ▼
Vault Service (src/services/vaultService.js)
  │
  ├── Memvalidasi master password
  ├── Memeriksa apakah vault sudah ada
  ├── Membuat data vault awal
  ├── Mengenkripsi data vault
  └── Menyimpan envelope terenkripsi
  │
  ▼
Storage (src/storage/vaultFile.js)
  │
  ▼
Vault berhasil dibuat
  │
  ▼
CLI menampilkan pesan sukses
```

Jika terjadi kegagalan, error diteruskan ke error handler pada CLI untuk ditampilkan kepada pengguna. Vault yang sudah ada tidak boleh ditimpa.

Data awal vault:

```json
{
  "version": 1,
  "credentials": []
}
```

Pesan sukses:

```text
Vault created at <path>.
```

Workflow ini hanya mencakup inisialisasi vault kosong, sesuai implementasi saat ini.