
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/device-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const device = await authenticateDevice(request);

    if (!device) {
      return NextResponse.json(
        { success: false, message: "Unauthorized device" },
        { status: 401 }
      );
    }

    // Ambil maksimal 10 perintah pending secara atomik.
    // Perintah langsung diubah menjadi acknowledged agar
    // tidak dikirim berulang kali pada polling berikutnya.
    const commands = await sql`
      WITH picked AS (
        SELECT id
        FROM device_commands
        WHERE device_id = ${device.id}
          AND status = 'pending'
        ORDER BY created_at ASC
        LIMIT 10
        FOR UPDATE SKIP LOCKED
      )
      UPDATE device_commands AS command
      SET
        status = 'acknowledged',
        acknowledged_at = NOW()
      FROM picked
      WHERE command.id = picked.id
      RETURNING
        command.id,
        command.command_type,
        command.payload,
        command.status,
        command.created_at,
        command.acknowledged_at
    `;

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
      message: commands.length
        ? "Commands retrieved successfully"
        : "No pending commands",
      count: commands.length,
      commands,
    });
  } catch (error) {
    console.error("Get commands API error:", error);

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

