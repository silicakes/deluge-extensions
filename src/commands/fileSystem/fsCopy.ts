import { builder } from "../_shared/builder";
import { executeCommand } from "../_shared/executor";
import { parser } from "../_shared/parser";
import { SmsCommand } from "../_shared/types";
import type { ReqCopyFile } from "./schema";

// Alias the request type for backward compatibility
export type CopyFileParams = ReqCopyFile;

/**
 * Copy a file on the Deluge device.
 *
 * @param params - The copy parameters
 * @param params.from - Source file path
 * @param params.to - Destination file path
 */
export async function copyFile(params: CopyFileParams): Promise<void> {
  const { from, to } = params;
  await executeCommand<object, Record<string, unknown>>({
    cmdId: SmsCommand.JSON,
    request: { copy: { from, to } },
    build: () => builder.jsonOnly({ copy: { from, to } }),
    parse: parser.expectOk,
  });
}
