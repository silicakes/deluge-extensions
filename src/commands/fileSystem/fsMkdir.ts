import { executeCommand } from "../_shared/executor";
import { builder } from "../_shared/builder";
import { parser } from "../_shared/parser";
import { SmsCommand } from "../_shared/types";
import type { ReqMakeDirectory } from "./schema";

/**
 * Create a directory on the Deluge device.
 */
export async function makeDirectory(params: ReqMakeDirectory): Promise<void> {
  const { path } = params;
  // Build FAT date and time parameters
  const now = new Date();
  const fatDate =
    ((now.getFullYear() - 1980) << 9) |
    ((now.getMonth() + 1) << 5) |
    now.getDate();
  const fatTime =
    (now.getHours() << 11) |
    (now.getMinutes() << 5) |
    Math.floor(now.getSeconds() / 2);

  await executeCommand<object, Record<string, unknown>>({
    cmdId: SmsCommand.JSON,
    request: { mkdir: { path, date: fatDate, time: fatTime } },
    build: () =>
      builder.jsonOnly({ mkdir: { path, date: fatDate, time: fatTime } }),
    parse: parser.expectOk,
  });
}
