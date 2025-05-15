import { useEffect, useRef, useState } from "preact/hooks";
import { useSignal, signal } from "@preact/signals";
import {
  FileEntry,
  editingPath,
  previewFile,
  editingFileState,
  fileTree,
} from "../state";
import { makeDirectory, writeFile, fsDelete, listDirectory } from "@/commands";
import { isAudio, isText } from "../lib/fileType";

interface FileContextMenuProps {
  path: string;
  entry?: FileEntry;
  position: { x: number; y: number };
  isDirectory: boolean;
  onClose: () => void;
  selectedEntries?: { path: string; entry: FileEntry }[];
}

// Helper to determine directory flag (same logic as FileBrowserTree)
function isDirectory(entry: FileEntry): boolean {
  return (entry.attr & 0x10) !== 0;
}

// Signals that hold the expanded list of paths to be deleted and its loading state (module-scoped, non-hook)
const pathsToDeleteList = signal<string[]>([]);
const isBuildingList = signal(false);

// Build the list of all items that will be removed (expands directories recursively)
async function buildPathsToDelete(
  entries: { path: string; entry: FileEntry }[] | null,
  singleEntryCtx: { path: string; entry: FileEntry } | null,
) {
  isBuildingList.value = true;
  const collected: string[] = [];

  async function addRecursive(parentPath: string, entry: FileEntry) {
    const fullPath =
      parentPath === "/" ? `/${entry.name}` : `${parentPath}/${entry.name}`;
    collected.push(fullPath);

    if (isDirectory(entry)) {
      // Ensure we have children; fetch if missing
      let children: FileEntry[] | undefined = fileTree.value[fullPath];
      if (!children) {
        try {
          children = await listDirectory({ path: fullPath });
        } catch {
          // ignore errors – deletion may still succeed even if we can't list
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

  if (entries && entries.length) {
    for (const item of entries) {
      await addRecursive(item.path, item.entry);
    }
  } else if (singleEntryCtx) {
    await addRecursive(singleEntryCtx.path, singleEntryCtx.entry);
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
  const [menuPosition, setMenuPosition] = useState(position);

  // Calculate safe position to ensure menu appears within viewport
  useEffect(() => {
    if (!menuRef.current) return;

    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Don't adjust the X position for normal right-clicks
    // Only adjust if it would go off-screen
    let safeX = position.x;
    let safeY = position.y;

    // Handle horizontal positioning - only if it would go off-screen
    if (position.x + menuRect.width > viewportWidth) {
      safeX = Math.max(0, viewportWidth - menuRect.width);
    }

    // Handle vertical positioning - only if it would go off-screen
    if (position.y + menuRect.height > viewportHeight) {
      safeY = Math.max(0, viewportHeight - menuRect.height);
    }

    setMenuPosition({ x: safeX, y: safeY });
  }, [position]);

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

    const confirmMessage =
      pathsToDelete.length > 1
        ? `Are you sure you want to delete ${pathsToDelete.length} items?`
        : `Are you sure you want to delete '${pathsToDelete[0].substring(pathsToDelete[0].lastIndexOf("/") + 1)}'?`;

    if (window.confirm(confirmMessage)) {
      try {
        for (const p of pathsToDelete) {
          await fsDelete({ path: p });
        }
        // No specific refresh here, fsDelete itself updates fileTree
        // Consider if a broad refresh is needed for parent dir if multiple items are deleted from different places.
      } catch (error) {
        console.error("Delete failed:", error);
        alert(
          `Delete failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
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

    const parentPath =
      isDirectory && entry
        ? path === "/"
          ? `/${entry.name}`
          : `${path}/${entry.name}`
        : path;

    const newDirPath =
      parentPath === "/"
        ? `/${newName.value}`
        : `${parentPath}/${newName.value}`;

    try {
      await makeDirectory({ path: newDirPath });
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

    const parentPath =
      isDirectory && entry
        ? path === "/"
          ? `/${entry.name}`
          : `${path}/${entry.name}`
        : path;

    const newFilePath =
      parentPath === "/"
        ? `/${newName.value}`
        : `${parentPath}/${newName.value}`;

    try {
      await writeFile({ path: newFilePath, data: new Uint8Array(0) });
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
      <div
        ref={menuRef}
        className="fixed bg-white dark:bg-neutral-800 shadow-md rounded-md z-50 border border-neutral-200 dark:border-neutral-700"
        style={{
          left: `${menuPosition.x}px`,
          top: `${menuPosition.y}px`,
          minWidth: "180px", // Fixed minimum width to prevent narrowing
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
                  <span className="inline-block w-5 text-center mr-2">📁</span>
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
                  <span className="inline-block w-5 text-center mr-2">📄</span>
                  New File
                </button>
              </li>
              <li>
                <hr className="my-1 border-neutral-200 dark:border-neutral-700" />
              </li>
            </>
          )}

          {/* Preview option for audio files only */}
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

          {/* Edit option for text files */}
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

          {/* Show rename only for single selection */}
          {(entry || selectedEntries.length === 1) && (
            <li>
              <button
                className="px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 w-full text-left"
                onClick={() => {
                  // Use inline editing by directly setting editingPath signal
                  if (entry) {
                    // For direct entry case
                    const fullPath =
                      path === "/" ? `/${entry.name}` : `${path}/${entry.name}`;
                    // Close the context menu first
                    onClose();
                    // Set the editing path directly
                    setTimeout(() => {
                      editingPath.value = fullPath;
                    }, 10);
                  } else if (selectedEntries.length === 1) {
                    // Similar approach for selected entries
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
          {/* Show delete for both single and multiple selections */}
          {(entry || selectedEntries.length > 0) && (
            <li>
              <button
                className="px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 w-full text-left text-red-600 dark:text-red-400"
                onClick={() => {
                  // Pre-compute list of items that will be deleted, then open modal
                  buildPathsToDelete(
                    selectedEntries.length > 0 ? selectedEntries : null,
                    entry ? { path, entry } : null,
                  ).finally(() => {
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

      {/* Delete Confirmation Modal - Modified for multiple selections */}
      {showDeleteModal.value && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            ref={deleteModalRef}
            className="bg-white dark:bg-neutral-800 p-4 rounded-lg shadow-lg max-w-md w-full"
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
                <div className="max-h-32 overflow-y-auto text-sm text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 rounded p-2">
                  {pathsToDeleteList.value.map((fullPath, index) => {
                    const relative = fullPath.slice(1); // remove leading slash for display
                    const depth = relative.split("/").length - 1; // root-level = 0
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

      {/* New Folder Modal */}
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

      {/* New File Modal */}
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
