# AI-CONTEXT: WMS (Sistem Manajemen Gudang)

Terakhir diperbarui: 27 Oktober 2026.

File ini diberikan ke asisten AI sebagai konteks proyek. Pemilik proyek menulis kodenya sendiri dan memakai AI sebagai mentor (lihat bagian 11), bukan sebagai penulis fitur. Jika instruksi pengguna bertentangan dengan file ini, ikuti pengguna dan sebutkan konfliknya. Jika sesuatu tidak tertulis di sini atau di `schema.prisma`, jangan mengarang; tanyakan atau usulkan sebagai perubahan.

## 1. Tentang proyek

WMS multi-gudang: inbound (PO/ASN, penerimaan, putaway), outbound (alokasi, picking, packing, pengiriman), kontrol stok (cycle count, transfer, koreksi), retur, pelaporan, akses berbasis peran, notifikasi, dan integrasi. Dibangun oleh satu developer dengan budget minim, jadi hosting memakai free tier. Bahasa kerja: Indonesia.

## 2. Stack

- Monorepo pnpm workspaces: `apps/web` (Next.js App Router), `apps/api` (Express.js, TypeScript), `packages/contracts` (skema zod dan tipe yang dipakai bersama).
- Frontend: Next.js, Redux Toolkit dengan RTK Query (state server lewat RTK Query, slice hanya untuk state UI seperti filter dan sesi scan). Operator memakai PWA (scan barcode lewat kamera atau scanner Bluetooth yang bertingkah seperti keyboard).
- Backend: Express.js, Prisma 7 dengan adapter `@prisma/adapter-mariadb`, MySQL 8.0.16 atau lebih baru (agar CHECK constraint ditegakkan), zod, pino, helmet, express-rate-limit, `node-cron`.
- Prisma: pin ke mayor 7 (`prisma@7`, `@prisma/client@7`). Jangan memakai tag `latest`, karena sekarang menunjuk ke 8.0 RC. Prisma 7 berbasis ESM, konfigurasi di `prisma.config.ts`, klien di `src/generated/prisma` (masuk `.gitignore`), dan `datasource` di schema tidak memuat `url`.
- Auth: JWT access token pendek (usulan 15 menit) dan refresh token berotasi di cookie httpOnly. Hash kata sandi argon2id atau bcrypt (diputuskan di T04).
- Job latar belakang: tabel `jobs` dan `node-cron`. Redis/BullMQ hanya bila volume memaksa.
- Belum diputuskan, jangan berasumsi: test runner (Vitest atau Jest), layanan email, vendor object storage, vendor hosting.

## 3. Perintah

Jalankan dari root monorepo. Nama script pengembangan di bawah adalah contoh; periksa `package.json`.

```bash
pnpm install
pnpm --filter api prisma migrate dev --name <nama>   # di MySQL lokal; butuh izin membuat shadow database
pnpm --filter api prisma migrate deploy              # untuk database hosting
pnpm --filter api prisma generate
pnpm --filter api prisma db seed
```

## 4. Struktur folder

```text
apps/api/src/
  app.ts  server.ts
  config/env.ts                 validasi env dengan zod
  lib/prisma.ts                 klien Prisma (adapter MariaDB)
  lib/errors.ts                 AppError(code, status, context), penerjemah problem+json
  middleware/                   request-id, rate-limit, authenticate, require-permission,
                                warehouse-scope, validate, idempotency, audit, error-handler
  modules/<domain>/             routes.ts, controller.ts, service.ts, repository.ts
  modules/inventory/stock-ledger.ts
apps/api/prisma/                schema.prisma, seed.ts, migrations/
apps/web/                       Next.js
packages/contracts/src/         skema zod per modul (request, response, enum)
```

Modul domain: auth, users, warehouses, products, partners, inventory, inbound, putaway, outbound, picking, shipping, stock-control, returns, reports, integration.

## 5. Konvensi kode

