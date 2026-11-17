
'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Activity,
  AlertTriangle,
  BookOpen,
  CalendarDays,
  Cpu,
  LayoutDashboard,
  Settings,
  Radio,
  Clock3,
  Plus,
  Trash2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

type Tab =
  | 'Dashboard'
  | 'Jadwal Belajar'
  | 'Riwayat & Analitik'
  | 'Simulator ESP32'
  | 'Integrasi API'
  | 'Pengaturan';

type Schedule = {
  id: number;
  title: string;
  day: string;
  time: string;
  duration: number;
  target: string;
};

type SensorReading = {
  temperature: number | string | null;
  humidity: number | string | null;
  distance_cm: number | string | null;
  ldr_value: number | null;
  vibration: boolean | null;
  sensor_status: Record<string, string> | null;
  recorded_at: string;
};

type SensorHistoryReading = {
  temperature: number | string | null;
  humidity: number | string | null;
  distance_cm: number | string | null;
  ldr_value: number | null;
  recorded_at: string;
};

type DashboardData = {
  device: {
    device_code: string;
    device_name: string;
    status: string;
    firmware_version: string | null;
    last_seen_at: string | null;
  } | null;

  statistics: {
    total_sessions: number;
    total_duration_seconds: number | string;
    active_sessions: number;
    total_distractions: number;
    today_distractions: number;
  };

  latest_sensor: SensorReading | null;
sensor_history: SensorHistoryReading[];

  recent_sessions: {
    id: string;
    started_at: string;
    ended_at: string | null;
    status: string;
    duration_seconds: number | null;
  }[];

  recent_distractions: {
    id: string;
    event_type: string;
    description: string;
    created_at: string;
  }[];
};

const menu: Tab[] = [
  'Dashboard',
  'Jadwal Belajar',
  'Riwayat & Analitik',
  'Simulator ESP32',
  'Integrasi API',
  'Pengaturan',
];

const icons = [
  LayoutDashboard,
  CalendarDays,
  Activity,
  Cpu,
  Radio,
  Settings,
];

const seed: Schedule[] = [
  {
    id: 1,
    title: 'Matematika — Integral',
    day: 'Senin',
    time: '16:00',
    duration: 60,
    target: 'Menyelesaikan 15 soal',
  },
  {
    id: 2,
    title: 'Proyek Coding ESP32',
    day: 'Rabu',
    time: '19:00',
    duration: 90,
    target: 'Uji integrasi perangkat',
  },
  {
    id: 3,
    title: 'Fisika — Elektromagnetik',
    day: 'Jumat',
    time: '15:30',
    duration: 45,
    target: 'Membuat rangkuman',
  },
];

