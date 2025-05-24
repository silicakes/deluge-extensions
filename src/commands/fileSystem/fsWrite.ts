import { builder } from "../_shared/builder";
import { executeCommand } from "../_shared/executor";
import { parser } from "../_shared/parser";
import { SmsCommand } from "../_shared/types";
import { ReqWriteFile, RespOpen, RespClose } from "./schema";

/**
 * Writes data to a file on the Deluge device via SysEx.
 *
 * Note: The addr parameter is explicitly provided for each write chunk
 * to ensure proper file position tracking. Based on firmware analysis (smsysex.cpp):
 * - The Deluge tracks file position internally via fp->fPosition
 * - However, the addr parameter is REQUIRED for all write operations
 * - If addr != fPosition, the firmware performs an f_lseek() to the requested position
 * - This allows for both sequential and random access patterns
 *
 * @param req - Request object containing the path and data to write.
 * @returns A promise that resolves when the write is complete.
 */
export async function writeFile(req: ReqWriteFile): Promise<void> {
  const { path, data } = req;

  // 1. OPEN
  const { fid } = await executeCommand<object, RespOpen>({
    cmdId: SmsCommand.JSON,
    request: { open: { path, write: 1 } },
    build: () => builder.jsonOnly({ open: { path, write: 1 } }),
    parse: parser.json<RespOpen>("^open"),
  });

  // 2. WRITE
  await executeCommand<object, { err: number }>({
    cmdId: SmsCommand.JSON,
    request: { write: { fid, addr: 0, size: data.length } },
    build: () =>
      builder.jsonPlusBinary(
        { write: { fid, addr: 0, size: data.length } },
        data,
      ),
    parse: parser.json<{ err: number }>("^write"),
  });

  // 3. CLOSE
  await executeCommand<object, RespClose>({
    cmdId: SmsCommand.JSON,
    request: { close: { fid } },
    build: () => builder.jsonOnly({ close: { fid } }),
    parse: (raw): RespClose => parser.expectOk(raw) as RespClose,
  });
}
