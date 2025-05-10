import { executeCommand } from "../../_shared/executor";
import { builder } from "../../_shared/builder";
import { parser } from "../../_shared/parser";
import { SmsCommand } from "../../_shared/types";
import type { Req, Resp } from "./schema";

// Internal chunking helper, keeps logic local to this command.
async function chunkedTransfer(
  data: Uint8Array,
  chunkSize: number,
  onChunk: (chunk: Uint8Array, offset: number) => Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  let offset = 0;
  while (offset < data.length) {
    if (signal?.aborted) throw new Error("Aborted");
    const size = Math.min(chunkSize, data.length - offset);
    const chunk = data.slice(offset, offset + size);
    await onChunk(chunk, offset);
    offset += size;
  }
}

/**
 * Upload a single file to the Deluge device via SysEx.
 */
export async function uploadFile(
  req: Req,
  opts?: {
    onProgress?: (sent: number, total: number) => void;
    signal?: AbortSignal;
  },
): Promise<Resp> {
  const { path, data } = req;

  // 1) OPEN file for writing
  const { fid } = await executeCommand<object, { fid: number }>({
    cmdId: SmsCommand.JSON,
    request: { open: { path, write: 1 } },
    build: () => builder.jsonOnly({ open: { path, write: 1 } }),
    parse: parser.json("^open"),
  });

  // 2) WRITE chunks
  await chunkedTransfer(
    data,
    512,
    async (chunk, offset) => {
      await executeCommand<object, object>({
        cmdId: SmsCommand.JSON,
        request: { write: { fid, addr: offset, size: chunk.length } },
        build: () =>
          builder.jsonPlusBinary(
            { write: { fid, addr: offset, size: chunk.length } },
            chunk,
          ),
        parse: parser.expectOk,
      });
      opts?.onProgress?.(offset + chunk.length, data.length);
    },
    opts?.signal,
  );

  // 3) CLOSE file handle
  await executeCommand<object, object>({
    cmdId: SmsCommand.JSON,
    request: { close: { fid } },
    build: () => builder.jsonOnly({ close: { fid } }),
    parse: parser.expectOk,
  });

  return { ok: true };
}
