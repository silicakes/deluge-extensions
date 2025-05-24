// Based on FatFS error codes used by Deluge
export enum DelugeErrorCode {
  // FatFS Error Codes
  SUCCESS = 0, // FR_OK
  DISK_ERROR = 1, // FR_DISK_ERR
  INTERNAL_ERROR = 2, // FR_INT_ERR
  DRIVE_NOT_READY = 3, // FR_NOT_READY
  FILE_NOT_FOUND = 4, // FR_NO_FILE
  PATH_NOT_FOUND = 5, // FR_NO_PATH
  INVALID_PATH = 6, // FR_INVALID_NAME
  ACCESS_DENIED = 7, // FR_DENIED
  FILE_EXISTS = 8, // FR_EXIST
  DIRECTORY_NOT_EMPTY = 9, // FR_INVALID_OBJECT (when directory not empty)
  INVALID_OBJECT = 10, // FR_INVALID_OBJECT
  WRITE_PROTECTED = 11, // FR_WRITE_PROTECTED
  INVALID_DRIVE = 12, // FR_INVALID_DRIVE
  NO_FILESYSTEM = 13, // FR_NOT_ENABLED
  FORMAT_ABORTED = 14, // FR_MKFS_ABORTED
  NO_MORE_FILES = 15, // FR_TIMEOUT (no more files)
  OUT_OF_MEMORY = 16, // FR_NOT_ENOUGH_CORE
  TOO_MANY_OPEN_FILES = 17, // FR_TOO_MANY_OPEN_FILES
  INVALID_PARAMETER = 18, // FR_INVALID_PARAMETER
}

export interface DelugeError extends Error {
  code: DelugeErrorCode;
  command: string;
  context?: Record<string, unknown>;
}

export class DelugeFileSystemError extends Error implements DelugeError {
  constructor(
    public code: DelugeErrorCode,
    public command: string,
    public context?: Record<string, unknown>,
  ) {
    super(getErrorMessage(code, command, context));
    this.name = "DelugeFileSystemError";
  }
}

export function getErrorMessage(
  code: DelugeErrorCode,
  command: string,
  context?: Record<string, unknown>,
): string {
  const baseMessage = fatErrorToText(code);
  const contextStr = context ? ` (${JSON.stringify(context)})` : "";
  return `${command} failed: ${baseMessage}${contextStr}`;
}

/**
 * Convert FatFS error code to human-readable text
 * Migrated from src/lib/midi.ts
 * @param err FatFS error code
 * @returns Human-readable error message
 */
export function fatErrorToText(err: number): string {
  switch (err) {
    case DelugeErrorCode.SUCCESS:
      return "OK";
    case DelugeErrorCode.DISK_ERROR:
      return "Disk error";
    case DelugeErrorCode.INTERNAL_ERROR:
      return "Internal error";
    case DelugeErrorCode.DRIVE_NOT_READY:
      return "Drive not ready";
    case DelugeErrorCode.FILE_NOT_FOUND:
      return "File not found";
    case DelugeErrorCode.PATH_NOT_FOUND:
      return "Path not found";
    case DelugeErrorCode.INVALID_PATH:
      return "Invalid path name";
    case DelugeErrorCode.ACCESS_DENIED:
      return "Access denied";
    case DelugeErrorCode.FILE_EXISTS:
      return "File exists";
    case DelugeErrorCode.DIRECTORY_NOT_EMPTY:
      return "Directory is not empty";
    case DelugeErrorCode.INVALID_OBJECT:
      return "Invalid object";
    case DelugeErrorCode.WRITE_PROTECTED:
      return "Drive is write-protected";
    case DelugeErrorCode.INVALID_DRIVE:
      return "Invalid drive";
    case DelugeErrorCode.NO_FILESYSTEM:
      return "No filesystem";
    case DelugeErrorCode.FORMAT_ABORTED:
      return "Format aborted";
    case DelugeErrorCode.NO_MORE_FILES:
      return "No more files";
    case DelugeErrorCode.OUT_OF_MEMORY:
      return "Cannot allocate memory";
    case DelugeErrorCode.TOO_MANY_OPEN_FILES:
      return "Too many open files";
    case DelugeErrorCode.INVALID_PARAMETER:
      return "Invalid parameter";
    default:
      return `Unknown error ${err}`;
  }
}
