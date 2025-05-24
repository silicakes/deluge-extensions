export interface FilenameValidation {
  isValid: boolean;
  sanitized: string;
  warnings: string[];
  errors: string[];
}

export function validateFilename(filename: string): FilenameValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let sanitized = filename;

  // Check for illegal characters (FAT32)
  // Build regex for control characters and other illegal FAT32 characters
  const controlChars = Array.from({ length: 32 }, (_, i) =>
    String.fromCharCode(i),
  ).join("");
  const illegalCharsPattern = `[${controlChars}\x7F\\\\/:*?"<>|]`;
  const ILLEGAL_CHARS = new RegExp(illegalCharsPattern, "g");
  const ILLEGAL_MATCHES = filename.match(ILLEGAL_CHARS);

  if (ILLEGAL_MATCHES) {
    // Format the illegal characters for display
    const displayChars = ILLEGAL_MATCHES.map((char) => {
      const code = char.charCodeAt(0);
      if (code < 32 || code === 127) {
        return `\\x${code.toString(16).padStart(2, "0")}`;
      }
      return char;
    });
    errors.push(`Illegal characters found: ${displayChars.join(", ")}`);
    // Replace illegal chars with underscore
    sanitized = sanitized.replace(ILLEGAL_CHARS, "_");
  }

  // Check for reserved names (FAT32)
  const RESERVED_NAMES = [
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "COM5",
    "COM6",
    "COM7",
    "COM8",
    "COM9",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
    "LPT5",
    "LPT6",
    "LPT7",
    "LPT8",
    "LPT9",
  ];
  const nameWithoutExt = sanitized.split(".")[0].toUpperCase();

  if (RESERVED_NAMES.includes(nameWithoutExt)) {
    errors.push(`Reserved filename: ${nameWithoutExt}`);
    sanitized = `_${sanitized}`;
  }

  // Check for trailing dots or spaces (FAT32 strips these)
  if (/[. ]$/.test(sanitized)) {
    warnings.push("Trailing dots or spaces will be removed");
    sanitized = sanitized.replace(/[. ]+$/, "");
  }

  // Check filename length (FAT32 limit: 255 bytes in UTF-8)
  const utf8Length = new TextEncoder().encode(sanitized).length;
  if (utf8Length > 255) {
    errors.push(`Filename too long: ${utf8Length} bytes (max 255)`);
    // Truncate to fit
    while (new TextEncoder().encode(sanitized).length > 255) {
      sanitized = sanitized.slice(0, -1);
    }
  }

  // Note: Spaces in filenames are actually OK - we mistakenly thought they were problematic
  // but the issue was related to directory chunking, not spaces

  return {
    isValid: errors.length === 0,
    sanitized,
    warnings,
    errors,
  };
}

/**
 * Sanitize a filename for safe use with Deluge
 */
export function sanitizeFilename(filename: string): string {
  const validation = validateFilename(filename);
  return validation.sanitized;
}

export enum DelugeFileError {
  SUCCESS = 0,
  FILE_NOT_FOUND = 4,
  INVALID_FILENAME = 9,
  // Add more as discovered
}

export function getErrorMessage(code: number): string {
  switch (code) {
    case DelugeFileError.INVALID_FILENAME:
      return "Invalid filename - contains illegal characters";
    case DelugeFileError.FILE_NOT_FOUND:
      return "File not found";
    case DelugeFileError.SUCCESS:
      return "Success";
    default:
      return `Unknown error code: ${code}`;
  }
}
