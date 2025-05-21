import { uploadFile } from "./fileSystem/uploadFile/uploadFile";

/**
 * Parameters for uploading files.
 */
export interface UploadFilesParams {
  files: File[];
  destDir: string;
  maxConcurrent?: number;
  onProgress?: (index: number, sent: number, total: number) => void;
  signal?: AbortSignal;
  overwrite?: boolean;
}

// Helper to read File/Blob as Uint8Array, with fallback for environments without blob.arrayBuffer
async function toUint8Array(file: File): Promise<Uint8Array> {
  // Modern Blob API
  if (typeof file.arrayBuffer === "function") {
    const buf = await file.arrayBuffer();
    return new Uint8Array(buf);
  }
  // Fallback to text encoding if available (e.g., JSDOM Blob)
  if (typeof file.text === "function") {
    const txt = await file.text();
    return new TextEncoder().encode(txt);
  }
  // Final fallback via Response (Node fetch)
  if (typeof Response === "function") {
    const buf2 = await new Response(file).arrayBuffer();
    return new Uint8Array(buf2);
  }
  throw new Error("Unable to read file data");
}

/**
 * Upload multiple files with optional concurrency and progress callback.
 */
export async function uploadFiles(params: UploadFilesParams): Promise<void> {
  const {
    files,
    destDir,
    maxConcurrent = 1,
    onProgress,
    signal,
    overwrite,
  } = params;
  let queue: Array<Promise<unknown>> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const data = await toUint8Array(file);
    const path = destDir.endsWith("/")
      ? `${destDir}${file.name}`
      : `${destDir}/${file.name}`;

    const task = uploadFile(
      { path, data, overwrite: overwrite },
      {
        signal,
        onProgress: (sent, total) => onProgress?.(i, sent, total),
      },
    );

    queue.push(task);
    if (queue.length >= maxConcurrent) {
      // Wait for the first task to finish, then remove it from queue
      const finished = await Promise.race(queue.map((p) => p.then(() => p)));
      queue = queue.filter((p) => p !== finished);
    }
  }

  // Await any remaining tasks
  await Promise.all(queue);
}
