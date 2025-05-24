import { builder } from "../_shared/builder";
import { executeCommand } from "../_shared/executor";
import { parser } from "../_shared/parser";
import { SmsCommand } from "../_shared/types";
import { ReqReadFile, RespOpen, RespReadChunk, RespClose } from "./schema";
import { handleDelugeResponse } from "../../lib/errorHandler";

type ProgressCb = (bytesRead: number, totalBytes: number) => void;

/**
 * Options for readFile command, including cancellation and progress reporting.
 */
export interface ReadFileOptions {
  /**
   * AbortSignal to cancel the operation.
   */
  signal?: AbortSignal;
  /**
   * Callback invoked after each chunk is read.
   *
   * @param bytesRead - Number of bytes read so far.
   * @param totalBytes - Total size of the file in bytes.
   */
  onProgress?: ProgressCb;
}

const CHUNK_SIZE = 1024;

/**
 * Reads a file from the Deluge device via SysEx and returns its contents.
 *
 * Note: The addr parameter is explicitly provided for each read chunk
 * to ensure proper file position tracking. Based on firmware analysis (smsysex.cpp):
 * - The Deluge tracks file position internally via fp->fPosition
 * - However, the addr parameter is REQUIRED for all read operations
 * - If addr != fPosition, the firmware performs an f_lseek() to the requested position
 * - This allows for both sequential and random access patterns
 *
 * @param req - Request object containing the path of the file to read.
 * @param opts - Optional settings including AbortSignal and onProgress callback.
 * @returns A promise resolving to the file content as an ArrayBuffer.
 *
 * @example
 * ```ts
 * import { readFile } from "@/commands";
 *
 * const buffer = await readFile({ path: "/SONGS/COOL.XML" }, {
 *   onProgress: (bytesRead, total) => {
 *     console.log(`Read ${bytesRead} of ${total} bytes`);
 *   },
 * });
 * ```
 */
export async function readFile(
  req: ReqReadFile,
  opts: ReadFileOptions = {},
): Promise<ArrayBuffer> {
  const { path } = req;
  const { signal, onProgress } = opts;

  // 1. OPEN
  const openResponse = await executeCommand<
    object,
    RespOpen & { err?: number }
  >({
    cmdId: SmsCommand.JSON,
    request: { open: { path, write: 0 } },
    build: () => builder.jsonOnly({ open: { path, write: 0 } }),
    parse: parser.json<RespOpen & { err?: number }>("^open"),
  });

  // Check for errors in open response
  const { fid, size } = handleDelugeResponse(openResponse, "open", {
    path,
    mode: "read",
  });

  try {
    // 2. READ LOOP
    const result = new Uint8Array(size);
    let offset = 0;

    while (offset < size) {
      if (signal?.aborted) {
        throw new Error("readFile: Aborted");
      }

      const chunkSize = Math.min(CHUNK_SIZE, size - offset);

      const readResponse = await executeCommand<
        object,
        RespReadChunk & { err?: number }
      >({
        cmdId: SmsCommand.JSON,
        request: { read: { fid, addr: offset, size: chunkSize } },
        build: () =>
          builder.jsonOnly({ read: { fid, addr: offset, size: chunkSize } }),
        parse: parser.jsonPlusBinary<RespReadChunk & { err?: number }>("data"),
      });

      // Check for errors in read response
      const { data } = handleDelugeResponse(readResponse, "read", {
        fid,
        offset,
        chunkSize,
      });

      result.set(data, offset);
      offset += data.length;
      onProgress?.(offset, size);
    }

    // 3. CLOSE
    const closeResponse = await executeCommand<
      object,
      RespClose & { err?: number }
    >({
      cmdId: SmsCommand.JSON,
      request: { close: { fid } },
      build: () => builder.jsonOnly({ close: { fid } }),
      parse: (raw): RespClose & { err?: number } =>
        parser.expectOk(raw) as RespClose & { err?: number },
    });

    // Check for errors in close response
    handleDelugeResponse(closeResponse, "close", { fid });

    return result.buffer;
  } catch (error) {
    // Always try to close file on error
    if (fid !== undefined) {
      try {
        await executeCommand({
          cmdId: SmsCommand.JSON,
          request: { close: { fid } },
          build: () => builder.jsonOnly({ close: { fid } }),
          parse: parser.expectOk,
        });
      } catch (closeError) {
        console.error("Failed to close file after error:", closeError);
      }
    }
    throw error;
  }
}
