import { uploadFile } from "./fileSystem/uploadFile/uploadFile";
import { validateFilename } from "@/lib/filenameValidator";

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
  forceSanitize?: boolean;
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
    forceSanitize = false,
  } = params;

  // Validate all filenames first
  const validationResults = files.map((file) => ({
    file,
    validation: validateFilename(file.name),
  }));

  // Check for errors
  const errors = validationResults.filter((r) => !r.validation.isValid);
  if (errors.length > 0 && !forceSanitize) {
    const errorMessages = errors
      .map((e) => `${e.file.name}: ${e.validation.errors.join(", ")}`)
      .join("\n");
    throw new Error(`Invalid filenames:\n${errorMessages}`);
  }

  // Log warnings
  validationResults.forEach(({ file, validation }) => {
    if (validation.warnings.length > 0) {
      console.warn(
        `Filename warnings for "${file.name}":`,
        validation.warnings.join(", "),
      );
    }
    if (validation.sanitized !== file.name) {
      console.warn(
        `Filename sanitized: "${file.name}" → "${validation.sanitized}"`,
      );
    }
  });

  let queue: Array<Promise<unknown>> = [];

  for (let i = 0; i < validationResults.length; i++) {
    const { file, validation } = validationResults[i];
    const data = await toUint8Array(file);
    const safeName = forceSanitize ? validation.sanitized : file.name;
    const path = destDir.endsWith("/")
      ? `${destDir}${safeName}`
      : `${destDir}/${safeName}`;

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
