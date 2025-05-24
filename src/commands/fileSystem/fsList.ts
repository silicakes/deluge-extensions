import { executeCommand } from "../_shared/executor";
import { builder } from "../_shared/builder";
import { parser } from "../_shared/parser";
import { SmsCommand } from "../_shared/types";
import type { ReqListDirectory } from "./schema";
import type { FileEntry } from "@/state";

/**
 * List directory contents on the Deluge device.
 */
export async function listDirectory(
  params: ReqListDirectory,
): Promise<FileEntry[]> {
  console.log("fsList.listDirectory: params=", params);
  const { path, offset = 0, lines = 64, force } = params;
  const response = await executeCommand<
    object,
    { list: FileEntry[]; err: number }
  >({
    cmdId: SmsCommand.JSON,
    request: { dir: { path, offset, lines, force } },
    build: () => builder.jsonOnly({ dir: { path, offset, lines, force } }),
    parse: parser.json<{ list: FileEntry[]; err: number }>("^dir"),
  });
  console.log(
    `fsList.listDirectory: response for path=${path} => entries=`,
    response.list.map((e) => e.name),
  );
  return response.list;
}

/**
 * List complete directory contents on the Deluge device, handling chunking automatically.
 * This function will repeatedly call listDirectory until all entries are loaded.
 */
export async function listDirectoryComplete(params: {
  path: string;
  force?: boolean;
  onProgress?: (loaded: number, total?: number) => void;
}): Promise<FileEntry[]> {
  console.log("fsList.listDirectoryComplete: params=", params);
  const allEntries: FileEntry[] = [];
  let offset = 0;
  const chunkSize = 64; // Reasonable chunk size
  let hasMore = true;

  while (hasMore) {
    const response = await listDirectory({
      path: params.path,
      offset,
      lines: chunkSize,
      ...(params.force !== undefined && { force: params.force }),
    });

    allEntries.push(...response);

    // Determine if there are more entries
    // Continue as long as we get any entries back (like vuefinder does)
    hasMore = response.length > 0;
    offset += response.length;

    // Report progress if callback provided (only if we got entries)
    if (params.onProgress && response.length > 0) {
      params.onProgress(allEntries.length);
    }

    // Safety check to prevent infinite loops
    if (offset > 10000) {
      console.warn(`Directory ${params.path} has over 10000 entries, stopping`);
      break;
    }
  }

  console.log(
    `fsList.listDirectoryComplete: loaded ${allEntries.length} total entries for path=${params.path}`,
  );
  return allEntries;
}
