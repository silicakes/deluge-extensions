/**
 * Truncates a filename with ellipsis in the middle while preserving the extension
 * @param filename - The full filename including extension
 * @param maxLength - Maximum total length of the truncated filename
 * @returns The truncated filename with ellipsis in the middle
 */
function truncateFileName(filename: string, maxLength: number = 20): string {
  // If the filename is already short enough, return as is
  if (filename.length <= maxLength) {
    return filename;
  }

  // Find the last dot to separate name and extension
  const lastDotIndex = filename.lastIndexOf(".");

  // If no extension found, treat the whole string as filename
  if (lastDotIndex === -1 || lastDotIndex === 0) {
    return truncateWithoutExtension(filename, maxLength);
  }

  const namePart = filename.substring(0, lastDotIndex);
  const extension = filename.substring(lastDotIndex); // includes the dot

  // If the extension itself is too long, we need to handle it differently
  if (extension.length >= maxLength - 3) {
    // 3 chars for "..."
    return filename.substring(0, maxLength - 3) + "...";
  }

  // Calculate how many characters we have for the name part
  const availableForName = maxLength - extension.length - 3; // 3 for "..."

  // If we don't have enough space, just show start of filename + ... + extension
  if (availableForName <= 0) {
    return "..." + extension;
  }

  // Split the available space between start and end of the name
  const startChars = Math.ceil(availableForName / 2);
  const endChars = Math.floor(availableForName / 2);

  const truncatedName =
    namePart.substring(0, startChars) +
    "..." +
    namePart.substring(namePart.length - endChars);

  return truncatedName + extension;
}

/**
 * Helper function to truncate filenames without extensions
 * @param filename - The filename without extension
 * @param maxLength - Maximum length
 * @returns Truncated filename
 */
function truncateWithoutExtension(filename: string, maxLength: number): string {
  if (filename.length <= maxLength) {
    return filename;
  }

  const availableLength = maxLength - 3; // 3 for "..."
  const startChars = Math.ceil(availableLength / 2);
  const endChars = Math.floor(availableLength / 2);

  return (
    filename.substring(0, startChars) +
    "..." +
    filename.substring(filename.length - endChars)
  );
}

/**
 * Formats a filename for multi-line display with middle truncation
 * @param filename - The full filename
 * @param maxLineLength - Maximum characters per line
 * @param maxLines - Maximum number of lines (default 2)
 * @returns Array of lines for display
 */
function formatFileNameMultiLine(
  filename: string,
  maxLineLength: number = 15,
  maxLines: number = 2,
): string[] {
  // First, check if we need truncation at all
  const totalMaxLength = maxLineLength * maxLines;

  if (filename.length <= totalMaxLength) {
    // Split into lines without truncation
    return splitIntoLines(filename, maxLineLength);
  }

  // We need to truncate - use middle truncation
  const truncated = truncateFileName(filename, totalMaxLength);
  return splitIntoLines(truncated, maxLineLength);
}

/**
 * Helper function to split text into lines
 * @param text - Text to split
 * @param maxLineLength - Maximum characters per line
 * @returns Array of lines
 */
function splitIntoLines(text: string, maxLineLength: number): string[] {
  const lines: string[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    lines.push(text.substring(currentIndex, currentIndex + maxLineLength));
    currentIndex += maxLineLength;
  }

  return lines;
}

/**
 * Formats a filename for display in the icon grid with smart truncation
 * that preserves file extensions and handles multi-line display.
 *
 * @param filename - The original filename
 * @returns Object with display text and whether it was truncated
 */
export function formatFilenameForDisplay(filename: string): {
  displayName: string;
  wasTruncated: boolean;
} {
  const maxLength = 60; // Increased from 32 to allow more room for file names
  const truncated = truncateFileName(filename, maxLength);

  return {
    displayName: truncated,
    wasTruncated: truncated !== filename,
  };
}

/**
 * Formats a filename for multi-line display in icon grid without aggressive truncation
 * Relies on CSS line clamping instead of JavaScript truncation for better visual results
 *
 * @param filename - The original filename
 * @param maxDisplayLength - Maximum length before truncation (default 80 for 2-3 lines)
 * @returns Object with display text and whether it was truncated
 */
export function formatFilenameForIconGrid(
  filename: string,
  maxDisplayLength: number = 80,
): {
  displayName: string;
  wasTruncated: boolean;
} {
  // For icon grid, we allow longer names and let CSS handle the line wrapping
  // Only truncate if the filename is extremely long
  if (filename.length <= maxDisplayLength) {
    return {
      displayName: filename,
      wasTruncated: false,
    };
  }

  // For very long filenames, use smart truncation that preserves extensions
  const truncated = truncateFileName(filename, maxDisplayLength);
  return {
    displayName: truncated,
    wasTruncated: true,
  };
}

// Legacy function name for backward compatibility
export function truncateFilename(
  filename: string,
  maxLength: number = 32,
): string {
  return truncateFileName(filename, maxLength);
}

// Export the new functions
export {
  truncateFileName,
  formatFileNameMultiLine,
  truncateWithoutExtension,
  splitIntoLines,
};
