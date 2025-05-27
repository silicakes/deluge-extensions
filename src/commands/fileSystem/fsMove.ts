import { builder } from "../_shared/builder";
import { executeCommand } from "../_shared/executor";
import { parser } from "../_shared/parser";
import { SmsCommand } from "../_shared/types";
import type { ReqMoveFile } from "./schema";

// Alias the request type for backward compatibility
export type MoveFileParams = ReqMoveFile;

/**
 * Move a file on the Deluge device.
 *
 * @param params - The move parameters
 * @param params.from - Source file path
 * @param params.to - Destination file path
 * @param params.update_paths - Whether to automatically update XML paths for the moved file
 */
export async function moveFile(params: MoveFileParams): Promise<void> {
  const { from, to, update_paths } = params;

  // Build the move request object
  const moveRequest: { from: string; to: string; update_paths?: boolean } = {
    from,
    to,
  };
  if (update_paths) {
    moveRequest.update_paths = true;
  }

  await executeCommand<object, Record<string, unknown>>({
    cmdId: SmsCommand.JSON,
    request: { move: moveRequest },
    build: () => builder.jsonOnly({ move: moveRequest }),
    parse: parser.expectOk,
  });
}
