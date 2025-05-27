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

  try {
    // 2. WRITE in chunks for large files
    const chunkSize = 128; // Use 128 byte chunks to avoid SysEx size limits
    let offset = 0;

    while (offset < data.length) {
      const size = Math.min(chunkSize, data.length - offset);
      const chunk = data.slice(offset, offset + size);

      await executeCommand<object, { err: number }>({
        cmdId: SmsCommand.JSON,
        request: { write: { fid, addr: offset, size: chunk.length } },
        build: () =>
          builder.jsonPlusBinary(
            { write: { fid, addr: offset, size: chunk.length } },
            chunk,
          ),
        parse: parser.json<{ err: number }>("^write"),
      });

      offset += size;
    }

    // 3. CLOSE
    await executeCommand<object, RespClose>({
      cmdId: SmsCommand.JSON,
      request: { close: { fid } },
      build: () => builder.jsonOnly({ close: { fid } }),
      parse: (raw): RespClose => parser.expectOk(raw) as RespClose,
    });
  } catch (error) {
    // Always try to close file on error
    try {
      await executeCommand<object, RespClose>({
        cmdId: SmsCommand.JSON,
        request: { close: { fid } },
        build: () => builder.jsonOnly({ close: { fid } }),
        parse: (raw): RespClose => parser.expectOk(raw) as RespClose,
      });
    } catch (closeError) {
      console.error("Failed to close file after error:", closeError);
    }
    throw error;
  }
}
