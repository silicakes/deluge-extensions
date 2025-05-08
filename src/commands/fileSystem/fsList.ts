import { listDirectory as legacyListDirectory } from "@/lib/midi";
import type { FileEntry } from "@/state";

export interface ListDirectoryParams {
  path: string;
  offset?: number;
  lines?: number;
  force?: boolean;
}

/**
 * List directory contents on the Deluge device.
 */
export async function listDirectory(
  params: ListDirectoryParams,
): Promise<FileEntry[]> {
  const { path, offset, lines, force } = params;
  return legacyListDirectory(path, { offset, lines, force });
}
