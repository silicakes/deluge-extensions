import { FileEntry } from "../state";

const audioExts = ["wav", "mp3", "ogg", "flac"];
const textExts = ["txt", "xml", "json", "csv", "md", "yml", "yaml"];

/**
 * Determines if a file entry is an audio file based on extension
 * @param entry FileEntry to check
 * @returns true if file is an audio file
 */
export function isAudio(entry: FileEntry): boolean {
  // Must be a file, not a directory
  if ((entry.attr & 0x10) !== 0) return false;

  // Check extension
  const ext = entry.name.split(".").pop()?.toLowerCase() || "";
  return audioExts.includes(ext);
}

/**
 * Determines if a file entry is a text file based on extension
 * @param entry FileEntry to check
 * @returns true if file is a text file
 */
export function isText(entry: FileEntry): boolean {
  // Must be a file, not a directory
  if ((entry.attr & 0x10) !== 0) return false;

  // Check extension
  const ext = entry.name.split(".").pop()?.toLowerCase() || "";
  return textExts.includes(ext);
}

/**
 * Returns MIME type for a file based on its extension
 * @param path File path
 * @returns Appropriate MIME type string
 */
export function getMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";

  // Audio types
  if (ext === "wav") return "audio/wav";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "ogg") return "audio/ogg";
  if (ext === "flac") return "audio/flac";

  // Text types
  if (ext === "txt") return "text/plain";
  if (ext === "xml") return "text/xml";
  if (ext === "json") return "application/json";
  if (ext === "csv") return "text/csv";
  if (ext === "md") return "text/markdown";
  if (ext === "yml" || ext === "yaml") return "application/yaml";

  // Default
  return "application/octet-stream";
}
