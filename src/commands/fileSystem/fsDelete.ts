import type { ReqFsDelete } from "./schema";
import { fileTree, expandedPaths, selectedPaths } from "../../state";
import { executeCommand } from "../_shared/executor";
import { builder } from "../_shared/builder";
import { parser } from "../_shared/parser";
import { SmsCommand } from "../_shared/types";

/**
 * Delete a file or directory on the Deluge device.
 */
export async function fsDelete(params: ReqFsDelete): Promise<void> {
  const { path } = params;

  // ensureSession() is called by transport.sendSysex which is called by executeCommand
  // No need to call ensureSession() directly here.

  await executeCommand<ReqFsDelete, Record<string, unknown>>({
    cmdId: SmsCommand.JSON,
    request: params,
    build: () => builder.jsonOnly({ delete: { path } }),
    // parser.expectOk will throw an error if err !== 0 or response is malformed.
    // The actual content of the successful response isn't used beyond this check.
    parse: parser.expectOk,
  });

  // Update UI state after successful deletion
  // Determine parent directory path
  const lastSlash = path.lastIndexOf("/");
  const parent = lastSlash === 0 ? "/" : path.substring(0, lastSlash);

  // Remove entry from parent directory listing
  const filtered = (fileTree.value[parent] || []).filter(
    (entry) => entry.name !== path.substring(lastSlash + 1),
  );
  fileTree.value = { ...fileTree.value, [parent]: filtered };

  // If deleting a directory, remove its key from fileTree and its path from expandedPaths
  // Also, perform a deep delete from fileTree for all sub-paths
  if (fileTree.value[path]) {
    // Check if the path itself was a directory entry in fileTree
    const newTree = { ...fileTree.value };
    delete newTree[path]; // Remove the directory's own listing from the tree

    // Deep delete: remove all keys that start with the deleted path + "/"
    for (const key in newTree) {
      if (key.startsWith(`${path}/`)) {
        delete newTree[key];
      }
    }
    fileTree.value = newTree;

    expandedPaths.value = new Set(
      [...expandedPaths.value].filter(
        (p) => p !== path && !p.startsWith(`${path}/`),
      ), // also remove children from expandedPaths
    );
  } else {
    // Ensure expandedPaths is cleaned up even if path wasn't a directory in fileTree (e.g. deleting a file within an expanded path)
    // This part might be redundant if path is always a file or an existing dir key, but good for robustness.
    expandedPaths.value = new Set(
      [...expandedPaths.value].filter(
        (p) => p !== path && !p.startsWith(`${path}/`),
      ),
    );
  }

  // Remove deleted paths (the path itself and any children if it was a directory) from selection
  selectedPaths.value = new Set(
    [...selectedPaths.value].filter(
      (p) => p !== path && !p.startsWith(`${path}/`),
    ),
  );
}
