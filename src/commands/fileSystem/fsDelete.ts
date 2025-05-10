import { executeCommand } from "../_shared/executor";
import { builder } from "../_shared/builder";
import { parser } from "../_shared/parser";
import { SmsCommand } from "../_shared/types";
import type { ReqDeleteFile } from "./schema";

/**
 * Delete a file or directory on the Deluge device.
 */
export async function deleteFile(params: ReqDeleteFile): Promise<void> {
  const { path } = params;
  await executeCommand<object, Record<string, unknown>>({
    cmdId: SmsCommand.JSON,
    request: { delete: { path } },
    build: () => builder.jsonOnly({ delete: { path } }),
    parse: parser.expectOk,
  });
}
