import { DelugeErrorCode, DelugeFileSystemError } from "./delugeErrors";

export function handleDelugeResponse<T extends { err?: number }>(
  response: T,
  command: string,
  context?: Record<string, unknown>,
  successCodes: number[] = [0],
): T {
  if (response.err !== undefined && !successCodes.includes(response.err)) {
    throw new DelugeFileSystemError(
      response.err as DelugeErrorCode,
      command,
      context,
    );
  }
  return response;
}

// For commands that might have different success codes
export function isSuccessCode(code: number, command: string): boolean {
  // Special cases
  if (command === "delete" && (code === 0 || code === 4)) {
    return true; // 4 = file not found, which is OK for delete
  }

  // Default: only 0 is success
  return code === 0;
}
