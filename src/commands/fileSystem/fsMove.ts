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
 */
export async function moveFile(params: MoveFileParams): Promise<void> {
  const { from, to } = params;
  await executeCommand<object, Record<string, unknown>>({
    cmdId: SmsCommand.JSON,
    request: { move: { from, to } },
    build: () => builder.jsonOnly({ move: { from, to } }),
    parse: parser.expectOk,
  });
}
