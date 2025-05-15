import type { ReqDeleteFile } from "./schema";
import { sendJson, ensureSession } from "../../lib/smsysex";
import { fileTree, expandedPaths, selectedPaths } from "../../state";

/**
 * Delete a file or directory on the Deluge device.
 */
export async function fsDelete(params: ReqDeleteFile): Promise<void> {
  const { path } = params;
  // Ensure MIDI session is open before sending command
  await ensureSession();
  // Send delete request via JSON transport
  const jsonRes: Record<string, unknown> = await sendJson({ delete: { path } });
  // Extract the response containing err code
  const deleteKey = Object.keys(jsonRes).find((key) => {
    const val = jsonRes[key];
    if (val == null || typeof val !== "object") return false;
    const errVal = (val as { err?: unknown }).err;
    return typeof errVal === "number";
  });
  if (!deleteKey) {
    throw new Error("Failed to delete: Unknown response");
  }
  const responseObj = jsonRes[deleteKey] as { err?: unknown };
  const err = typeof responseObj.err === "number" ? responseObj.err : NaN;
  if (err !== 0) {
    throw new Error(`Failed to delete: Error ${err}`);
  }
  // Update UI state after successful deletion
  // Determine parent directory path
  const lastSlash = path.lastIndexOf("/");
  const parent = lastSlash === 0 ? "/" : path.substring(0, lastSlash);
  // Remove entry from parent directory listing
  const filtered = (fileTree.value[parent] || []).filter(
    (entry) => entry.name !== path.substring(lastSlash + 1),
  );
  fileTree.value = { ...fileTree.value, [parent]: filtered };
  // If deleting a directory, remove its subtree and expanded path
  if (fileTree.value[path]) {
    const newTree = { ...fileTree.value };
    delete newTree[path];
    fileTree.value = newTree;
    expandedPaths.value = new Set(
      [...expandedPaths.value].filter((p) => p !== path),
    );
  }
  // Remove deleted paths from selection
  selectedPaths.value = new Set(
    [...selectedPaths.value].filter(
      (p) => p !== path && !p.startsWith(`${path}/`),
    ),
  );
}
