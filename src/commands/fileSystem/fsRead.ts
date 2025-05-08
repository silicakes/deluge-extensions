import { executeCommand } from "../_shared/executor";
import { builder } from "../_shared/builder";
import { parser } from "../_shared/parser";
import { SmsCommand } from "../_shared/types";
import { ReqReadFile, RespOpen, RespReadChunk, RespClose } from "./schema";

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
  const { fid, size } = await executeCommand<object, RespOpen>({
    cmdId: SmsCommand.JSON,
    request: { open: { path, write: 0 } },
    build: () => builder.jsonOnly({ open: { path, write: 0 } }),
    parse: parser.json<RespOpen>("^open"),
  });

  // 2. READ LOOP
  const result = new Uint8Array(size);
  let offset = 0;

  while (offset < size) {
    if (signal?.aborted) {
      throw new Error("readFile: Aborted");
    }

    const chunkSize = Math.min(CHUNK_SIZE, size - offset);

    const { data } = await executeCommand<object, RespReadChunk>({
      cmdId: SmsCommand.JSON,
      request: { read: { fid, addr: offset, size: chunkSize } },
      build: () =>
        builder.jsonOnly({ read: { fid, addr: offset, size: chunkSize } }),
      parse: parser.jsonPlusBinary<RespReadChunk>("data"),
    });

    result.set(data, offset);
    offset += data.length;
    onProgress?.(offset, size);
  }

  // 3. CLOSE
  await executeCommand<object, RespClose>({
    cmdId: SmsCommand.JSON,
    request: { close: { fid } },
    build: () => builder.jsonOnly({ close: { fid } }),
    parse: parser.expectOk,
  });

  return result.buffer;
}