function formatDateTime(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatDuration(value: number | string | null | undefined) {
  const seconds = Number(value ?? 0);

  if (!Number.isFinite(seconds)) return '—';

  if (seconds < 60) {
    return `${Math.round(seconds)} dtk`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours} jam ${minutes} mnt`;
  }

  if (remainingSeconds > 0) {
    return `${minutes} mnt ${remainingSeconds} dtk`;
  }

  return `${minutes} mnt`;
}

function formatNumber(
  value: number | string | null | undefined,
  decimals = 0
) {
  if (value === null || value === undefined) return '—';

  const number = Number(value);

  if (!Number.isFinite(number)) return '—';

  return number.toFixed(decimals);
}

function toChartValue(
  value: number | string | null | undefined
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function getSensorStatus(
  sensor: SensorReading | null,
  key: string
) {
  if (!sensor) return 'Menunggu data';

  const status = sensor.sensor_status?.[key];

  return status
    ? status.toUpperCase()
    : 'Status tidak tersedia';
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('Dashboard');

  const [schedules, setSchedules] = useState(seed);
  const [show, setShow] = useState(false);

  const [title, setTitle] = useState('');
  const [day, setDay] = useState('Senin');
  const [time, setTime] = useState('19:00');
  const [duration, setDuration] = useState(60);
  const [target, setTarget] = useState('');

  const [sensor, setSensor] = useState({
    distance: 32,
    temp: 27.5,
    ldr: 2840,
    vibration: true,
    button: false,
    error: false,
  });

  const [message, setMessage] = useState('');

  // Dashboard API state
  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);

  const [dashboardLoading, setDashboardLoading] =
    useState(true);

  const [dashboardError, setDashboardError] =
    useState('');

  const [lastUpdated, setLastUpdated] =
    useState<string | null>(null);

  // Mengambil data dashboard dari backend
  const refreshDashboard = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard', {
        cache: 'no-store',
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(
          result.message || `HTTP ${response.status}`
        );
      }

      setDashboard(result.data as DashboardData);
      setDashboardError('');
      setLastUpdated(new Date().toISOString());
    } catch (error) {
      console.error('Dashboard fetch error:', error);

      setDashboardError(
        error instanceof Error
          ? error.message
          : 'Gagal mengambil data dashboard'
      );
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  // Refresh otomatis setiap 5 detik
  useEffect(() => {
    void refreshDashboard();

    const interval = window.setInterval(() => {
      void refreshDashboard();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [refreshDashboard]);

  const flags = useMemo(
    () => ({
      J: sensor.distance < 10 || sensor.distance > 50,
      G: !sensor.vibration,
      S: sensor.temp >= 39,
      B: sensor.button,
      L: sensor.ldr < 1500,
    }),
    [sensor]
  );

  // Data aktual dari API
  const apiSensor = dashboard?.latest_sensor ?? null;
  const statistics = dashboard?.statistics;

// Mengubah data sensor API menjadi format grafik
const chartData = useMemo(() => {
  return (dashboard?.sensor_history ?? []).map((item) => ({
    time: new Date(item.recorded_at).toLocaleString(
      'id-ID',
      {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }
    ),

    temperature: toChartValue(item.temperature),
    humidity: toChartValue(item.humidity),
    distance: toChartValue(item.distance_cm),
    ldr: toChartValue(item.ldr_value),
  }));
}, [dashboard?.sensor_history]);

  // Perangkat dianggap online jika heartbeat diterima
  // dalam 120 detik terakhir.
  const lastSeen = dashboard?.device?.last_seen_at;
  const lastSeenTimestamp = lastSeen
    ? new Date(lastSeen).getTime()
    : NaN;

  const isDeviceOnline =
    Number.isFinite(lastSeenTimestamp) &&
    Date.now() - lastSeenTimestamp <= 120000;

  const activeSession = dashboard?.recent_sessions?.find(
    (session) => session.status === 'active'
  );

  const sensorRows = [
    {
      label: 'HC-SR04 · Jarak',
      value: apiSensor
        ? `${formatNumber(apiSensor.distance_cm, 1)} cm`
        : '—',
      status: getSensorStatus(apiSensor, 'hc_sr04'),
    },
    {
      label: 'DHT22 · Suhu',
      value: apiSensor
        ? `${formatNumber(apiSensor.temperature, 1)} °C`
        : '—',
      status: getSensorStatus(apiSensor, 'dht22'),
    },
    {
      label: 'DHT22 · Kelembapan',
      value: apiSensor
        ? `${formatNumber(apiSensor.humidity, 1)} %`
        : '—',
      status: getSensorStatus(apiSensor, 'dht22'),
    },
    {
      label: 'LDR · Cahaya',
      value: apiSensor
        ? `${formatNumber(apiSensor.ldr_value)} ADC`
        : '—',
      status: getSensorStatus(apiSensor, 'ldr'),
    },
    {
      label: 'SW-420 · Getaran',
      value: apiSensor
        ? apiSensor.vibration === null
          ? '—'
          : apiSensor.vibration
            ? 'Terdeteksi'
            : 'Tidak terdeteksi'
        : '—',
      status: getSensorStatus(apiSensor, 'sw420'),
    },
    {
      label: 'Push button · Tantangan',
      value: '—',
      status: 'Belum tersedia di telemetri',
    },
  ];

  const add = () => {
    if (!title.trim() || !target.trim()) {
      setMessage('Nama aktivitas dan target wajib diisi.');
      return;
    }

    setSchedules([
      ...schedules,
      {
        id: Date.now(),
        title,
        day,
        time,
        duration,
        target,
      },
    ]);

    setTitle('');
    setTarget('');
    setShow(false);

    setMessage(
      'Jadwal ditambahkan pada tampilan lokal; belum tersimpan ke server.'
    );
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <Cpu />
          <div>
            <b>ROBOT MONITOR</b>
            <small>BELAJAR / IoT SYSTEM</small>
          </div>
        </div>

        <p className="muted tiny">WORKSPACE</p>

        {menu.map((m, i) => {
          const I = icons[i];

          return (
            <button
              key={m}
              className={tab === m ? 'nav active' : 'nav'}
              onClick={() => setTab(m)}
            >
              <I size={17} />
              {m}

              {m === 'Jadwal Belajar' && (
                <span>{schedules.length}</span>
              )}
            </button>
          );
        })}

        <div className={`sidefoot ${isDeviceOnline ? 'online' : ''}`}>
          <i />
          ESP32 {isDeviceOnline ? 'ONLINE' : 'OFFLINE'}

          <small>
            {lastSeen
              ? `Heartbeat: ${formatDateTime(lastSeen)}`
              : 'Menunggu koneksi perangkat'}
          </small>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <small>WORKSPACE / {tab.toUpperCase()}</small>
            <h1>{tab}</h1>
          </div>

          <div className={`offline ${isDeviceOnline ? 'online' : ''}`}>
            <i />
            PERANGKAT {isDeviceOnline ? 'ONLINE' : 'OFFLINE'}
          </div>
        </header>

        <section className="content">
          <div
            className={`warning ${dashboardError ? '' : 'connected'}`}
          >
            {dashboardError ? (
              <AlertTriangle size={18} />
            ) : (
              <Activity size={18} />
            )}

            <div>
              <b>
                {dashboardError
                  ? 'Koneksi API dashboard bermasalah'
                  : 'Dashboard terhubung ke backend'}
              </b>

              <small>
                {dashboardError ||
                  (dashboardLoading && !dashboard
                    ? 'Sedang mengambil data dari server...'
                    : `Data diperbarui otomatis setiap 5 detik. Terakhir diperbarui: ${formatDateTime(lastUpdated)}`)}
              </small>
            </div>
          </div>

          {message && (
            <div className="notice">
              {message}
              <button onClick={() => setMessage('')}>×</button>
            </div>
          )}

          {tab === 'Dashboard' && (
            <>
              <div className="intro">
                <div>
                  <label>MONITORING CENTER / OVERVIEW</label>
                  <h2>Ringkasan aktivitas belajar</h2>
                  <p>
                    Pantau kondisi perangkat, sesi belajar,
                    dan indikator konsentrasi.
                  </p>
                </div>

                <button onClick={() => void refreshDashboard()}>
                  <RefreshCw size={15} />
                  Sinkronisasi
                </button>
              </div>

              <div className="metrics">
                <article className="panel metric">
                  <small>Status perangkat</small>
                  <b>
                    {dashboard
                      ? isDeviceOnline
                        ? 'Online'
                        : 'Offline'
                      : '—'}
                  </b>
                  <span>
                    {lastSeen
                      ? `Heartbeat: ${formatDateTime(lastSeen)}`
                      : 'Belum ada heartbeat'}
                  </span>
                </article>

                <article className="panel metric">
                  <small>Total sesi</small>
                  <b>
                    {statistics
                      ? statistics.total_sessions
                      : '—'}
                  </b>
                  <span>
                    {statistics
                      ? `${statistics.active_sessions} sesi aktif`
                      : 'Menunggu data backend'}
                  </span>
                </article>

                <article className="panel metric">
                  <small>Durasi fokus</small>
                  <b>
                    {statistics
                      ? formatDuration(
                          statistics.total_duration_seconds
                        )
                      : '—'}
                  </b>
                  <span>Total durasi seluruh sesi</span>
                </article>

                <article className="panel metric">
                  <small>Gangguan</small>
                  <b>
                    {statistics
                      ? statistics.total_distractions
                      : '—'}
                  </b>
                  <span>
                    {statistics
                      ? `${statistics.today_distractions} hari ini`
                      : 'Menunggu data backend'}
                  </span>
                </article>
              </div>

              <article className="panel">
                <h3>Logika deteksi konsentrasi</h3>

                <div className="formula">
                  D = J ∨ G ∨ S ∨ B ∨ L
                  <small>
                    Sensor error dipisahkan dari gangguan konsentrasi
                  </small>
                </div>

                <div className="flags">
                  {[
                    ['J', 'Jarak', '10–50 cm'],
                    ['G', 'Getaran', 'Aktivitas terdeteksi'],
                    ['S', 'Suhu', 'Di bawah 39°C'],
                    ['B', 'Tantangan tombol', 'Respons tepat waktu'],
                    ['L', 'Cahaya', 'Tidak gelap'],
                  ].map((x) => (
                    <div className="flag" key={x[0]}>
                      <b>{x[0]}</b>
                      <span>
                        <strong>{x[1]}</strong>
                        <small>{x[2]}</small>
                      </span>
                      <em>Belum dievaluasi</em>
                    </div>
                  ))}
                </div>
              </article>

              <div className="columns">
                <article className="panel">
                  <h3>Status sensor</h3>

{/* SENSOR HISTORY CHARTS */}
<div className="chart-grid">

  {/* Grafik suhu dan kelembapan */}
  <article className="panel chart-panel chart-wide">
    <h3>Grafik Suhu & Kelembapan</h3>

    <p className="chart-description">
      Perubahan temperatur dan kelembapan berdasarkan
      pembacaan DHT22.
    </p>

    {chartData.length > 0 ? (
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 10,
              right: 12,
              left: 0,
              bottom: 5,
            }}
          >
            <CartesianGrid
              stroke="#29394f"
              strokeDasharray="3 3"
            />

            <XAxis
              dataKey="time"
              tick={{ fill: '#8294ab', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#29394f' }}
              minTickGap={30}
            />

            <YAxis
              yAxisId="temp"
              tick={{ fill: '#fb923c', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={42}
            />

            <YAxis
              yAxisId="humidity"
              orientation="right"
              domain={[0, 100]}
              tick={{ fill: '#38bdf8', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={42}
            />

            <Tooltip
              contentStyle={{
                background: '#0b1627',
                border: '1px solid #2b3d55',
                borderRadius: 8,
                color: '#e8eff8',
                fontSize: 11,
              }}
            />

            <Legend
              wrapperStyle={{ fontSize: 11 }}
            />

            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temperature"
              name="Suhu"
              stroke="#fb923c"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
              unit=" °C"
            />

            <Line
              yAxisId="humidity"
              type="monotone"
              dataKey="humidity"
              name="Kelembapan"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
              unit=" %"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <div className="chart-empty">
        Belum ada riwayat pembacaan DHT22.
      </div>
    )}
  </article>

  {/* Grafik jarak */}
  <article className="panel chart-panel">
    <h3>Grafik Jarak HC-SR04</h3>

    <p className="chart-description">
      Perubahan jarak objek di depan sensor.
    </p>

    {chartData.length > 0 ? (
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid
              stroke="#29394f"
              strokeDasharray="3 3"
            />

            <XAxis
              dataKey="time"
              tick={{ fill: '#8294ab', fontSize: 9 }}
              tickLine={false}
              axisLine={{ stroke: '#29394f' }}
              minTickGap={25}
            />

            <YAxis
              tick={{ fill: '#8294ab', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={38}
            />

            <Tooltip
              contentStyle={{
                background: '#0b1627',
                border: '1px solid #2b3d55',
                borderRadius: 8,
                color: '#e8eff8',
                fontSize: 11,
              }}
            />

            <Line
              type="monotone"
              dataKey="distance"
              name="Jarak"
              stroke="#34d399"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
              unit=" cm"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <div className="chart-empty">
        Belum ada riwayat HC-SR04.
      </div>
    )}
  </article>

  {/* Grafik LDR */}
  <article className="panel chart-panel">
    <h3>Grafik Intensitas Cahaya</h3>

    <p className="chart-description">
      Perubahan nilai ADC dari sensor LDR.
    </p>

    {chartData.length > 0 ? (
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid
              stroke="#29394f"
              strokeDasharray="3 3"
            />

            <XAxis
              dataKey="time"
              tick={{ fill: '#8294ab', fontSize: 9 }}
              tickLine={false}
              axisLine={{ stroke: '#29394f' }}
              minTickGap={25}
            />

            <YAxis
              domain={[0, 4095]}
              tick={{ fill: '#8294ab', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={42}
            />

            <Tooltip
              contentStyle={{
                background: '#0b1627',
                border: '1px solid #2b3d55',
                borderRadius: 8,
                color: '#e8eff8',
                fontSize: 11,
              }}
            />

            <Line
              type="monotone"
              dataKey="ldr"
              name="Cahaya"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
              unit=" ADC"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <div className="chart-empty">
        Belum ada riwayat sensor LDR.
      </div>
    )}
  </article>

</div>
                  {sensorRows.map((row) => (
                    <div className="sensor" key={row.label}>
                      <span>{row.label}</span>
                      <b>{row.value}</b>
                      <small>{row.status}</small>
                    </div>
                  ))}

                  {apiSensor && (
                    <p className="muted tiny">
                      Data sensor terakhir:
                      {' '}
                      {formatDateTime(apiSensor.recorded_at)}
                    </p>
                  )}
                </article>

                <article className="panel">
                  <h3>Perangkat & sesi aktif</h3>

                  <div className="device">
                    <Cpu size={44} />

                    <div>
                      <b>
                        {dashboard?.device?.device_name ||
                          'Perangkat belum terdaftar'}
                      </b>

                      <p>
                        {dashboard?.device?.device_code || '—'}
                        {' · '}
                        {isDeviceOnline ? 'Online' : 'Offline'}
                      </p>

                      <small>
                        Firmware:{' '}
                        {dashboard?.device?.firmware_version || '—'}
                      </small>

                      <small>
                        Heartbeat terakhir: {formatDateTime(lastSeen)}
                      </small>
                    </div>
                  </div>

                  <div className="empty">
                    {activeSession ? (
                      <>
                        <Activity />
                        <b>Sesi belajar sedang berjalan</b>
                        <small>
                          Dimulai: {formatDateTime(activeSession.started_at)}
                        </small>
                      </>
                    ) : (
                      <>
                        <BookOpen />
                        <b>Tidak ada sesi berjalan</b>
                        <small>
                          Sesi aktif muncul setelah perangkat
                          memulai sesi belajar.
                        </small>
                      </>
                    )}
                  </div>
                </article>
              </div>
            </>
          )}

          {tab === 'Jadwal Belajar' && (
            <>
              <div className="intro">
                <div>
                  <label>PLANNING / SCHEDULE MANAGEMENT</label>
                  <h2>Manajemen jadwal</h2>
                  <p>
                    Atur jadwal mingguan dan sesi belajar.
                  </p>
                </div>

                <button
                  className="primary"
                  onClick={() => setShow(!show)}
                >
                  <Plus size={15} />
                  Tambah jadwal
                </button>
              </div>

              {show && (
                <article className="panel">
                  <h3>Jadwal baru</h3>

                  <div className="form">
                    <label>
                      Nama aktivitas
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Nama mata pelajaran / aktivitas"
                      />
                    </label>

                    <label>
                      Hari
                      <select
                        value={day}
                        onChange={(e) => setDay(e.target.value)}
                      >
                        {[
                          'Senin',
                          'Selasa',
                          'Rabu',
                          'Kamis',
                          'Jumat',
                          'Sabtu',
                          'Minggu',
                        ].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Jam mulai
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                      />
                    </label>

                    <label>
                      Durasi (menit)
                      <input
                        type="number"
                        min="10"
                        max="240"
                        value={duration}
                        onChange={(e) =>
                          setDuration(+e.target.value)
                        }
                      />
                    </label>

                    <label className="wide">
                      Target belajar
                      <input
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        placeholder="Target yang ingin dicapai"
                      />
                    </label>
                  </div>

                  <button className="primary" onClick={add}>
                    Simpan jadwal
                  </button>
                </article>
              )}

              <article className="panel">
                <h3>Daftar jadwal · {schedules.length}</h3>

                <div className="table">
                  <div className="tr th">
                    <span>Aktivitas</span>
                    <span>Hari</span>
                    <span>Waktu</span>
                    <span>Durasi</span>
                    <span>Aksi</span>
                  </div>

                  {schedules.map((s) => (
                    <div className="tr" key={s.id}>
                      <span>
                        <b>{s.title}</b>
                        <small>{s.target}</small>
                      </span>

                      <span>{s.day}</span>
                      <span>{s.time} WIB</span>
                      <span>{s.duration} menit</span>

                      <span>
                        <button
                          className="delete"
                          onClick={() =>
                            setSchedules(
                              schedules.filter((x) => x.id !== s.id)
                            )
                          }
                        >
                          <Trash2 size={14} />
                          Hapus
                        </button>
                      </span>
                    </div>
                  ))}
                </div>

                <p className="muted tiny">
                  Jadwal masih tersimpan dalam state browser.
                  Penyimpanan permanen akan dibuat pada tahap
                  Schedule API.
                </p>
              </article>
            </>
          )}

          {tab === 'Simulator ESP32' && (
            <>
              <div className="intro">
                <div>
                  <label>DEVELOPMENT / HARDWARE TEST</label>
                  <h2>Simulator sensor</h2>
                  <p>
                    Uji logika tanpa mengirim data palsu
                    sebagai telemetri nyata.
                  </p>
                </div>
              </div>

              <article className="panel">
                <h3>Kontrol sensor simulasi</h3>

                <div className="simgrid">
                  <label>
                    Jarak HC-SR04
                    <b>{sensor.distance} cm</b>
                    <input
                      type="range"
                      min="2"
                      max="100"
                      value={sensor.distance}
                      onChange={(e) =>
                        setSensor({
                          ...sensor,
                          distance: +e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Suhu DHT22
                    <b>{sensor.temp} °C</b>
                    <input
                      type="range"
                      min="18"
                      max="45"
                      step=".5"
                      value={sensor.temp}
                      onChange={(e) =>
                        setSensor({
                          ...sensor,
                          temp: +e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    LDR
                    <b>{sensor.ldr} ADC</b>
                    <input
                      type="range"
                      min="100"
                      max="4095"
                      value={sensor.ldr}
                      onChange={(e) =>
                        setSensor({
                          ...sensor,
                          ldr: +e.target.value,
                        })
                      }
                    />
                  </label>

                  {[
                    ['vibration', 'SW-420 mendeteksi aktivitas'],
                    ['button', 'Tantangan tombol timeout'],
                    ['error', 'Simulasikan sensor error'],
                  ].map((x) => (
                    <label className="check" key={x[0]}>
                      {x[1]}
                      <input
                        type="checkbox"
                        checked={(sensor as any)[x[0]]}
                        onChange={(e) =>
                          setSensor({
                            ...sensor,
                            [x[0]]: e.target.checked,
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </article>

              <article className="panel">
                <h3>
                  Hasil evaluasi · D = J OR G OR S OR B OR L
                </h3>

                <div className="flags">
                  {Object.entries(flags).map(([k, v]) => (
                    <div className="flag" key={k}>
                      <b>{k}</b>
                      <span>
                        <strong>
                          {
                            ({
                              J: 'Jarak',
                              G: 'Getaran',
                              S: 'Suhu',
                              B: 'Tombol',
                              L: 'Cahaya',
                            } as any)[k]
                          }
                        </strong>
                        <small>
                          {v ? 'Pemicu aktif' : 'Normal'}
                        </small>
                      </span>
                      <em>
                        {sensor.error
                          ? 'Sensor error'
                          : v
                            ? 'Aktif'
                            : 'Normal'}
                      </em>
                    </div>
                  ))}
                </div>

                <div className="result">
                  {sensor.error
                    ? 'SENSOR ERROR — bukan gangguan konsentrasi'
                    : Object.values(flags).some(Boolean)
                      ? 'D = 1 · INDIKASI GANGGUAN'
                      : 'D = 0 · KONDISI NORMAL'}
                </div>

                <button
                  onClick={() =>
                    setSensor({
                      distance: 32,
                      temp: 27.5,
                      ldr: 2840,
                      vibration: true,
                      button: false,
                      error: false,
                    })
                  }
                >
                  Reset simulasi
                </button>
              </article>
            </>
          )}

          {tab === 'Riwayat & Analitik' && (
            <>
              <div className="intro">
                <div>
                  <label>REPORTS / PERFORMANCE</label>
                  <h2>Riwayat dan analitik</h2>
                  <p>
                    Durasi fokus, gangguan, dan penyelesaian jadwal.
                  </p>
                </div>
              </div>

              <article className="panel">
                <h3>Riwayat sesi</h3>

                {dashboard?.recent_sessions?.length ? (
                  <div className="table">
                    <div className="tr th">
                      <span>Mulai</span>
                      <span>Selesai</span>
                      <span>Status</span>
                      <span>Durasi</span>
                      <span></span>
                    </div>

                    {dashboard.recent_sessions.map((session) => (
                      <div className="tr" key={session.id}>
                        <span>
                          {formatDateTime(session.started_at)}
                        </span>
                        <span>
                          {formatDateTime(session.ended_at)}
                        </span>
                        <span>{session.status}</span>
                        <span>
                          {formatDuration(session.duration_seconds)}
                        </span>
                        <span></span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty">
                    <Clock3 />
                    <b>Belum ada riwayat tersimpan</b>
                    <small>
                      Data akan muncul setelah sesi belajar tercatat.
                    </small>
                  </div>
                )}
              </article>

              <article className="panel">
                <h3>Riwayat distraksi</h3>

                {dashboard?.recent_distractions?.length ? (
                  dashboard.recent_distractions.map((item) => (
                    <div className="sensor" key={item.id}>
                      <span>
                        <b>{item.event_type}</b>
                        <small>{item.description}</small>
                      </span>
                      <small>{formatDateTime(item.created_at)}</small>
                    </div>
                  ))
                ) : (
                  <div className="empty">
                    <Activity />
                    <b>Belum ada data distraksi</b>
                  </div>
                )}
              </article>
            </>
          )}

          {tab === 'Integrasi API' && (
            <>
              <div className="intro">
                <div>
                  <label>DEVICE CONNECTIVITY / API</label>
                  <h2>Integrasi ESP32</h2>
                  <p>
                    Komunikasi perangkat, backend Vercel,
                    dan database.
                  </p>
                </div>
              </div>

              <article className="panel">
                <h3>Arsitektur komunikasi</h3>

                <div className="architecture">
                  <b>ESP32</b> ↔ <b>Next.js API / Vercel</b> ↔ <b>PostgreSQL</b>
                </div>

                {[
                  ['POST', '/api/v1/device/telemetry', 'Kirim data sensor'],
                  ['GET', '/api/v1/device/schedule', 'Ambil jadwal belajar'],
                  ['GET', '/api/v1/device/commands', 'Ambil perintah tertunda'],
                  ['POST', '/api/v1/device/commands/ack', 'Kirim acknowledgment'],
                  ['POST', '/api/v1/device/heartbeat', 'Perbarui status perangkat'],
                  ['POST', '/api/v1/device/distractions', 'Kirim kejadian distraksi'],
                  ['POST', '/api/v1/device/sessions', 'Mulai atau selesaikan sesi'],
                  ['GET', '/api/dashboard', 'Ambil data dashboard'],
                ].map((x) => (
                  <div className="endpoint" key={x[1]}>
                    <b>{x[0]}</b>
                    <code>{x[1]}</code>
                    <small>{x[2]}</small>
                  </div>
                ))}
              </article>

              <article className="panel">
                <h3>Keamanan</h3>
                <p>
                  Token perangkat diverifikasi server, HTTPS wajib,
                  kredensial database tidak boleh ditanam di JavaScript,
                  dan payload divalidasi di backend.
                </p>
                <ShieldCheck />
              </article>
            </>
          )}

          {tab === 'Pengaturan' && (
            <>
              <div className="intro">
                <div>
                  <label>CONFIGURATION / SECURITY</label>
                  <h2>Pengaturan sistem</h2>
                  <p>
                    Ambang batas sensor dan keamanan perangkat.
                  </p>
                </div>
              </div>

              <article className="panel">
                <h3>Nilai awal ambang sensor</h3>

                <div className="settings">
                  {[
                    ['Jarak minimum', '10 cm'],
                    ['Jarak maksimum', '50 cm'],
                    ['Batas suhu', '39 °C'],
                    ['Ambang LDR', '1500 ADC'],
                    ['Batas diam SW-420', '120 detik'],
                    ['Timeout tombol', '15 detik'],
                  ].map((x) => (
                    <div key={x[0]}>
                      {x[0]}
                      <b>{x[1]}</b>
                    </div>
                  ))}
                </div>

                <p className="muted tiny">
                  Penyimpanan konfigurasi dan sinkronisasi
                  ke perangkat dibuat pada tahap backend.
                </p>
              </article>
            </>
          )}
        </section>

        <footer>
          ROBOT MONITOR BELAJAR
          <span>
            DASHBOARD API · AUTO REFRESH 5 DETIK
          </span>
        </footer>
      </main>
    </div>
  );
}