- Identifier dalam bahasa Inggris, komentar kode dalam bahasa Indonesia. Asisten membalas pengguna dalam bahasa Indonesia.
- Nama berkas dan folder memakai istilah domain (`stock-ledger`, `warehouse-scope`). Jangan memakai `utils`, `helpers`, `common`, atau `shared`. Package bersama bernama `contracts`.
- Database: tabel dan kolom snake_case jamak (`stock_movements`). Prisma: model PascalCase tunggal dengan `@@map` dan `@map`, field camelCase.
- API: path jamak kebab-case, JSON camelCase, enum huruf kecil snake_case.
- ID dikirim sebagai string (di database `BIGINT UNSIGNED`, di JavaScript `bigint`). Jumlah dan uang dikirim sebagai string desimal (`"12.5000"`, maksimal 4 desimal untuk jumlah dan 2 untuk uang). Jangan memakai `number` untuk jumlah stok.
- Waktu ISO 8601 UTC dengan `Z`. Kolom tanggal saja memakai `YYYY-MM-DD`.
- TypeScript strict. Pakai library yang sudah ada (zod untuk validasi, bukan validasi manual).
- Controller tipis, aturan bisnis di service, query Prisma hanya di repository.
- Standar kolom: `created_at`, `updated_at`; tabel master juga `deleted_at` (soft delete). FK default `ON DELETE RESTRICT`.

## 6. Aturan arsitektur (jangan dilanggar)

1. Modular monolith. Satu API, satu codebase, satu database.
2. Hanya `StockLedger` yang boleh menulis `inventory_balances` dan `stock_movements`, di dalam transaksi Prisma milik pemanggil. Baris `stock_movements` tidak pernah di-UPDATE atau DELETE; koreksi dengan baris baru yang menunjuk `reversal_of_id`.
3. Satu request yang mengubah stok adalah satu transaksi database.
4. Semua jumlah di ledger dan saldo memakai satuan dasar (base UoM). Kolom `qty_base` selalu satuan dasar; kolom `qty_*` di dokumen memakai satuan transaksi.
5. Saldo punya `qty_on_hand`, `qty_allocated`, dan `qty_available` (generated). Unique key saldo memakai `batch_key` (generated, `IFNULL(batch_id, 0)`) karena MySQL menganggap setiap NULL unik.
6. Kunci baris saldo dengan `SELECT ... FOR UPDATE` dalam urutan `id` naik, supaya tidak deadlock.
7. `from_location_id` kosong berarti stok datang dari luar sistem; `to_location_id` kosong berarti stok keluar sistem.
8. Barang dalam perjalanan berada di lokasi bertipe `in_transit` (satu per gudang). Tidak ada kolom `in_transit`.
9. Penerimaan diposting ke ledger saat `receipts/{id}/complete`, bukan tiap scan. Stok di dock tidak ikut alokasi; alokasi hanya dari lokasi `storage` atau `pick_face` berstatus `available`.
10. Perubahan status dokumen lewat route aksi (`POST /x/{id}/aksi`), bukan `PATCH` pada kolom status.
11. Kolom polimorfik (`reference_type` dan `reference_id`, `entity_type` dan `entity_id`) tidak punya FK; integritasnya dijaga aplikasi dan diberi index gabungan.
12. Lokasi yang sedang dihitung (cycle count berjalan) dibekukan: ditolak untuk alokasi, pick, putaway, dan transfer (409 `LOCATION_FROZEN`).

## 7. Konvensi API

