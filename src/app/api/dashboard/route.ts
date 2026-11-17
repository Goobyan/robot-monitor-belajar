
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Ambil perangkat utama
    const devices = await sql`
      SELECT
        id,
        device_code,
        device_name,
        status,
        firmware_version,
        last_seen_at
      FROM devices
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const device = devices[0];

    // Jika perangkat belum terdaftar
    if (!device) {
      return NextResponse.json({
        success: true,
        message: "No device registered",
        data: {
          device: null,
          statistics: {
            total_sessions: 0,
            total_duration_seconds: 0,
            active_sessions: 0,
            total_distractions: 0,
            today_distractions: 0,
          },
          latest_sensor: null,
          sensor_history: [],
          recent_sessions: [],
          recent_distractions: [],
        },
      });
    }

    const deviceId = device.id;

    // 2. Statistik sesi belajar
    const sessions = await sql`
      SELECT
        COUNT(*)::int AS total_sessions,
        COALESCE(
          SUM(duration_seconds), 0
        )::bigint AS total_duration_seconds,
        COUNT(*) FILTER (
          WHERE status = 'active'
        )::int AS active_sessions
      FROM study_sessions
      WHERE device_id = ${deviceId}
    `;

    // 3. Statistik distraksi
    const distractions = await sql`
      SELECT
        COUNT(*)::int AS total_distractions,
        COUNT(*) FILTER (
          WHERE created_at >= CURRENT_DATE
        )::int AS today_distractions
      FROM distraction_events
      WHERE device_id = ${deviceId}
    `;

    // 4. Sensor terbaru
    const sensors = await sql`
      SELECT
        temperature,
        humidity,
        distance_cm,
        ldr_value,
        vibration,
        sensor_status,
        recorded_at
      FROM sensor_readings
      WHERE device_id = ${deviceId}
      ORDER BY recorded_at DESC
      LIMIT 1
    `;

    // 5. Riwayat sensor 24 jam terakhir
    // Mengambil 100 data terbaru lalu mengurutkannya
    // dari waktu paling lama ke paling baru.
    const sensorHistory = await sql`
      SELECT *
      FROM (
        SELECT
          temperature,
          humidity,
          distance_cm,
          ldr_value,
          recorded_at
        FROM sensor_readings
        WHERE device_id = ${deviceId}
          AND recorded_at >= NOW() - INTERVAL '24 hours'
        ORDER BY recorded_at DESC
        LIMIT 100
      ) AS recent
      ORDER BY recorded_at ASC
    `;

    // 6. Riwayat sesi terbaru
    const recentSessions = await sql`
      SELECT
        id,
        started_at,
        ended_at,
        status,
        duration_seconds
      FROM study_sessions
      WHERE device_id = ${deviceId}
      ORDER BY started_at DESC
      LIMIT 5
    `;

    // 7. Riwayat distraksi terbaru
    const recentDistractions = await sql`
      SELECT
        id,
        event_type,
        description,
        started_at,
        ended_at,
        duration_seconds,
        created_at
      FROM distraction_events
      WHERE device_id = ${deviceId}
      ORDER BY created_at DESC
      LIMIT 5
    `;

    return NextResponse.json({
      success: true,
      message: "Dashboard data retrieved successfully",
      data: {
        device: {
          device_code: device.device_code,
          device_name: device.device_name,
          status: device.status,
          firmware_version: device.firmware_version,
          last_seen_at: device.last_seen_at,
        },

        statistics: {
          ...sessions[0],
          ...distractions[0],
        },

        latest_sensor: sensors[0] ?? null,
        sensor_history: sensorHistory,
        recent_sessions: recentSessions,
        recent_distractions: recentDistractions,
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve dashboard data",
      },
      { status: 500 }
    );
  }
}
