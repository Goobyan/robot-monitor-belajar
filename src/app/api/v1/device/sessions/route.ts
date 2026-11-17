
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/device-auth";

export const runtime = "nodejs";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    // 1. Autentikasi perangkat
    const device = await authenticateDevice(request);

    if (!device) {
      return NextResponse.json(
        { success: false, message: "Unauthorized device" },
        { status: 401 }
      );
    }

    // 2. Baca request
    const body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, message: "Invalid request body" },
        { status: 400 }
      );
    }

    const { action, schedule_id = null, session_id = null } = body;

    // 3. Mulai sesi belajar
    if (action === "start") {
      if (
        schedule_id !== null &&
        (
          typeof schedule_id !== "string" ||
          !UUID_REGEX.test(schedule_id)
        )
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid schedule_id" },
          { status: 400 }
        );
      }

      // Pastikan jadwal milik perangkat
      if (schedule_id !== null) {
        const schedules = await sql`
          SELECT id
          FROM study_schedules
          WHERE id = ${schedule_id}::uuid
            AND device_id = ${device.id}
            AND start_at <= NOW()
            AND end_at > NOW()
            AND LOWER(status) NOT IN (
              'cancelled',
              'canceled',
              'completed'
            )
          LIMIT 1
        `;

        if (schedules.length === 0) {
          return NextResponse.json(
            {
              success: false,
              message: "Schedule is unavailable or not active",
            },
            { status: 404 }
          );
        }
      }

      // Cegah sesi aktif ganda
      const activeSessions = await sql`
        SELECT id
        FROM study_sessions
        WHERE device_id = ${device.id}
          AND status = 'active'
        LIMIT 1
      `;

      if (activeSessions.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: "An active study session already exists",
            session_id: activeSessions[0].id,
          },
          { status: 409 }
        );
      }

      const result = await sql`
        INSERT INTO study_sessions (
          id,
          device_id,
          schedule_id,
          started_at,
          status,
          created_at
        )
        VALUES (
          gen_random_uuid(),
          ${device.id},
          ${schedule_id}::uuid,
          NOW(),
          'active',
          NOW()
        )
        RETURNING id, schedule_id, started_at, status
      `;

      return NextResponse.json(
        {
          success: true,
          message: "Study session started successfully",
          session: result[0],
        },
        { status: 201 }
      );
    }

    // 4. Selesaikan sesi belajar
    if (action === "finish") {
      if (
        typeof session_id !== "string" ||
        !UUID_REGEX.test(session_id)
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid session_id" },
          { status: 400 }
        );
      }

      const result = await sql`
        UPDATE study_sessions
        SET
          ended_at = NOW(),
          status = 'completed',
          duration_seconds = GREATEST(
            0,
            FLOOR(EXTRACT(EPOCH FROM (NOW() - started_at)))::integer
          )
        WHERE id = ${session_id}::uuid
          AND device_id = ${device.id}
          AND status = 'active'
        RETURNING
          id,
          started_at,
          ended_at,
          status,
          duration_seconds
      `;

      if (result.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Active study session not found",
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Study session completed successfully",
        session: result[0],
      });
    }

    // 5. Tindakan tidak dikenal
    return NextResponse.json(
      {
        success: false,
        message: "Invalid action. Use start or finish",
      },
      { status: 400 }
    );

  } catch (error) {
    console.error("Study session API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}

