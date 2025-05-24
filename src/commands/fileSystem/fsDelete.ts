import type { ReqFsDelete } from "./schema";
import { fileTree, expandedPaths, selectedPaths, FileEntry } from "../../state";
import { executeCommand } from "../_shared/executor";
import { builder } from "../_shared/builder";
// import { parser } from "../_shared/parser"; // Unused import removed
import { SmsCommand } from "../_shared/types";
import { listDirectoryComplete } from "./fsList";
import { handleDelugeResponse } from "../../lib/errorHandler";

async function deleteSinglePath(itemPath: string): Promise<void> {
  const deletePayload = { delete: { path: itemPath } };
  await executeCommand<typeof deletePayload, { err?: number }>({
    cmdId: SmsCommand.JSON,
    request: deletePayload,
    build: () => builder.jsonOnly(deletePayload),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parse: (raw: any) => {
      if (!raw || !raw.json) {
        throw new Error(
          "[deleteSinglePath] Invalid raw response: missing json object",
        );
      }
      const responseKey = Object.keys(raw.json)[0];
      if (!responseKey || responseKey !== "^delete") {
        throw new Error(
          `[deleteSinglePath] Invalid raw response: missing or incorrect key '${responseKey}' in json object`,
        );
      }
      const deleteResponse = raw.json[responseKey] as { err: number };

      // Use the new error handler with special success codes for delete
      handleDelugeResponse(
        deleteResponse,
        "delete",
        { path: itemPath },
        [0, 4], // 0 = success, 4 = file not found (which is OK for delete)
      );

      console.log(
        `[deleteSinglePath] Delete command for ${itemPath} resulted in err: ${deleteResponse.err} (0 or 4 is OK here)`,
      );
      return { err: deleteResponse.err };
    },
  });
}

async function getAllDescendantPaths(
  dirPath: string,
  allPaths: { path: string; isDir: boolean }[],
): Promise<void> {
  let entries: FileEntry[] = [];
  try {
    entries = await listDirectoryComplete({ path: dirPath });
  } catch (e) {
    console.warn(
      `Failed to list directory ${dirPath} during recursive delete, assuming no children:`,
      e,
    );
    return;
  }

  for (const entry of entries) {
    const entryPath =
      dirPath === "/" ? `/${entry.name}` : `${dirPath}/${entry.name}`;
    const isDir = (entry.attr & 0x10) !== 0;
    allPaths.push({ path: entryPath, isDir });
    if (isDir) {
      await getAllDescendantPaths(entryPath, allPaths);
    }
  }
}

/**
 * Delete a file or directory on the Deluge device.
 * If deleting a directory, it will attempt to delete all its contents recursively from deepest first.
 */
export async function fsDelete(params: ReqFsDelete): Promise<void> {
  const { path } = params;
  let pathsToDelete: { path: string; isDir: boolean }[] = [];
  const collectedPathsForDeletion: { path: string; isDir: boolean }[] = [];
  let initialPathIsDir = false;

  // Determine if the path is a directory by checking its entry in the parent directory
  const lastSlashIdx = path.lastIndexOf("/");
  const parentPath = lastSlashIdx === 0 ? "/" : path.substring(0, lastSlashIdx);
  const baseName = path.substring(lastSlashIdx + 1);
  try {
    const parentEntries: FileEntry[] = await listDirectoryComplete({
      path: parentPath,
    });
    const entry = parentEntries.find((e) => e.name === baseName);
    if (entry && (entry.attr & 0x10) !== 0) {
      initialPathIsDir = true;
    }
  } catch (e: unknown) {
    console.warn(
      `Failed to list parent directory '${parentPath}' for '${path}'. Assuming file. Error:`,
      e,
    );
  }

  if (initialPathIsDir) {
    await getAllDescendantPaths(path, collectedPathsForDeletion);
  }

  // Always include the original path for deletion
  collectedPathsForDeletion.push({ path, isDir: initialPathIsDir });

  pathsToDelete = collectedPathsForDeletion.sort((a, b) => {
    const depthA = a.path.split("/").length;
    const depthB = b.path.split("/").length;
    if (depthA !== depthB) {
      return depthB - depthA;
    }
    return (a.isDir ? 1 : 0) - (b.isDir ? 1 : 0);
  });

  for (const item of pathsToDelete) {
    try {
      await deleteSinglePath(item.path);
    } catch (e) {
      console.error(
        `Failed to delete item ${item.path} during recursive operation:`,
        e,
      );
      throw new Error(
        `Failed to delete ${item.path} as part of deleting ${path}. Error: ${(e as Error).message}`,
      );
    }
  }

  const lastSlash = path.lastIndexOf("/");
  const parent = lastSlash === 0 ? "/" : path.substring(0, lastSlash);

  const filtered = (fileTree.value[parent] || []).filter(
    (entry) => entry.name !== path.substring(lastSlash + 1),
  );
  fileTree.value = { ...fileTree.value, [parent]: filtered };

  const newTree = { ...fileTree.value };
  if (initialPathIsDir) {
    delete newTree[path];
    for (const key in newTree) {
      if (key.startsWith(`${path}/`)) {
        delete newTree[key];
      }
    }
  }
  fileTree.value = newTree;

  expandedPaths.value = new Set(
    [...expandedPaths.value].filter(
      (p) => p !== path && !p.startsWith(`${path}/`),
    ),
  );

  selectedPaths.value = new Set(
    [...selectedPaths.value].filter(
      (p) => p !== path && !p.startsWith(`${path}/`),
    ),
  );
}
