import { DelugeErrorCode, DelugeFileSystemError } from "./delugeErrors";

export function getUserFriendlyError(error: unknown): string {
  if (error instanceof DelugeFileSystemError) {
    switch (error.code) {
      case DelugeErrorCode.DISK_ERROR:
        return "SD card error. Please check that the card is properly inserted and not corrupted.";

      case DelugeErrorCode.INTERNAL_ERROR:
        return "An internal error occurred. Please try again or restart your Deluge.";

      case DelugeErrorCode.DRIVE_NOT_READY:
        return "SD card not ready. Please ensure it's properly inserted.";

      case DelugeErrorCode.OUT_OF_MEMORY:
        return "The SD card is full. Please delete some files to free up space.";

      case DelugeErrorCode.INVALID_PATH:
      case DelugeErrorCode.INVALID_PARAMETER:
        return "The filename contains invalid characters. Please use only letters, numbers, and basic punctuation.";

      case DelugeErrorCode.FILE_NOT_FOUND:
        return "The file could not be found. It may have been moved or deleted.";

      case DelugeErrorCode.PATH_NOT_FOUND:
        return "The folder could not be found. It may have been moved or deleted.";

      case DelugeErrorCode.ACCESS_DENIED:
        return "Access denied. The file may be in use or protected.";

      case DelugeErrorCode.FILE_EXISTS:
        return "A file with that name already exists. Please choose a different name.";

      case DelugeErrorCode.DIRECTORY_NOT_EMPTY:
        return "Cannot delete directory because it contains files. Delete the contents first.";

      case DelugeErrorCode.WRITE_PROTECTED:
        return "The SD card is write-protected. Please check the lock switch on the card.";

      case DelugeErrorCode.NO_FILESYSTEM:
        return "No filesystem found on SD card. The card may need to be formatted.";

      case DelugeErrorCode.TOO_MANY_OPEN_FILES:
        return "Too many files are open. Please close some files and try again.";

      case DelugeErrorCode.INVALID_OBJECT:
        return "Invalid file or directory. The item may be corrupted.";

      case DelugeErrorCode.INVALID_DRIVE:
        return "Invalid drive specified. Please check the path.";

      case DelugeErrorCode.FORMAT_ABORTED:
        return "Format operation was aborted.";

      case DelugeErrorCode.NO_MORE_FILES:
        return "No more files found in the directory.";

      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    // Handle other known errors
    if (error.message.includes("MIDI output not selected")) {
      return "Please connect your Deluge first.";
    }

    if (error.message.includes("timed out")) {
      return "Communication with Deluge timed out. Please check the connection and try again.";
    }

    if (error.message.includes("WebMidi is not enabled")) {
      return "MIDI is not enabled in your browser. Please enable it in your browser settings.";
    }

    if (error.message.includes("WebMidi is not supported")) {
      return "Your browser doesn't support MIDI. Please use a supported browser like Chrome or Edge.";
    }
  }

  return "An unexpected error occurred. Please try again.";
}
