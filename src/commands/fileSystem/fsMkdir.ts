import { createDirectory } from "@/lib/midi";

export interface MakeDirectoryParams {
  path: string;
}

/**
 * Create a directory on the Deluge device.
 */
export async function makeDirectory(
  params: MakeDirectoryParams,
): Promise<void> {
  await createDirectory(params.path);
}
