import { useEffect, useRef, useState } from "preact/hooks";
import { useSignal, signal } from "@preact/signals";
import {
  FileEntry,
  editingPath,
  previewFile,
  editingFileState,
  fileTree,
} from "../state";
import {
  makeDirectory,
  writeFile,
  fsDelete,
  listDirectoryComplete,
} from "@/commands";
import { isAudio, isText } from "../lib/fileType";

interface FileContextMenuPosition {
  x: number;
  y: number;
  directAction?: "delete";
}

interface FileContextMenuProps {
  path: string;
  entry?: FileEntry;
  position: FileContextMenuPosition | null;
  isDirectory: boolean;
  onClose: () => void;
  selectedEntries?: { path: string; entry: FileEntry }[];
}

// Helper to determine directory flag (same logic as FileBrowserTree)
function getEntryIsDirectory(entry: FileEntry): boolean {
  return (entry.attr & 0x10) !== 0;
}

// Signals that hold the expanded list of paths to be deleted and its loading state (module-scoped, non-hook)
const pathsToDeleteList = signal<string[]>([]);
const isBuildingList = signal(false);

// Build the list of all items that will be removed (expands directories recursively)
async function buildPathsToDelete(
  entriesToProcess: { path: string; entry: FileEntry }[] | null,
) {
  isBuildingList.value = true;
  const collected: string[] = [];

  async function addRecursive(parentPath: string, currentEntry: FileEntry) {
    const fullPath =
      parentPath === "/"
        ? `/${currentEntry.name}`
        : `${parentPath}/${currentEntry.name}`;
    collected.push(fullPath);

    if (getEntryIsDirectory(currentEntry)) {
      let children: FileEntry[] | undefined = fileTree.peek()[fullPath];
      if (!children) {
        try {
          children = await listDirectoryComplete({ path: fullPath });
        } catch {
          children = undefined;
        }
      }
      if (children) {
        for (const child of children) {
          await addRecursive(fullPath, child);
        }
      }
    }
  }

  if (entriesToProcess && entriesToProcess.length) {
    for (const item of entriesToProcess) {
      await addRecursive(item.path, item.entry);
    }
  }

  pathsToDeleteList.value = collected;
  isBuildingList.value = false;
}

