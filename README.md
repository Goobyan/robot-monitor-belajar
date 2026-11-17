# Robot Monitor Belajar — Frontend Preview

## Menjalankan lokal
1. Instal Node.js LTS.
2. Ekstrak ZIP ini.
3. Jalankan `npm install`.
4. Jalankan `npm run dev`.
5. Buka http://localhost:3000.

## Deploy preview ke Vercel
Push ke GitHub, import repository di Vercel, lalu deploy sebagai aplikasi Next.js.

## Status tahap ini
- Dashboard, jadwal lokal, simulator sensor, halaman riwayat, rancangan API, dan pengaturan sudah tersedia.
- Belum ada database, autentikasi, API aktif, atau koneksi ESP32.
- Jadwal hanya berada di state browser dan akan hilang saat reload.
- Data simulasi dipisahkan dari data sensor nyata.

## Tahap berikutnya
Bangun backend Next.js Route Handlers + PostgreSQL (Neon), autentikasi admin/perangkat, telemetry, heartbeat, sinkronisasi jadwal, command queue, dan ACK. Finalisasi payload harus dicocokkan dengan firmware ESP32 aktual.
