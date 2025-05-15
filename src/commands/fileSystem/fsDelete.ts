import type { ReqFsDelete } from "./schema";
import { fileTree, expandedPaths, selectedPaths, FileEntry } from "../../state";
import { executeCommand } from "../_shared/executor";
import { builder } from "../_shared/builder";
import { parser } from "../_shared/parser";
import { SmsCommand } from "../_shared/types";
import { listDirectory } from "./fsList";

async function deleteSinglePath(itemPath: string): Promise<void> {
  await executeCommand<ReqFsDelete, Record<string, unknown>>({
    cmdId: SmsCommand.JSON,
    request: { path: itemPath },
    build: () => builder.jsonOnly({ delete: { path: itemPath } }),
    parse: parser.expectOk,
  });
}

async function getAllDescendantPaths(
  dirPath: string,
  allPaths: { path: string; isDir: boolean }[],
): Promise<void> {
  let entries: FileEntry[] = [];
  try {
    entries = await listDirectory({ path: dirPath });
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

  try {
    await listDirectory({ path: path });
    initialPathIsDir = true;
  } catch (e: unknown) {
    initialPathIsDir = false;
    console.warn(
      `Attempt to list '${path}' before delete failed. Assuming it's a file or non-listable entity. Error:`,
      e,
    );
  }

  if (initialPathIsDir) {
    await getAllDescendantPaths(path, collectedPathsForDeletion);
  }

  collectedPathsForDeletion.push({ path: path, isDir: initialPathIsDir });

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
