import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/device-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
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

    const result = await sql`
      UPDATE devices
      SET
        status = 'online',
        last_seen_at = NOW(),
        updated_at = NOW()
      WHERE id = ${device.id}
      RETURNING device_code, status, last_seen_at
    `;

    return NextResponse.json({
      success: true,
      message: "Heartbeat received",
      device: result[0],
    });
  } catch (error) {
    console.error("Heartbeat error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}
