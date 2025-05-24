import { executeCommand } from "../../_shared/executor";
import { builder } from "../../_shared/builder";
import { parser } from "../../_shared/parser";
import { SmsCommand } from "../../_shared/types";
import type { Req, Resp } from "./schema";
import { resetSession } from "@/lib/smsysex";

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
  console.log("[uploadFile] Starting upload:", {
    destPath: path,
    dataSize: data.length,
    overwrite: req.overwrite,
  });

  let fid: number | null = null;
  let writtenSoFar = 0; // Track actual bytes written

  try {
    // 1) OPEN file for writing
    const now = new Date();
    const fdate =
      ((now.getFullYear() - 1980) << 9) |
      ((now.getMonth() + 1) << 5) |
      now.getDate();
    const ftime =
      (now.getHours() << 11) |
      (now.getMinutes() << 5) |
      Math.round(now.getSeconds() / 2);

    const openRequest = {
      open: {
        path,
        write: 1,
        date: fdate,
        time: ftime,
      },
    };

    const openResponse = await executeCommand<object, { fid: number }>({
      cmdId: SmsCommand.JSON,
      request: openRequest,
      build: () => builder.jsonOnly(openRequest),
      parse: parser.json("^open"),
    });

    fid = openResponse.fid;
    console.log(`[uploadFile] File opened with fid=${fid}`);

    // 2) WRITE chunks sequentially
    const chunkSize = 256; // Reduced chunk size
    let offset = 0;

    while (offset < data.length) {
      if (opts?.signal?.aborted) throw new Error("Aborted");

      const size = Math.min(chunkSize, data.length - offset);
      const chunk = data.slice(offset, offset + size);

      console.log(
        `[uploadFile] Writing chunk: source offset=${offset}, write addr=${writtenSoFar}, size=${chunk.length}`,
      );

      const writeHeader = {
        write: { fid, addr: writtenSoFar, size: chunk.length }, // Use writtenSoFar, not offset!
      };

      const response = await executeCommand<
        object,
        { addr: number; size: number; err: number }
      >({
        cmdId: SmsCommand.JSON,
        request: writeHeader,
        build: () => builder.jsonPlusBinary(writeHeader, chunk),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parse: (raw: any) => {
          if (!raw || !raw.json || !raw.json["^write"]) {
            console.error(
              "[uploadFile] Invalid raw response for write command:",
              raw,
            );
            throw new Error("Invalid response structure for write command");
          }
          const writeResponse = raw.json["^write"] as {
            fid: number;
            addr: number;
            size: number;
            err: number;
          };
          console.log(`[uploadFile] Write response:`, writeResponse);
          if (writeResponse.err !== 0) {
            console.error(
              `[uploadFile] Deluge error on write: ${writeResponse.err}, fid: ${fid}, addr: ${writtenSoFar}, req size: ${chunk.length}`,
            );
            throw new Error(`Deluge write error: ${writeResponse.err}`);
          }
          // Use actual size written from response
          return writeResponse;
        },
      });

      // Update position based on what was actually written
      writtenSoFar += response.size;
      offset += size; // Move forward in source data

      opts?.onProgress?.(writtenSoFar, data.length);
    }

    console.log(`[uploadFile] All chunks written successfully, closing file`);

    // 3) CLOSE file handle
    await executeCommand<object, object>({
      cmdId: SmsCommand.JSON,
      request: { close: { fid } },
      build: () => builder.jsonOnly({ close: { fid } }),
      parse: parser.expectOk,
    });

    console.log(`[uploadFile] Upload completed successfully for ${path}`);
    return { ok: true };
  } catch (error) {
    console.error(`[uploadFile] Upload failed for ${path}:`, error);

    // Try to close the file if it was opened
    if (fid !== null) {
      try {
        await executeCommand<object, object>({
          cmdId: SmsCommand.JSON,
          request: { close: { fid } },
          build: () => builder.jsonOnly({ close: { fid } }),
          parse: parser.expectOk,
        });
      } catch (closeError) {
        console.error(
          "[uploadFile] Failed to close file after error:",
          closeError,
        );
      }
    }

    // Reset session on certain errors that might indicate corruption
    if (
      error instanceof Error &&
      (error.message.includes("Invalid response") ||
        error.message.includes("Deluge write error") ||
        error.message.includes("timed out"))
    ) {
      console.log("[uploadFile] Resetting session due to error");
      resetSession();
    }

    throw error;
  }
}
