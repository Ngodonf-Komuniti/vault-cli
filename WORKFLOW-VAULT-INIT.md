# Workflow Pengerjaan Vault Init

## 1. Tujuan

Dokumen ini mencatat tahapan pengerjaan fitur `vault init` pada branch `feature/vault-init`, mulai dari memahami kontrak proyek, membangun modul yang dibutuhkan, mengintegrasikan CLI, menulis pengujian, sampai memeriksa hasil sebelum commit.

Dokumen ini berfokus pada pekerjaan yang telah dilakukan dan hasil yang telah diverifikasi. Dokumen ini tidak menyatakan bahwa fitur sudah di-commit atau di-merge.

## 2. Memahami Kontrak dan Struktur Proyek

Sebelum implementasi, kita meninjau aturan proyek agar fitur baru tetap mengikuti arsitektur yang sudah disepakati.

Hal-hal yang menjadi acuan:

- Proyek menggunakan ESM.
- Fungsi bersama menggunakan named exports.
- CLI menjadi satu-satunya lapisan yang menangani interaksi terminal, output, dan penanganan error untuk pengguna.
- Vault Service mengoordinasikan logika bisnis.
- Crypto, Storage, dan Validation memiliki tanggung jawab terpisah.
- Master password tidak boleh diterima melalui argumen CLI atau environment variable.
- Vault yang sudah ada tidak boleh ditimpa.

## 3. Menentukan Kontrak Fitur

Sebelum menghubungkan modul, kita menetapkan perilaku `vault init`.

Fitur ini harus:

- Membuat vault baru dalam keadaan kosong.
- Meminta master password dua kali melalui prompt tersembunyi.
- Menolak konfirmasi password yang tidak cocok.
- Memvalidasi master password.
- Memastikan vault belum ada.
- Mengenkripsi data awal sebelum menyimpannya.
- Menampilkan pesan sukses setelah proses berhasil.
- Mengembalikan error yang sesuai apabila proses gagal.

Data awal vault yang digunakan:

```json
{
  "version": 1,
  "credentials": []
}
```

## 4. Membangun Modul Pendukung

Implementasi kemudian dibagi berdasarkan tanggung jawab masing-masing modul.

### 4.1. Error Definitions

File: `src/utils/errors.js`

Menyediakan `VaultError` dan `ErrorCode` agar kegagalan dapat disampaikan dengan kode yang konsisten antarmodul.

### 4.2. Validation

File: `src/utils/validation.js`

Menyediakan validasi master password. Validasi yang sudah diterapkan menolak input yang bukan string atau kosong setelah pemangkasan whitespace.

Aturan kekuatan password tambahan belum ditentukan dalam kontrak yang tersedia.

### 4.3. Crypto

File: `src/crypto/vaultCrypto.js`

Menyediakan fungsi enkripsi data vault menggunakan AES-256-GCM dan derivasi kunci PBKDF2-HMAC-SHA-256 dengan 600.000 iterasi.

Hasil enkripsi disimpan dalam bentuk envelope yang berisi metadata, salt, nonce, authentication tag, dan ciphertext.

### 4.4. Storage

File: `src/storage/vaultFile.js`

Menyediakan operasi untuk:

- Menentukan lokasi vault.
- Memeriksa keberadaan vault.
- Membaca file vault.
- Menulis envelope ke file.
- Menggunakan file sementara dan mekanisme rename saat penulisan.
- Menerapkan permission terbatas pada direktori dan file.

### 4.5. Prompt Master Password

File: `src/utils/promptSecret.js`

Menyediakan `promptSecret()` untuk menerima input tersembunyi melalui readline. Opsi konfirmasi digunakan untuk meminta password kedua dan memeriksa kecocokannya.

## 5. Mengimplementasikan Vault Service

File: `src/services/vaultService.js`

Service `initVault()` mengoordinasikan proses inisialisasi dengan urutan berikut:

1. Memvalidasi master password.
2. Memeriksa apakah vault sudah ada.
3. Membuat data vault awal.
4. Mengenkripsi data awal.
5. Menyimpan envelope melalui Storage.

Service tidak menampilkan pesan ke terminal. Kegagalan diteruskan melalui mekanisme error.

## 6. Mengintegrasikan Command ke CLI

File: `src/commands/init.js`

Command `init` didaftarkan melalui `registerInitCommand(program)`.

Alur command:

1. Meminta master password dan konfirmasinya.
2. Menentukan path vault menggunakan `resolveVaultPath()`.
3. Memanggil `initVault()`.
4. Menampilkan pesan sukses jika proses selesai.

File: `src/cli.js`

CLI mendaftarkan command dan menangani error pada tingkat teratas. Error yang dikenal ditampilkan menggunakan pesan aman; error tak terduga ditampilkan dengan pesan umum tanpa membocorkan detail internal.

## 7. Menambahkan Pengujian

Pengujian yang ditambahkan mencakup modul service, validasi, crypto, dan storage.

Skrip pengujian dijalankan melalui:

```bash
npm test
```

Pengujian khusus `promptSecret` tidak menjadi fokus pekerjaan ini.

## 8. Menjalankan Pemeriksaan Kualitas

Setelah implementasi, pemeriksaan dilakukan menggunakan:

```bash
npm test
npm run lint
git diff --cached --check
```

Hasil yang terakhir dilaporkan:

- `npm test`: 54 pengujian lulus dan tidak ada yang gagal.
- `npm run lint`: lulus.
- `git diff --cached --check`: tidak melaporkan masalah whitespace.

Hasil tersebut berlaku untuk kondisi kode saat pemeriksaan dilakukan. Jika ada perubahan setelahnya, pemeriksaan perlu dijalankan kembali.

## 9. Menyiapkan Dokumentasi Fitur

Dokumentasi fitur dipisahkan dari README utama agar perubahan tidak mengganggu dokumentasi proyek yang sudah ada.

File yang disiapkan:

- `README-vault-init.md`: menjelaskan penggunaan, perilaku, modul, dan batasan fitur.
- `WORKFLOW-VAULT-INIT.md`: mencatat tahapan pengerjaan dari kontrak awal hingga pemeriksaan kualitas.

README utama tetap tidak diubah selama tahap ini.

## 10. Pemeriksaan Sebelum Commit

Sebelum commit, lakukan pemeriksaan akhir:

```bash
git status --short
git diff --cached --check
npm test
npm run lint
```

Periksa juga bahwa file yang akan di-commit memang sesuai cakupan fitur `vault init`, dan tidak ada perubahan yang tidak disengaja.

Ada satu hal implementasi yang perlu diperiksa sebelum menyatakan perlindungan terhadap overwrite benar-benar aman: pola pemeriksaan keberadaan file yang diikuti operasi rename dapat memiliki kondisi race jika dua proses mencoba membuat vault pada saat bersamaan.

## 11. Status Akhir Pengerjaan

Berdasarkan pemeriksaan terakhir yang dilaporkan:

- Implementasi `vault init` sudah dibuat dan diintegrasikan ke CLI.
- Pengujian dan lint telah lulus.
- Dokumentasi khusus fitur sedang disiapkan.
- Perubahan belum dinyatakan selesai melalui commit atau merge.
- Pemeriksaan akhir terhadap perlindungan overwrite dan kondisi working tree tetap diperlukan sebelum commit.

Dokumen ini mencatat hasil pekerjaan yang telah dilaporkan, bukan jaminan bahwa seluruh risiko implementasi sudah diselesaikan.
