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
  const { path, offset = 0, lines = 64, force = false } = params;
  const response = await executeCommand<
    object,
    { list: FileEntry[]; err: number }
  >({
    cmdId: SmsCommand.JSON,
    request: { dir: { path, offset, lines, force } },
    build: () => builder.jsonOnly({ dir: { path, offset, lines, force } }),
    parse: parser.json<{ list: FileEntry[]; err: number }>("^dir"),
  });
  return response.list;
}
