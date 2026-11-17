
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/device-auth";

export const runtime = "nodejs";

const ALLOWED_EVENTS = [
  "distance",
  "inactivity",
  "high_temperature",
  "challenge_timeout",
  "low_light",
];

export async function POST(request: Request) {
  try {
    // 1. Autentikasi perangkat
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

    // 2. Baca request
    const body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request body",
        },
        { status: 400 }
      );
    }

    const {
      event_type,
      description = null,
      started_at,
      ended_at,
      duration_seconds,
      session_id = null,
      metadata = {},
    } = body;

    // 3. Validasi jenis distraksi
    if (!ALLOWED_EVENTS.includes(event_type)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid event_type",
          allowed_events: ALLOWED_EVENTS,
        },
        { status: 400 }
      );
    }

    // 4. Validasi waktu
    if (
      typeof started_at !== "string" ||
      typeof ended_at !== "string" ||
      !Number.isFinite(Date.parse(started_at)) ||
      !Number.isFinite(Date.parse(ended_at))
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid event timestamps",
        },
        { status: 400 }
      );
    }

    if (Date.parse(ended_at) < Date.parse(started_at)) {
      return NextResponse.json(
        {
          success: false,
          message: "ended_at cannot be earlier than started_at",
        },
        { status: 400 }
      );
    }

    // 5. Validasi durasi
    if (
      !Number.isInteger(duration_seconds) ||
      duration_seconds < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid duration_seconds",
        },
        { status: 400 }
      );
    }

    // 6. Validasi deskripsi
    if (
      description !== null &&
      (
        typeof description !== "string" ||
        description.length > 500
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid description",
        },
        { status: 400 }
      );
    }

    // 7. Validasi session_id
    if (
      session_id !== null &&
      (
        typeof session_id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session_id)
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid session_id",
        },
        { status: 400 }
      );
    }

    // 8. Validasi metadata
    if (
      !metadata ||
      typeof metadata !== "object" ||
      Array.isArray(metadata)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid metadata",
        },
        { status: 400 }
      );
    }

    // 9. Pastikan sesi milik perangkat
    if (session_id !== null) {
      const session = await sql`
        SELECT id
        FROM study_sessions
        WHERE id = ${session_id}::uuid
          AND device_id = ${device.id}
        LIMIT 1
      `;

      if (session.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Study session not found",
          },
          { status: 404 }
        );
      }
    }

    // 10. Simpan kejadian distraksi
    const result = await sql`
      INSERT INTO distraction_events (
        device_id,
        session_id,
        event_type,
        description,
        started_at,
        ended_at,
        duration_seconds,
        metadata,
        created_at
      )
      VALUES (
        ${device.id},
        ${session_id}::uuid,
        ${event_type},
        ${description},
        ${started_at}::timestamptz,
        ${ended_at}::timestamptz,
        ${duration_seconds},
        ${JSON.stringify(metadata)}::jsonb,
        NOW()
      )
      RETURNING id, event_type, duration_seconds, created_at
    `;

    // 11. Perbarui status perangkat
    await sql`
      UPDATE devices
      SET
        status = 'online',
        last_seen_at = NOW(),
        updated_at = NOW()
      WHERE id = ${device.id}
    `;

    return NextResponse.json(
      {
        success: true,
        message: "Distraction event recorded successfully",
        data: result[0],
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Distraction API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}

