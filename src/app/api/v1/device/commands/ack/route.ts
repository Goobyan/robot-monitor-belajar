
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/device-auth";

export const runtime = "nodejs";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const device = await authenticateDevice(request);

    if (!device) {
      return NextResponse.json(
        { success: false, message: "Unauthorized device" },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, message: "Invalid request body" },
        { status: 400 }
      );
    }

    const { command_id, status } = body;

    if (
      typeof command_id !== "string" ||
      !UUID_REGEX.test(command_id)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid command_id" },
        { status: 400 }
      );
    }

    // ESP32 hanya boleh mengirim hasil akhir eksekusi.
    if (!["completed", "failed"].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          message: "Status must be completed or failed",
        },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE device_commands
      SET
        status = ${status},
        executed_at = NOW()
      WHERE id = ${command_id}::uuid
        AND device_id = ${device.id}
        AND status = 'acknowledged'
      RETURNING
        id,
        command_type,
        status,
        acknowledged_at,
        executed_at
    `;

    if (result.length === 0) {
      const existing = await sql`
        SELECT id, status
        FROM device_commands
        WHERE id = ${command_id}::uuid
          AND device_id = ${device.id}
        LIMIT 1
      `;

      if (existing.length === 0) {
        return NextResponse.json(
          { success: false, message: "Command not found" },
          { status: 404 }
        );
      }

      if (existing[0].status === status) {
        return NextResponse.json({
          success: true,
          message: "Command status already recorded",
          command: existing[0],
        });
      }

      return NextResponse.json(
        {
          success: false,
          message: "Command is not awaiting execution result",
          current_status: existing[0].status,
        },
        { status: 409 }
      );
    }

    await sql`
      UPDATE devices
      SET
        status = 'online',
        last_seen_at = NOW(),
        updated_at = NOW()
      WHERE id = ${device.id}
    `;

    return NextResponse.json({
      success: true,
      message: "Command result recorded successfully",
      command: result[0],
    });
  } catch (error) {
    console.error("Command ACK API error:", error);

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

