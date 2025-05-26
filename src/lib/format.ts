/**
 * Format bytes into human-readable string with standard units (KB, MB, GB)
 * @param bytes Number of bytes to format
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted string with appropriate unit
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${value.toFixed(decimals)} ${sizes[i]}`;
}

/**
 * Format FAT date and time into human-readable string
 * @param fatDate FAT date format (16-bit)
 * @param fatTime FAT time format (16-bit)
 * @returns Formatted date/time string
 */
export function formatDate(fatDate: number, fatTime: number): string {
  // FAT date format: bits 15-9 = year (relative to 1980), bits 8-5 = month, bits 4-0 = day
  const year = ((fatDate >> 9) & 0x7f) + 1980;
  const month = (fatDate >> 5) & 0x0f;
  const day = fatDate & 0x1f;

  // FAT time format: bits 15-11 = hours, bits 10-5 = minutes, bits 4-0 = seconds/2
  const hours = (fatTime >> 11) & 0x1f;
  const minutes = (fatTime >> 5) & 0x3f;
  const seconds = (fatTime & 0x1f) * 2;

  // Validate ranges before creating date
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hours > 23 ||
    minutes > 59 ||
    seconds > 59
  ) {
    return "Invalid Date";
  }

  // Create date object and format
  try {
    const date = new Date(year, month - 1, day, hours, minutes, seconds);

    // Check if date is valid and matches input values
    if (
      isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return "Invalid Date";
    }

    // Format as locale string with short format
    return (
      date.toLocaleDateString(undefined, {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
      }) +
      " " +
      date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    );
  } catch {
    return "Invalid Date";
  }
}
