
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/device-auth";

export const runtime = "nodejs";

function validNumber(
  value: unknown,
  min: number,
  max: number
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

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

    // 2. Baca JSON
    const body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, message: "Invalid request body" },
        { status: 400 }
      );
    }

    const {
      temperature = null,
      humidity = null,
      distance_cm = null,
      ldr_value = null,
      vibration = null,
      session_id = null,
      sensor_status = {},
    } = body;

    // 3. Validasi data sensor
    if (
      (temperature !== null &&
        !validNumber(temperature, -40, 80)) ||
      (humidity !== null &&
        !validNumber(humidity, 0, 100)) ||
      (distance_cm !== null &&
        !validNumber(distance_cm, 0, 450)) ||
      (ldr_value !== null &&
        !validNumber(ldr_value, 0, 4095)) ||
      (vibration !== null &&
        typeof vibration !== "boolean")
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid sensor values",
        },
        { status: 400 }
      );
    }

    // 4. Validasi session_id
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

    // 5. Validasi sensor_status
    if (
      !sensor_status ||
      typeof sensor_status !== "object" ||
      Array.isArray(sensor_status)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid sensor_status",
        },
        { status: 400 }
      );
    }

    // 6. Pastikan sesi milik perangkat yang benar
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

    // 7. Simpan pembacaan sensor
    const result = await sql`
      INSERT INTO sensor_readings (
        device_id,
        session_id,
        temperature,
        humidity,
        distance_cm,
        ldr_value,
        vibration,
        sensor_status,
        recorded_at
      )
      VALUES (
        ${device.id},
        ${session_id}::uuid,
        ${temperature},
        ${humidity},
        ${distance_cm},
        ${ldr_value},
        ${vibration},
        ${JSON.stringify(sensor_status)}::jsonb,
        NOW()
      )
      RETURNING id, recorded_at
    `;

    // 8. Perbarui status perangkat
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
        message: "Telemetry received successfully",
        data: {
          reading_id: result[0].id,
          recorded_at: result[0].recorded_at,
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Telemetry API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}

