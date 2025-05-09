import { builder } from "../_shared/builder";
import { executeCommand } from "../_shared/executor";
import { parser } from "../_shared/parser";
import { SmsCommand } from "../_shared/types";
import type { ReqRenameFile } from "./schema";

// Alias the request type for backward compatibility
export type RenameFileParams = ReqRenameFile;

/**
 * Rename or move a file or directory on the Deluge device.
 */
export async function renameFile(params: RenameFileParams): Promise<void> {
  const { oldPath, newPath } = params;
  await executeCommand<object, Record<string, unknown>>({
    cmdId: SmsCommand.JSON,
    request: { rename: { from: oldPath, to: newPath } },
    build: () => builder.jsonOnly({ rename: { from: oldPath, to: newPath } }),
    parse: parser.expectOk,
  });
}
