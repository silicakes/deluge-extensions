import { ping } from "@/commands/session";

/**
 * Test SysEx connectivity by pinging the device.
 * @returns true if ping succeeds, false otherwise
 */
export async function testSysExConnectivity(): Promise<boolean> {
  try {
    await ping();
    return true;
  } catch {
    return false;
  }
}
