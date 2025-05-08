import { renamePath } from "@/lib/midi";

export interface RenameFileParams {
  oldPath: string;
  newPath: string;
}

/**
 * Rename or move a file or directory on the Deluge device.
 */
export async function renameFile(params: RenameFileParams): Promise<void> {
  await renamePath(params.oldPath, params.newPath);
}
