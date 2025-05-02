import { useEffect, useRef, useState } from "preact/hooks";
import { useSignal } from "@preact/signals";
import {
  FileEntry,
  editingPath,
  previewFile,
  editingFileState,
} from "../state";
import { createDirectory, createFile, deletePath } from "../lib/midi";
import { isAudio, isText } from "../lib/fileType";

interface FileContextMenuProps {
  path: string;
  entry?: FileEntry;
  position: { x: number; y: number };
  isDirectory: boolean;
  onClose: () => void;
  selectedEntries?: { path: string; entry: FileEntry }[];
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
    // Handle multiple selection case
    if (selectedEntries.length > 0) {
      console.log(`Deleting ${selectedEntries.length} items:`, selectedEntries);

      // Extract all the file paths that need to be deleted
      const pathsToDelete = selectedEntries.map(
        ({ path: entryPath, entry: entryItem }) => {
          return entryPath === "/"
            ? `/${entryItem.name}`
            : `${entryPath}/${entryItem.name}`;
        },
      );

      console.log(`Preparing to delete paths:`, pathsToDelete);

      // Create a queue of deletion operations to process sequentially
      // This helps ensure reliable deletion even with multiple files
      try {
        console.log(`Starting deletion of ${pathsToDelete.length} files...`);

        // Process deletions one by one to avoid race conditions
        for (const pathToDelete of pathsToDelete) {
          console.log(`Deleting: ${pathToDelete}`);
          await deletePath(pathToDelete);
          console.log(`Successfully deleted: ${pathToDelete}`);
        }

        console.log("All files deleted successfully");
        onClose();
      } catch (error) {
        console.error("Failed to delete multiple items:", error);
        alert(
          `Delete failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return;
    }

    // Handle single selection case
    if (!entry) return;

    const fullPath = path === "/" ? `/${entry.name}` : `${path}/${entry.name}`;
    console.log(`Deleting single file: ${fullPath}`);

    try {
      await deletePath(fullPath);
      console.log("Single file deleted successfully");
      onClose();
    } catch (error) {
      console.error("Failed to delete:", error);
      alert(
        `Delete failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
      await createDirectory(newDirPath);
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
      await createFile(newFilePath, "");
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
                  showDeleteModal.value = true;
                }}
              >
                <span className="inline-block w-5 text-center mr-2">🗑️</span>
                Delete{" "}
                {selectedEntries.length > 1
                  ? `(${selectedEntries.length} items)`
                  : ""}
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
            {selectedEntries.length > 0 ? (
              <div className="mb-4">
                <p className="mb-2">
                  Delete {selectedEntries.length} items? This cannot be undone.
                </p>
                <div className="max-h-32 overflow-y-auto text-sm text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 rounded p-2">
                  {selectedEntries.map(({ entry }, index) => (
                    <div key={index} className="truncate">
                      • {entry.name}
                    </div>
                  ))}
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