- Base `/api/v1`. Respons `{ "data": ... }` atau `{ "data": [...], "meta": {...} }`.
- Error memakai problem+json (RFC 9457) dengan `code` stabil. 422 untuk validasi, 409 untuk konflik keadaan, 404 untuk objek di luar gudang user (bukan 403). Jangan membocorkan stack trace, SQL, atau nama tabel.
- Auth: `Authorization: Bearer <jwt>`. API key (`X-API-Key`) hanya untuk `/integration/*`.
- Otorisasi dua lapis: izin `modul:aksi` per route (`requirePermission`) dan cakupan gudang per objek (`warehouse-scope`). Daftar data bergudang wajib membawa `warehouseId`.
- Route scan dan konfirmasi wajib `Idempotency-Key` (tabel `idempotency_keys`): kunci sama dengan isi sama mengembalikan respons tersimpan; isi berbeda 422 `IDEMPOTENCY_KEY_REUSED`.
- Validasi dengan skema zod `.strict()` dari `packages/contracts`.
- Pagination offset (`page`, `pageSize` maksimal 100); cursor untuk `stock-movements`, `audit-logs`, dan `notifications`.
- Setiap mutasi yang sukses ditulis ke `audit_logs`. Kata sandi, token, dan API key tidak pernah dicatat.
- Nomor dokumen: prefix dan id berpadding (`IB-000301`, `GRN-000501`).
- Peran bawaan: `admin`, `warehouse_manager`, `supervisor`, `operator`, `viewer`.

## 8. Glosarium domain

- SKU: kode unik satu jenis barang. UoM: satuan hitung (PCS, BOX, PALLET). Satuan dasar: satuan terkecil untuk semua pencatatan stok. Konversi di `sku_uom_conversions`.
- Lokasi (bin): petak penyimpanan terkecil, mis. `A-01-1-1` (lorong, rak, level, petak). Zona mengelompokkan lokasi.
- Batch (lot): kelompok produksi dengan `batch_no` dan opsional `expiry_date`. Aturan alokasi per SKU: FIFO, FEFO, atau LIFO.
- PO: pesanan ke supplier. ASN: pemberitahuan kiriman dari supplier. GRN: bukti penerimaan barang.
- Putaway: memindahkan barang dari dock ke rak. Alokasi: mengunci stok untuk satu order. Picking: mengambil barang dari rak. Short pick: barang di rak kurang dari yang diminta. Wave: sekelompok pick list yang dijalankan bersamaan.
- Packing: mengemas hasil picking. Shipment: serah terima ke kurir; saat dikonfirmasi stok keluar dari sistem.
- Cycle count: menghitung sebagian stok secara berkala tanpa menutup gudang (hitung buta). Adjustment: koreksi stok dengan alasan dan, bila perlu, persetujuan bertingkat.
- RMA: izin retur. Disposisi: nasib barang retur (restock, quarantine, scrap, return_to_supplier).
- Ledger: catatan setiap perubahan stok yang tidak boleh diubah. Saldo (`inventory_balances`) adalah ringkasannya.

## 9. Skema database (63 tabel, 7 domain)

Sudah ada di `schema.prisma` (T03, 21 tabel):

- Master data: `warehouses`, `zones`, `locations`, `product_categories`, `uoms`, `skus`, `sku_uom_conversions`, `sku_warehouse_settings`, `batches`, `suppliers`, `customers`, `carriers`, `reason_codes`
- Users dan akses: `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_warehouses`, `refresh_tokens`, `audit_logs`

Dibuat lewat migrasi di fase berikutnya (42 tabel):

- Ledger: `inventory_balances`, `stock_movements`
- Inbound: `inbound_orders`, `inbound_order_lines`, `receipts`, `receipt_lines`, `receiving_discrepancies`, `putaway_tasks`, `putaway_rules`
- Outbound: `outbound_orders`, `outbound_order_lines`, `allocations`, `waves`, `pick_lists`, `pick_tasks`, `packages`, `package_items`, `shipments`
- Stock control: `cycle_count_plans`, `cycle_count_tasks`, `cycle_count_lines`, `stock_adjustments`, `stock_adjustment_lines`, `transfer_orders`, `transfer_order_lines`, `approval_rules`, `approvals`
- Returns: `return_orders`, `return_order_lines`, `return_inspections`, `return_dispositions`
- Notifikasi dan integrasi: `notifications`, `jobs`, `api_keys`, `idempotency_keys`, `webhook_endpoints`, `webhook_deliveries`, `integration_connections`, `import_jobs`, `file_objects`, `attachments`, `report_schedules`

