import { uploadFiles } from "@/lib/midi";

/**
 * Request to write binary data to a file on the Deluge device.
 * @param params.path Destination file path (including filename)
 * @param params.data ArrayBuffer or Uint8Array of file content
 */
export async function writeFile(params: {
  path: string;
  data: Uint8Array | ArrayBuffer;
}): Promise<void> {
  const { path, data } = params;
  // Determine directory and filename
  const lastSlash = path.lastIndexOf("/");
  const dir = lastSlash >= 0 ? path.substring(0, lastSlash) : "/";
  const filename = lastSlash >= 0 ? path.substring(lastSlash + 1) : path;

  // Create a File object for upload
  const blobData = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  const file = new File([blobData], filename, {
    type: "application/octet-stream",
  });

  // Use legacy uploadFiles to write the file
  await uploadFiles([file], dir);
}
