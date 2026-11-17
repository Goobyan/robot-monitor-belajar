import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await sql`
      SELECT
        NOW() AS server_time,
        current_database() AS database_name
    `;

    return NextResponse.json({
      success: true,
      message: "Database connection successful",
      database: result[0].database_name,
      server_time: result[0].server_time,
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Database connection failed",
      },
      { status: 500 }
    );
  }
}
