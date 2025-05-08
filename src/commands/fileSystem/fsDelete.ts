import { deletePath } from "@/lib/midi";

export interface DeleteFileParams {
  path: string;
}

/**
 * Delete a file or directory on the Deluge device.
 */
export async function deleteFile(params: DeleteFileParams): Promise<void> {
  await deletePath(params.path);
}
