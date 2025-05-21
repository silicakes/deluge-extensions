/**
 * Convert FatFS error code to human-readable text
 * @param err FatFS error code
 * @returns Human-readable error message
 */
export function fatErrorToText(err: number): string {
  const errors: Record<number, string> = {
    0: "OK",
    1: "Disk error",
    2: "Internal error",
    3: "Drive not ready",
    4: "File not found",
    5: "Path not found",
    6: "Invalid path name",
    7: "Access denied",
    8: "File exists",
    9: "Directory is not empty",
    10: "Invalid object",
    11: "Drive is write-protected",
    12: "Invalid drive",
    13: "No filesystem",
    14: "Format aborted",
    15: "No more files",
    16: "Cannot allocate memory",
    17: "Too many open files",
    18: "Invalid parameter",
  };
  return errors[err] || `Unknown error ${err}`;
}
