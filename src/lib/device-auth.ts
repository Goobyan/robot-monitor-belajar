import { createHash, timingSafeEqual } from "node:crypto";
import { sql } from "@/lib/db";

export async function authenticateDevice(request: Request) {
  const deviceCode = request.headers.get("x-device-code");
  const deviceToken = request.headers.get("x-device-token");

  if (!deviceCode || !deviceToken) {
    return null;
  }

  const result = await sql`
    SELECT id, token_hash
    FROM devices
    WHERE device_code = ${deviceCode}
    LIMIT 1
  `;

  if (result.length === 0) {
    return null;
  }

  const expectedHash = String(result[0].token_hash);

  const receivedHash = createHash("sha256")
    .update(deviceToken)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const receivedBuffer = Buffer.from(receivedHash, "hex");

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return null;
  }

  return {
    id: String(result[0].id),
    deviceCode,
  };
}