Nilai `movement_type` pada ledger: receipt, putaway, pick, ship, transfer_out, transfer_in, adjustment, count_adjustment, return_receipt, return_disposition, opening_balance, status_change, reversal.

Perbaikan skema yang tertunda (ikut migrasi tabel masing-masing): `stock_adjustment_lines.unit_cost`, `webhook_endpoints.secret_encrypted` (bukan `secret_hash`, karena penandatanganan webhook butuh rahasia asli), `packages.closed_at`.

## 10. Mesin status

| Dokumen             | Alur                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `inbound_orders`    | draft, expected, receiving, received, putaway_done (cancelled dari draft atau expected)       |
| `receipts`          | open, completed (cancelled dari open)                                                         |
| `outbound_orders`   | draft, allocated, picking, picked, packed, shipped (backorder bila tidak ada stok; cancelled) |
| `pick_lists`        | open, in_progress, completed (cancelled)                                                      |
| `shipments`         | ready, shipped (cancelled dari ready)                                                         |
| `cycle_count_plans` | draft, scheduled, in_progress, completed (cancelled)                                          |
| `cycle_count_tasks` | pending, counted atau recount_required, approved                                              |
| `stock_adjustments` | draft, pending_approval, approved, posted (rejected, cancelled)                               |
| `transfer_orders`   | draft, requested, in_transit, received (cancelled)                                            |
| `return_orders`     | requested, authorized, received, inspected, closed (rejected, cancelled)                      |

## 11. Cara bekerja untuk asisten AI (mode mentor)

Pemilik proyek tidak mau vibe coding. Ia bertanya "cara" (misalnya cara CRUD, cara membuat auth di stack ini), mempelajari contohnya, lalu mengimplementasikannya sendiri untuk kasusnya.

- Jangan menulis fitur lengkap atau seluruh modul. Jawab pertanyaan "cara" dengan tiga hal: konsep singkat (apa dan kenapa), langkah-langkahnya, dan contoh template minimal.
- Template memakai entitas generik yang sederhana (misalnya `Uom` atau `Carrier`) dan hanya mencakup satu pola per contoh: satu route, satu service, satu skema zod, atau satu tes. Beri komentar yang menjelaskan alasannya, dan tandai bagian yang harus diganti sesuai kasus pemilik.
- Setelah memberi template, minta pemilik menerapkannya ke modul miliknya sendiri. Jangan langsung menulis versi untuk modul itu kecuali diminta.
- Jika pemilik menempelkan kodenya, tinjau: sebutkan bug, pelanggaran aturan arsitektur (bagian 6), dan cara memperbaikinya. Jangan menulis ulang seluruh berkas.
- Jika pertanyaan terlalu luas, pecah menjadi langkah dan tanyakan langkah mana yang ingin dibahas lebih dulu.
- Untuk keputusan desain, jelaskan pilihan beserta untung ruginya, rekomendasikan satu, dan biarkan pemilik memutuskan.
- Tetap berlaku: jangan mengarang tabel, kolom, atau route yang tidak ada di file ini atau di `schema.prisma`; patuhi aturan arsitektur bagian 6; jangan menaruh rahasia di repo.
- Untuk logika stok (alokasi, ledger, konkurensi, idempotency), jelaskan tes apa yang perlu ada dan beri contoh satu tes. Pemilik yang menulis sisanya.
- Hindari kelebihan rancangan. Belum dimodelkan dan di luar cakupan: serial number, kitting atau bundling, valuasi persediaan, multi-tenant, jadwal dock.
- Saat menjawab: sebutkan asumsi yang dipakai dan hal yang perlu diputuskan pemilik.

## 12. Status proyek (perbarui manual)

- Selesai: dokumen arsitektur, ERD, penjelasan tabel, dan desain API; skema Prisma T03 (belum dijalankan ke MySQL); file ini (T02).
- Berikutnya: T04 (auth: login, refresh token, hash kata sandi).
- Task lain mengikuti daftar di dokumen "WMS: Arsitektur, Fitur, dan Task List" (T01 sampai T53).
