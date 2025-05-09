import { uploadFiles as legacyUploadFiles } from "@/lib/midi";

/**
 * Parameters for uploading files.
 */
export interface UploadFilesParams {
  files: File[];
  destDir: string;
  maxConcurrent?: number;
}

/**
 * Upload file(s) to the Deluge device.
 * @param params Files, destination directory, and optional max concurrency.
 */
export async function uploadFiles(params: UploadFilesParams): Promise<void> {
  const { files, destDir, maxConcurrent } = params;
  await legacyUploadFiles(files, destDir, maxConcurrent);
}
