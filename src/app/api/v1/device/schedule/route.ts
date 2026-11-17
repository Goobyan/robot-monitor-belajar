
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/device-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    // 1. Verifikasi perangkat
    const device = await authenticateDevice(request);

    if (!device) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized device",
        },
        { status: 401 }
      );
    }

    // 2. Ambil jadwal aktif atau jadwal berikutnya
    const result = await sql`
      SELECT
        id,
        title,
        description,
        start_at,
        end_at,
        status
      FROM study_schedules
      WHERE
        device_id = ${device.id}
        AND end_at > NOW()
        AND LOWER(status) NOT IN (
          'cancelled',
          'canceled',
          'completed'
        )
      ORDER BY
        CASE
          WHEN start_at <= NOW() THEN 0
          ELSE 1
        END ASC,
        start_at ASC
      LIMIT 1
    `;

    // 3. Jika tidak ada jadwal
    if (result.length === 0) {
      return NextResponse.json({
        success: true,
        has_schedule: false,
        message: "No upcoming study schedule",
        schedule: null,
      });
    }

    // 4. Kirim jadwal ke ESP32
    const schedule = result[0];

    return NextResponse.json({
      success: true,
      has_schedule: true,
      message: "Schedule retrieved successfully",
      schedule: {
        id: schedule.id,
        title: schedule.title,
        description: schedule.description,
        start_at: schedule.start_at,
        end_at: schedule.end_at,
        status: schedule.status,
      },
      server_time: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Schedule API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}