export default function FileContextMenu({
  path,
  entry,
  position,
  isDirectory,
  onClose,
  selectedEntries = [],
}: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const deleteModalRef = useRef<HTMLDivElement>(null);
  const newFolderModalRef = useRef<HTMLDivElement>(null);
  const newFileModalRef = useRef<HTMLDivElement>(null);

  const showDeleteModal = useSignal(false);
  const showNewFolderModal = useSignal(false);
  const showNewFileModal = useSignal(false);
  const newName = useSignal("");
  const [menuPosition, setMenuPosition] = useState(
    position ? { x: position.x, y: position.y } : { x: 0, y: 0 },
  );

  useEffect(() => {
    if (position) {
      setMenuPosition({ x: position.x, y: position.y });
    }
  }, [position]);

  // Effect to handle direct delete action
  useEffect(() => {
    if (position?.directAction === "delete") {
      if (selectedEntries.length > 0) {
        buildPathsToDelete(selectedEntries).finally(() => {
          showDeleteModal.value = true;
        });
      } else if (entry) {
        buildPathsToDelete([{ path, entry }]).finally(() => {
          showDeleteModal.value = true;
        });
      } else {
        onClose();
      }
    }
  }, [position, selectedEntries, entry, path, onClose]);

  // Event handlers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      // Check if click is inside any of our components
      const isInsideMenu = menuRef.current && menuRef.current.contains(target);
      const isInsideDeleteModal =
        deleteModalRef.current && deleteModalRef.current.contains(target);
      const isInsideNewFolderModal =
        newFolderModalRef.current && newFolderModalRef.current.contains(target);
      const isInsideNewFileModal =
        newFileModalRef.current && newFileModalRef.current.contains(target);

      // Only close if click is outside all components
      if (
        !isInsideMenu &&
        !isInsideDeleteModal &&
        !isInsideNewFolderModal &&
        !isInsideNewFileModal
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Action handlers
  const handleDelete = async () => {
    const pathsToDelete =
      selectedEntries.length > 0
        ? selectedEntries.map((s) =>
            s.path === "/" ? `/${s.entry.name}` : `${s.path}/${s.entry.name}`,
          )
        : entry
          ? [path === "/" ? `/${entry.name}` : `${path}/${entry.name}`]
          : [];
    if (pathsToDelete.length === 0) return;

    try {
      for (const p of pathsToDelete) {
        await fsDelete({ path: p });
      }
      fileTree.value = { ...fileTree.value };
      // No specific refresh here, fsDelete itself updates fileTree
      // Consider if a broad refresh is needed for parent dir if multiple items are deleted from different places.
    } catch (error) {
      console.error("Delete failed:", error);
      alert(
        `Delete failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    onClose();
  };

  const handleCreateFolder = async () => {
    if (newName.value.trim() === "") {
      return;
    }

    // Don't allow special characters
    if (/[\/\\:*?"<>|]/.test(newName.value)) {
      alert(
        'The name cannot contain the following characters: \\ / : * ? " < > |',
      );
      return;
    }

    // Explicit parentPath determination
    let determinedParentPath: string;
    if (entry && isDirectory) {
      // Clicked on a directory entry, new item goes inside it.
      // `path` prop is parent of `entry`. Full path of `entry` is `path/entry.name` or `/entry.name`.
      determinedParentPath =
        path === "/" ? `/${entry.name}` : `${path}/${entry.name}`;
    } else if (entry && !isDirectory) {
      // Clicked on a file entry, new item goes beside it (in its parent).
      // `path` prop is already the parent directory of the file.
      determinedParentPath = path;
    } else {
      // No specific entry (e.g., root context menu), or isDirectory is true but no entry (should be root context).
      // `path` prop is the target directory (e.g., "/").
      determinedParentPath = path;
    }

    const newDirPath =
      determinedParentPath === "/"
        ? `/${newName.value}`
        : `${determinedParentPath}/${newName.value}`;

    try {
      await makeDirectory({ path: newDirPath });
      const updatedEntries = await listDirectoryComplete({
        path: determinedParentPath,
      });
      fileTree.value = {
        ...fileTree.value,
        [determinedParentPath]: updatedEntries,
      };
      onClose();
    } catch (error) {
      console.error("Failed to create directory:", error);
      alert(
        `Create folder failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleCreateFile = async () => {
    if (newName.value.trim() === "") {
      return;
    }

    // Don't allow special characters
    if (/[\/\\:*?"<>|]/.test(newName.value)) {
      alert(
        'The name cannot contain the following characters: \\ / : * ? " < > |',
      );
      return;
    }

    // Explicit parentPath determination (same logic as for folder)
    let determinedParentPath: string;
    if (entry && isDirectory) {
      determinedParentPath =
        path === "/" ? `/${entry.name}` : `${path}/${entry.name}`;
    } else if (entry && !isDirectory) {
      determinedParentPath = path;
    } else {
      determinedParentPath = path;
    }

    const newFilePath =
      determinedParentPath === "/"
        ? `/${newName.value}`
        : `${determinedParentPath}/${newName.value}`;

    try {
      await writeFile({ path: newFilePath, data: new Uint8Array(0) });
      const updatedEntries = await listDirectoryComplete({
        path: determinedParentPath,
      });
      fileTree.value = {
        ...fileTree.value,
        [determinedParentPath]: updatedEntries,
      };
      onClose();
    } catch (error) {
      console.error("Failed to create file:", error);
      alert(
        `Create file failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  // Handle preview file
  const handlePreview = () => {
    if (!entry) return;

    const fullPath = path === "/" ? `/${entry.name}` : `${path}/${entry.name}`;

    console.log("Preview requested for:", fullPath);

    if (isAudio(entry)) {
      console.log("Setting audio preview for:", fullPath);
      previewFile.value = { path: fullPath, type: "audio" };
    } else if (isText(entry)) {
      console.log("Setting text preview for:", fullPath);
      previewFile.value = { path: fullPath, type: "text" };
    }

    onClose();
  };

  // Handle edit text file
  const handleEditTextFile = () => {
    if (!entry) return;

    const fullPath = path === "/" ? `/${entry.name}` : `${path}/${entry.name}`;

    console.log("Edit requested for text file:", fullPath);

    // Initialize editor state with path
    editingFileState.value = {
      path: fullPath,
      initialContent: "", // Will be populated when component loads
      currentContent: "",
      dirty: false,
    };

    onClose();
  };

  // Check if the file can be previewed
  const canPreview = entry && !isDirectory && isAudio(entry);

  // Check if the file can be edited
  const canEdit = entry && !isDirectory && isText(entry);

  return (
    <>
      {!(position?.directAction === "delete") && (
        <div
          ref={menuRef}
          className="fixed bg-white dark:bg-neutral-800 shadow-md rounded-md z-50 border border-neutral-200 dark:border-neutral-700"
          style={{
            left: `${menuPosition.x}px`,
            top: `${menuPosition.y}px`,
            minWidth: "180px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ul className="py-1 text-sm w-full">
            {isDirectory && (
              <>
                <li>
                  <button
                    className="px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 w-full text-left"
                    onClick={() => {
                      newName.value = "";
                      showNewFolderModal.value = true;
                    }}
                  >
                    <span className="inline-block w-5 text-center mr-2">
                      📁
                    </span>
                    New Folder
                  </button>
                </li>
                <li>
                  <button
                    className="px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 w-full text-left"
                    onClick={() => {
                      newName.value = "";
                      showNewFileModal.value = true;
                    }}
                  >
                    <span className="inline-block w-5 text-center mr-2">
                      📄
                    </span>
                    New File
                  </button>
                </li>
                <li>
                  <hr className="my-1 border-neutral-200 dark:border-neutral-700" />
                </li>
              </>
            )}

            {canPreview && (
              <li>
                <button
                  className="px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 w-full text-left"
                  onClick={handlePreview}
                >
                  <span className="inline-block w-5 text-center mr-2">👁️</span>
                  Preview Audio
                </button>
              </li>
            )}

            {canEdit && (
              <li>
                <button
                  className="px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 w-full text-left"
                  onClick={handleEditTextFile}
                >
                  <span className="inline-block w-5 text-center mr-2">📝</span>
                  Edit Text
                </button>
              </li>
            )}

            {(entry || selectedEntries.length === 1) && (
              <li>
                <button
                  data-testid="rename-button"
                  className="px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 w-full text-left"
                  onClick={() => {
                    if (entry) {
                      const fullPath =
                        path === "/"
                          ? `/${entry.name}`
                          : `${path}/${entry.name}`;
                      onClose();
                      setTimeout(() => {
                        editingPath.value = fullPath;
                      }, 10);
                    } else if (selectedEntries.length === 1) {
                      const { path: entryPath, entry: entryItem } =
                        selectedEntries[0];
                      const fullPath =
                        entryPath === "/"
                          ? `/${entryItem.name}`
                          : `${entryPath}/${entryItem.name}`;
                      onClose();
                      setTimeout(() => {
                        editingPath.value = fullPath;
                      }, 10);
                    }
                  }}
                >
                  <span className="inline-block w-5 text-center mr-2">✏️</span>
                  Rename
                </button>
              </li>
            )}
            {(entry || selectedEntries.length > 0) && (
              <li>
                <button
                  data-testid="delete-button"
                  className="px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 w-full text-left text-red-600 dark:text-red-400"
                  onClick={() => {
                    let itemsForDeletion:
                      | { path: string; entry: FileEntry }[]
                      | null = null;
                    if (selectedEntries.length > 0) {
                      itemsForDeletion = selectedEntries;
                    } else if (entry) {
                      itemsForDeletion = [{ path, entry }];
                    }
                    buildPathsToDelete(itemsForDeletion).finally(() => {
                      showDeleteModal.value = true;
                    });
                  }}
                >
                  <span className="inline-block w-5 text-center mr-2">🗑️</span>
                  <span className="ml-1">
                    {selectedEntries.length > 1
                      ? `Delete (${selectedEntries.length} items)`
                      : "Delete"}
                  </span>
                </button>
              </li>
            )}
          </ul>
        </div>
      )}

      {showDeleteModal.value && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            ref={deleteModalRef}
            className="bg-white dark:bg-neutral-800 p-4 rounded-lg shadow-lg max-w-md w-full"
            data-testid="delete-confirmation-dialog"
          >
            <h3 className="text-lg font-medium mb-3">Confirm Delete</h3>
            {isBuildingList.value ? (
              <div className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
                Building list of items…
              </div>
            ) : pathsToDeleteList.value.length > 0 ? (
              <div className="mb-4">
                <p className="mb-2">
                  Delete {pathsToDeleteList.value.length} items? This cannot be
                  undone.
                </p>
                <div
                  className="max-h-32 overflow-y-auto text-sm text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 rounded p-2"
                  data-testid="delete-confirmation-dialog-message"
                >
                  {pathsToDeleteList.value.map((fullPath, index) => {
                    const relative = fullPath.slice(1);
                    const depth = relative.split("/").length - 1;
                    return (
                      <div
                        key={index}
                        className="truncate"
                        style={{ paddingLeft: `${depth * 12}px` }}
                      >
                        • {relative}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : entry ? (
              <p className="mb-4">
                Delete '{entry.name}'? This cannot be undone.
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  showDeleteModal.value = false;
                  onClose();
                }}
              >
                Cancel
              </button>
              <button
                data-testid="confirm-delete-button"
                className="px-4 py-2 bg-red-500 text-white rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewFolderModal.value && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            ref={newFolderModalRef}
            className="bg-white dark:bg-neutral-800 p-4 rounded-lg shadow-lg max-w-md w-full"
          >
            <h3 className="text-lg font-medium mb-3">Create New Folder</h3>
            <input
              type="text"
              value={newName.value}
              onInput={(e) =>
                (newName.value = (e.target as HTMLInputElement).value)
              }
              className="w-full p-2 border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-700 rounded mb-4"
              placeholder="Enter folder name"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  showNewFolderModal.value = false;
                  onClose();
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateFolder();
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewFileModal.value && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            ref={newFileModalRef}
            className="bg-white dark:bg-neutral-800 p-4 rounded-lg shadow-lg max-w-md w-full"
          >
            <h3 className="text-lg font-medium mb-3">Create New File</h3>
            <input
              type="text"
              value={newName.value}
              onInput={(e) =>
                (newName.value = (e.target as HTMLInputElement).value)
              }
              className="w-full p-2 border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-700 rounded mb-4"
              placeholder="Enter file name"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  showNewFileModal.value = false;
                  onClose();
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateFile();
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
