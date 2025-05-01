import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import {
  fileTree,
  expandedPaths,
  midiOut,
  FileEntry,
  selectedPaths,
  fileTransferInProgress,
  editingPath,
} from "../state";
import {
  listDirectory,
  testSysExConnectivity,
  checkFirmwareSupport,
  uploadFiles,
  movePath,
  renamePath,
} from "../lib/midi";
import { iconUrlForEntry } from "../lib/fileIcons";
import { isExternalFileDrag, isInternalDrag } from "../lib/drag";
import FileContextMenu from "./FileContextMenu";

// Track last selected path for shift-clicking
let lastSelectedPath: string | null = null;

/**
 * Checks if an entry is a directory based on its attribute flags
 * @param entry FileEntry to check
 * @returns true if the entry is a directory
 */
function isDirectory(entry: FileEntry): boolean {
  return (entry.attr & 0x10) !== 0;
}

/**
 * Sort file entries with directories first, then alphabetically
 * @param entries Array of FileEntry objects to sort
 * @returns Sorted array with directories first, then files (both alphabetically)
 */
function sortEntriesDirectoriesFirst(entries: FileEntry[]): FileEntry[] {
  return [...entries].sort((a, b) => {
    const aIsDir = isDirectory(a);
    const bIsDir = isDirectory(b);

    // If types are different, directories come first
    if (aIsDir !== bIsDir) {
      return aIsDir ? -1 : 1;
    }

    // If both are the same type, sort alphabetically by name
    return a.name.localeCompare(b.name);
  });
}

/**
 * Get a flat list of all visible file paths in current view
 * Used for range selection with shift key
 */
function getVisibleFilePaths(): string[] {
  const paths: string[] = [];

  // Helper function to recursively get all visible files
  const addFiles = (parentPath: string, entries: FileEntry[]) => {
    if (!entries) return;

    // Sort entries to ensure consistent order
    const sortedEntries = sortEntriesDirectoriesFirst(entries);

    for (const entry of sortedEntries) {
      const path =
        parentPath === "/" ? `/${entry.name}` : `${parentPath}/${entry.name}`;
      paths.push(path);

      // If directory is expanded, add its children
      if (
        isDirectory(entry) &&
        expandedPaths.value.has(path) &&
        fileTree.value[path]
      ) {
        addFiles(path, fileTree.value[path]);
      }
    }
  };

  // Start with root
  if (fileTree.value["/"] && fileTree.value["/"].length > 0) {
    addFiles("/", fileTree.value["/"]);
  }

  return paths;
}

/**
 * Select all files in range between two paths
 */
function selectRange(startPath: string, endPath: string) {
  const visiblePaths = getVisibleFilePaths();
  const startIndex = visiblePaths.indexOf(startPath);
  const endIndex = visiblePaths.indexOf(endPath);

  if (startIndex === -1 || endIndex === -1) return;

  const newSelection = new Set(selectedPaths.value);

  // Get range between start and end (works regardless of which one is first/last)
  const min = Math.min(startIndex, endIndex);
  const max = Math.max(startIndex, endIndex);

  // Add all paths in range to selection
  for (let i = min; i <= max; i++) {
    newSelection.add(visiblePaths[i]);
  }

  selectedPaths.value = newSelection;
}

/**
 * Recursively renders a directory and its contents
 */
function DirectoryItem({
  path,
  entry,
  level = 0,
  debugMode,
}: {
  path: string;
  entry: FileEntry;
  level?: number;
  debugMode: boolean;
}) {
  const childPath = path === "/" ? `/${entry.name}` : `${path}/${entry.name}`;
  const isExpanded = expandedPaths.value.has(childPath);
  const isLoading = useSignal(false);
  const isSelected = selectedPaths.value.has(childPath);
  const itemError = useSignal<string | null>(null);
  const isDragOver = useSignal(false);
  const isContainerDragOver = useSignal(false);
  const contextMenuPosition = useSignal<{ x: number; y: number } | null>(null);
  const isEditing = editingPath.value === childPath;
  const nameInputRef = useSignal<HTMLInputElement | null>(null);
  const inputValue = useSignal(entry.name);
  const isProcessingRename = useSignal(false);

  // Set up input focus when editing starts
  useEffect(() => {
    if (isEditing && nameInputRef.value) {
      nameInputRef.value.focus();
      nameInputRef.value.select();
    }
  }, [isEditing, entry.name]);

  const toggleExpand = async (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation(); // Prevent selection when toggling
    console.log(`Toggle expand for ${childPath}, current state: ${isExpanded}`);

    if (!isExpanded) {
      // Expanding - check if we need to load content
      if (!fileTree.value[childPath]) {
        isLoading.value = true;
        itemError.value = null;
        console.log(`Loading directory contents for ${childPath}...`);
        try {
          const entries = await listDirectory(childPath);
          console.log(
            `Successfully loaded ${entries?.length || 0} entries for ${childPath}`,
          );

          // Force a UI update if the fileTree was updated but UI didn't refresh
          const dirContents = fileTree.value[childPath] as
            | FileEntry[]
            | undefined;
          if (dirContents && dirContents.length > 0) {
            console.log(`Directory ${childPath} content loaded successfully`);
          } else {
            console.warn(
              `Directory ${childPath} loaded but no entries found in fileTree`,
            );
            // Manually update fileTree in case signal update didn't propagate
            if (entries && entries.length > 0) {
              console.log("Manually updating fileTree with entries");
              fileTree.value = { ...fileTree.value, [childPath]: entries };
            }
          }
        } catch (err) {
          console.error(`Failed to load directory ${childPath}:`, err);
          itemError.value = `Failed to load ${childPath}: ${err instanceof Error ? err.message : String(err)}`;
        } finally {
          isLoading.value = false;
        }
      } else {
        const dirContents = fileTree.value[childPath] as
          | FileEntry[]
          | undefined;
        console.log(
          `Using cached directory listing for ${childPath}, ${dirContents?.length || 0} entries`,
        );
      }

      // Add to expanded paths
      console.log(`Marking ${childPath} as expanded`);
      const newExpanded = new Set(expandedPaths.value);
      newExpanded.add(childPath);
      expandedPaths.value = newExpanded;

      // Force re-render by creating a new Set object
      setTimeout(() => {
        console.log(
          `Re-checking expanded state for ${childPath}: ${expandedPaths.value.has(childPath)}`,
        );
        // If for some reason the UI didn't update, force it
        if (
          !document.querySelector(
            `[data-path="${childPath}"][data-expanded="true"]`,
          )
        ) {
          console.log("UI didn't update, forcing refresh");
          expandedPaths.value = new Set(expandedPaths.value);
        }
      }, 50);
    } else {
      // Collapsing - remove from expanded paths
      console.log(`Collapsing ${childPath}`);
      itemError.value = null;
      const newExpanded = new Set(expandedPaths.value);
      newExpanded.delete(childPath);
      expandedPaths.value = newExpanded;
    }
  };

  const handleSelect = (e: MouseEvent) => {
    if (e.shiftKey && lastSelectedPath) {
      // Shift key: range selection
      selectRange(lastSelectedPath, childPath);
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd key: toggle selection
      const newSelection = new Set(selectedPaths.value);
      if (newSelection.has(childPath)) {
        newSelection.delete(childPath);
      } else {
        newSelection.add(childPath);
        lastSelectedPath = childPath;
      }
      selectedPaths.value = newSelection;
    } else {
      // Regular click: single selection
      selectedPaths.value = new Set([childPath]);
      lastSelectedPath = childPath;
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      if (e.ctrlKey || e.metaKey) {
        // Toggle selection with Ctrl/Cmd+Enter
        const newSelection = new Set(selectedPaths.value);
        if (newSelection.has(childPath)) {
          newSelection.delete(childPath);
        } else {
          newSelection.add(childPath);
        }
        selectedPaths.value = newSelection;
      } else {
        // Regular Enter expands/collapses
        toggleExpand(e);
      }
    } else if (e.key === "F2") {
      // F2 key starts editing
      e.preventDefault();
      startEdit(e);
    } else if (e.key === " ") {
      // Spacebar selects
      e.preventDefault(); // Prevent scrolling with spacebar
      handleSelect(e as unknown as MouseEvent);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Critical to prevent the sidebar from capturing this event

    // Only show drop indicator for files being dragged, not text selection
    if (isExternalFileDrag(e) || isInternalDrag(e)) {
      // Apply the visual indicator to show this is a valid drop target
      isContainerDragOver.value = true;
      console.log(`Drag over directory: ${childPath}`);

      // Ensure the root container's drag indicator doesn't show
      const sidebarContainer = document.querySelector(".file-browser-sidebar");
      if (sidebarContainer) {
        e.stopPropagation(); // Make extra sure event doesn't bubble up
      }
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only consider it a "leave" if we're leaving the element or entering a child
    // that isn't part of this element's content
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      isContainerDragOver.value = false;
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isContainerDragOver.value = false;
    isDragOver.value = false;

    // Create a visual feedback that the drop was received
    const element = e.currentTarget as HTMLElement;
    element.classList.add("bg-green-100", "dark:bg-green-900/30");
    setTimeout(() => {
      element.classList.remove("bg-green-100", "dark:bg-green-900/30");
    }, 500);

    console.log(`Files dropped onto directory: ${childPath}`);

    // Handle external file upload first
    if (e.dataTransfer?.files.length) {
      const files = e.dataTransfer.files;
      console.log(`Uploading ${files.length} files to directory: ${childPath}`);

      uploadFiles(Array.from(e.dataTransfer.files), childPath)
        .then(() => {
          console.log(`Upload complete, refreshing directory ${childPath}`);
          // Refresh the directory contents to show the new file
          return listDirectory(childPath);
        })
        .then(() => {
          console.log(`Directory ${childPath} refreshed successfully`);
          // Force a UI update - this is crucial to ensure the UI shows the new files
          fileTree.value = { ...fileTree.value };
        })
        .catch((err) => {
          console.error("Failed to upload files:", err);
          alert(`Upload failed: ${err.message || "Unknown error"}`);
        });
      return;
    }

    // Handle internal move (Deluge file system path)
    const sourcePath = e.dataTransfer?.getData("application/deluge-path");
    if (sourcePath && sourcePath !== childPath) {
      // Prevent dropping into self or descendant
      if (childPath.startsWith(sourcePath + "/")) {
        console.error("Cannot move a folder into itself or its descendants");
        return;
      }

      const sourceFilename = sourcePath.substring(
        sourcePath.lastIndexOf("/") + 1,
      );
      const targetPath =
        childPath === "/"
          ? `/${sourceFilename}`
          : `${childPath}/${sourceFilename}`;

      console.log(`Moving file from ${sourcePath} to ${targetPath}`);

      // Use direct reference to movePath instead of dynamic import
      movePath(sourcePath, targetPath)
        .then(() => {
          console.log(`Move complete, refreshing directory ${childPath}`);
          // Refresh the directory contents after move
          return listDirectory(childPath);
        })
        .then(() => {
          // Also refresh the source directory if different
          if (sourcePath.lastIndexOf("/") !== childPath.lastIndexOf("/")) {
            const sourceDir =
              sourcePath.substring(0, sourcePath.lastIndexOf("/")) || "/";
            console.log(`Refreshing source directory ${sourceDir}`);
            return listDirectory(sourceDir);
          }
        })
        .then(() => {
          // Force a UI update
          fileTree.value = { ...fileTree.value };
        })
        .catch((err) => {
          console.error("Failed to move file:", err);
          alert(`Move failed: ${err.message || "Unknown error"}`);
        });
    }
  };

  // For the inner row div, we need to update the drag state on the parent li
  const handleRowDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isExternalFileDrag(e) || isInternalDrag(e)) {
      isDragOver.value = true;
    }
  };

  const handleRowDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      isDragOver.value = false;
    }
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop event bubbling

    // Check if we have multiple selected items AND this item is already selected
    const hasMultipleSelected = selectedPaths.value.size > 1;
    const isItemSelected = selectedPaths.value.has(childPath);

    // When right-clicking a file that's part of a multi-selection, keep the selection
    if (hasMultipleSelected && isItemSelected) {
      // Do nothing, keep current selection
      console.log("Right clicked on multi-selected item, preserving selection");
    }
    // When no modifier keys are pressed on single selection or non-selected item
    else if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
      selectedPaths.value = new Set([childPath]);
      lastSelectedPath = childPath;
    }
    // Handle Ctrl/Cmd+click behavior to add to selection
    else if (!isItemSelected) {
      // Add this item to selection if it's not already selected (with modifier keys)
      const newSelection = new Set(selectedPaths.value);
      newSelection.add(childPath);
      selectedPaths.value = newSelection;
      lastSelectedPath = childPath;
    }

    contextMenuPosition.value = { x: e.pageX, y: e.pageY };
  };

  const startEdit = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation(); // Don't trigger toggle expand
    // Don't allow editing if file transfer is in progress
    if (fileTransferInProgress.value || !midiOut.value) return;

    editingPath.value = childPath;
    inputValue.value = entry.name;
  };

  const cancelEdit = () => {
    editingPath.value = null;
  };

  const commitRename = async () => {
    // Prevent duplicate calls
    if (isProcessingRename.value) return;
    isProcessingRename.value = true;

    if (inputValue.value.trim() === "") {
      cancelEdit();
      isProcessingRename.value = false;
      return;
    }

    // Don't allow special characters
    if (/[\/\\:*?"<>|]/.test(inputValue.value.trim())) {
      alert(
        'The name cannot contain the following characters: \\ / : * ? " < > |',
      );
      cancelEdit();
      isProcessingRename.value = false;
      return;
    }

    if (inputValue.value.trim() === entry.name) {
      // No change, just cancel
      cancelEdit();
      isProcessingRename.value = false;
      return;
    }

    // Construct the old and new paths
    const dirPath = path;
    const oldPath = childPath;
    const newPath =
      dirPath === "/"
        ? `/${inputValue.value.trim()}`
        : `${dirPath}/${inputValue.value.trim()}`;

    try {
      cancelEdit(); // Cancel editing BEFORE the API call to prevent any blur events from firing
      await renamePath(oldPath, newPath);
    } catch (error) {
      console.error("Failed to rename:", error);
      alert(
        `Rename failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      isProcessingRename.value = false;
    }
  };

  const handleEditKeyDown = (e: KeyboardEvent) => {
    // Always stop propagation to prevent global shortcuts, but don't prevent default for all keys
    e.stopPropagation();

    if (e.key === "Enter") {
      // For Enter key, prevent default to avoid form submission
      e.preventDefault();

      // Don't process if already handling a rename
      if (isProcessingRename.value) return;
      isProcessingRename.value = true;

      // Validation checks
      if (inputValue.value.trim() === "") {
        cancelEdit();
        isProcessingRename.value = false;
        return;
      }

      if (/[\/\\:*?"<>|]/.test(inputValue.value.trim())) {
        alert(
          'The name cannot contain the following characters: \\ / : * ? " < > |',
        );
        cancelEdit();
        isProcessingRename.value = false;
        return;
      }

      if (inputValue.value.trim() === entry.name) {
        // No change, just cancel
        cancelEdit();
        isProcessingRename.value = false;
        return;
      }

      // Construct paths
      const dirPath = path;
      const oldPath = childPath;
      const newPath =
        dirPath === "/"
          ? `/${inputValue.value.trim()}`
          : `${dirPath}/${inputValue.value.trim()}`;

      // Cancel editing first to prevent blurring from triggering another rename
      cancelEdit();

      // Now do the rename
      renamePath(oldPath, newPath)
        .catch((error) => {
          console.error("Rename failed:", error);
          alert(
            `Rename failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        })
        .finally(() => {
          // Reset processing flag after operation completes
          isProcessingRename.value = false;
        });
    } else if (e.key === "Escape") {
      // For Escape key, prevent default to avoid browser behavior
      e.preventDefault();
      cancelEdit();
    }
    // For all other keys, allow default behavior (typing in the input)
  };

  return (
    <>
      <li
        className={`${
          isContainerDragOver.value
            ? "drop-target bg-green-50 dark:bg-green-900/20 border-2 border-dashed border-green-500 dark:border-green-600 rounded shadow-sm"
            : ""
        }`}
        data-path={childPath}
        data-expanded={isExpanded}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className={`flex items-center py-1 px-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer select-none ${
            isSelected
              ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
              : ""
          } ${isExpanded ? "font-medium" : ""} ${
            isDragOver.value
              ? "bg-green-100 dark:bg-green-900/40 border-2 border-dashed border-green-500 dark:border-green-600 rounded shadow-sm"
              : ""
          }`}
          onClick={handleSelect}
          onDblClick={toggleExpand}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onDragOver={handleRowDragOver}
          onDragLeave={handleRowDragLeave}
          onContextMenu={handleContextMenu}
        >
          <div
            className="w-4 h-4 mr-1 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(e);
            }}
          >
            {isExpanded ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="text-blue-500 cursor-pointer"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="text-gray-500 cursor-pointer"
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <span className="mr-1">
            <img
              src={iconUrlForEntry(entry)}
              alt=""
              className="w-4 h-4 inline-block align-middle"
              style={{ marginTop: "-2px" }}
            />
          </span>
          <span className="ml-1 truncate" title={entry.name}>
            {isEditing ? (
              <input
                type="text"
                className="flex-grow bg-white dark:bg-neutral-800 border border-blue-400 px-1 py-0.5 outline-none"
                value={inputValue.value}
                onInput={(e) =>
                  (inputValue.value = (e.target as HTMLInputElement).value)
                }
                onKeyDown={handleEditKeyDown}
                onBlur={commitRename}
                ref={(el) => {
                  nameInputRef.value = el;
                }}
                aria-label="Rename folder"
                onClick={(e) => e.stopPropagation()} // Prevent folder selection when clicking
              />
            ) : (
              <span onDblClick={startEdit}>{entry.name}</span>
            )}
          </span>
          {debugMode && (
            <span className="ml-2 text-xs text-gray-500">
              {isExpanded ? "📂" : "📁"}
            </span>
          )}
        </div>

        {isExpanded && (
          <ul className="ml-4">
            {isLoading.value ? (
              <li className="py-1 px-2 text-gray-500">Loading...</li>
            ) : itemError.value ? (
              <li className="py-1 px-2 text-red-500 text-xs">
                {itemError.value}
              </li>
            ) : fileTree.value[childPath]?.length ? (
              sortEntriesDirectoriesFirst(fileTree.value[childPath]).map(
                (childEntry) =>
                  isDirectory(childEntry) ? (
                    <DirectoryItem
                      key={childEntry.name}
                      path={childPath}
                      entry={childEntry}
                      level={level + 1}
                      debugMode={debugMode}
                    />
                  ) : (
                    <FileItem
                      key={childEntry.name}
                      path={childPath}
                      entry={childEntry}
                    />
                  ),
              )
            ) : (
              <li className="py-1 px-2 text-gray-500 text-xs">Empty folder</li>
            )}
          </ul>
        )}
      </li>

      {contextMenuPosition.value && (
        <FileContextMenu
          path={path}
          entry={entry}
          position={contextMenuPosition.value}
          isDirectory={true}
          onClose={() => (contextMenuPosition.value = null)}
          selectedEntries={
            Array.from(selectedPaths.value)
              .map((selPath) => {
                const dirPath =
                  selPath.substring(0, selPath.lastIndexOf("/")) || "/";
                const name = selPath.substring(selPath.lastIndexOf("/") + 1);
                const selEntry = fileTree.value[dirPath]?.find(
                  (e) => e.name === name,
                );
                return selEntry ? { path: dirPath, entry: selEntry } : null;
              })
              .filter(Boolean) as { path: string; entry: FileEntry }[]
          }
        />
      )}
    </>
  );
}

/**
 * Renders a file item in the tree
 */
function FileItem({ path, entry }: { path: string; entry: FileEntry }) {
  const childPath = path === "/" ? `/${entry.name}` : `${path}/${entry.name}`;
  const isSelected = selectedPaths.value.has(childPath);
  const isDragOver = useSignal(false);
  const contextMenuPosition = useSignal<{ x: number; y: number } | null>(null);
  const isEditing = editingPath.value === childPath;
  const nameInputRef = useSignal<HTMLInputElement | null>(null);
  const inputValue = useSignal(entry.name);
  const isProcessingRename = useSignal(false);

  // Set up input focus when editing starts
  useEffect(() => {
    if (isEditing && nameInputRef.value) {
      nameInputRef.value.focus();
      // Select everything except the extension if there is one
      const lastDotIndex = entry.name.lastIndexOf(".");
      if (lastDotIndex > 0) {
        nameInputRef.value.setSelectionRange(0, lastDotIndex);
      } else {
        nameInputRef.value.select();
      }
    }
  }, [isEditing, entry.name]);

  const handleSelect = (e: MouseEvent) => {
    if (e.shiftKey && lastSelectedPath) {
      // Shift key: range selection
      selectRange(lastSelectedPath, childPath);
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd key: toggle selection
      const newSelection = new Set(selectedPaths.value);
      if (newSelection.has(childPath)) {
        newSelection.delete(childPath);
      } else {
        newSelection.add(childPath);
        lastSelectedPath = childPath;
      }
      selectedPaths.value = newSelection;
    } else {
      // Regular click: single selection
      selectedPaths.value = new Set([childPath]);
      lastSelectedPath = childPath;
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault(); // Prevent scrolling with spacebar
      handleSelect(e as unknown as MouseEvent);
    } else if (e.key === "F2") {
      // F2 key starts editing
      e.preventDefault();
      startEdit();
    }
  };

  const handleDragStart = (e: DragEvent) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData("application/deluge-path", childPath);
      e.dataTransfer.setData("text/plain", entry.name);
      e.dataTransfer.effectAllowed = "move";
    }
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop event bubbling

    // Check if we have multiple selected items AND this item is already selected
    const hasMultipleSelected = selectedPaths.value.size > 1;
    const isItemSelected = selectedPaths.value.has(childPath);

    // When right-clicking a file that's part of a multi-selection, keep the selection
    if (hasMultipleSelected && isItemSelected) {
      // Do nothing, keep current selection
      console.log("Right clicked on multi-selected file, preserving selection");
    }
    // When no modifier keys are pressed on single selection or non-selected item
    else if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
      selectedPaths.value = new Set([childPath]);
      lastSelectedPath = childPath;
    }
    // Handle Ctrl/Cmd+click behavior to add to selection
    else if (!isItemSelected) {
      // Add this item to selection if it's not already selected (with modifier keys)
      const newSelection = new Set(selectedPaths.value);
      newSelection.add(childPath);
      selectedPaths.value = newSelection;
      lastSelectedPath = childPath;
    }

    contextMenuPosition.value = { x: e.pageX, y: e.pageY };
  };

  const startEdit = () => {
    // Don't allow editing if file transfer is in progress
    if (fileTransferInProgress.value || !midiOut.value) return;

    editingPath.value = childPath;
    inputValue.value = entry.name;
  };

  const cancelEdit = () => {
    editingPath.value = null;
  };

  const commitRename = async () => {
    // Prevent duplicate calls
    if (isProcessingRename.value) return;
    isProcessingRename.value = true;

    if (inputValue.value.trim() === "") {
      cancelEdit();
      isProcessingRename.value = false;
      return;
    }

    // Don't allow special characters
    if (/[\/\\:*?"<>|]/.test(inputValue.value.trim())) {
      alert(
        'The name cannot contain the following characters: \\ / : * ? " < > |',
      );
      cancelEdit();
      isProcessingRename.value = false;
      return;
    }

    if (inputValue.value.trim() === entry.name) {
      // No change, just cancel
      cancelEdit();
      isProcessingRename.value = false;
      return;
    }

    // Construct the old and new paths
    const dirPath = path;
    const oldPath = childPath;
    const newPath =
      dirPath === "/"
        ? `/${inputValue.value.trim()}`
        : `${dirPath}/${inputValue.value.trim()}`;

    try {
      cancelEdit(); // Cancel editing BEFORE the API call to prevent any blur events from firing
      await renamePath(oldPath, newPath);
    } catch (error) {
      console.error("Failed to rename:", error);
      alert(
        `Rename failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      isProcessingRename.value = false;
    }
  };

  const handleEditKeyDown = (e: KeyboardEvent) => {
    // Always stop propagation to prevent global shortcuts, but don't prevent default for all keys
    e.stopPropagation();

    if (e.key === "Enter") {
      // For Enter key, prevent default to avoid form submission
      e.preventDefault();

      // Don't process if already handling a rename
      if (isProcessingRename.value) return;
      isProcessingRename.value = true;

      // Validation checks
      if (inputValue.value.trim() === "") {
        cancelEdit();
        isProcessingRename.value = false;
        return;
      }

      if (/[\/\\:*?"<>|]/.test(inputValue.value.trim())) {
        alert(
          'The name cannot contain the following characters: \\ / : * ? " < > |',
        );
        cancelEdit();
        isProcessingRename.value = false;
        return;
      }

      if (inputValue.value.trim() === entry.name) {
        // No change, just cancel
        cancelEdit();
        isProcessingRename.value = false;
        return;
      }

      // Construct paths
      const dirPath = path;
      const oldPath = childPath;
      const newPath =
        dirPath === "/"
          ? `/${inputValue.value.trim()}`
          : `${dirPath}/${inputValue.value.trim()}`;

      // Cancel editing first to prevent blurring from triggering another rename
      cancelEdit();

      // Now do the rename
      renamePath(oldPath, newPath)
        .catch((error) => {
          console.error("Rename failed:", error);
          alert(
            `Rename failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        })
        .finally(() => {
          // Reset processing flag after operation completes
          isProcessingRename.value = false;
        });
    } else if (e.key === "Escape") {
      // For Escape key, prevent default to avoid browser behavior
      e.preventDefault();
      cancelEdit();
    }
    // For all other keys, allow default behavior (typing in the input)
  };

  return (
    <li
      className={`py-0.5 px-2 border-b border-neutral-100 dark:border-neutral-800 flex items-center cursor-pointer select-none relative ${
        isSelected ? "bg-blue-100 dark:bg-blue-900" : ""
      } ${
        isDragOver.value ? "bg-blue-50 dark:bg-blue-950 border-blue-200" : ""
      }`}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      data-path={childPath}
      tabIndex={0}
      draggable={true}
      onDragStart={handleDragStart}
      role="treeitem"
      aria-selected={isSelected}
    >
      <span className="mr-1">
        <img
          src={iconUrlForEntry(entry)}
          alt=""
          className="w-4 h-4 inline-block align-middle"
          style={{ marginTop: "-2px" }}
        />
      </span>

      {isEditing ? (
        <input
          type="text"
          className="w-full bg-white dark:bg-neutral-800 border border-blue-400 px-1 py-0.5 outline-none"
          value={inputValue.value}
          onInput={(e) =>
            (inputValue.value = (e.target as HTMLInputElement).value)
          }
          onKeyDown={handleEditKeyDown}
          onBlur={commitRename}
          ref={(el) => {
            nameInputRef.value = el;
          }}
          aria-label="Rename file"
        />
      ) : (
        <span onDblClick={startEdit}>{entry.name}</span>
      )}

      {contextMenuPosition.value && (
        <FileContextMenu
          path={path}
          entry={entry}
          position={contextMenuPosition.value}
          isDirectory={false}
          onClose={() => {
            contextMenuPosition.value = null;
          }}
        />
      )}
    </li>
  );
}

/**
 * Root tree component for browsing files on the Deluge SD card
 */
export default function FileBrowserTree() {
  const rootPath = "/";
  const isLoading = useSignal(false);
  const error = useSignal<string | null>(null);
  const debugMode = useSignal(
    localStorage.getItem("dex-file-debug") === "true",
  );
  const contextMenuPosition = useSignal<{ x: number; y: number } | null>(null);
  const showFileManagementToolbar = useSignal(false);
  const showNewFolderModal = useSignal(false);
  const showNewFileModal = useSignal(false);

  const toggleDebugMode = () => {
    debugMode.value = !debugMode.value;
    localStorage.setItem("dex-file-debug", debugMode.value ? "true" : "false");
    console.log("Debug mode:", debugMode.value);
    console.log("expandedPaths:", Array.from(expandedPaths.value));
    console.log("fileTree paths:", Object.keys(fileTree.value));
  };

  // Load root directory on first mount
  useEffect(() => {
    if (!fileTree.value[rootPath] && midiOut.value !== null) {
      isLoading.value = true;
      error.value = null;
      console.log("Initial mount - loading root directory...");

      // Test sequence: ping -> version check -> directory listing
      testSysExConnectivity()
        .then(() => {
          console.log("Basic SysEx connectivity OK");
          return checkFirmwareSupport();
        })
        .then(() => {
          console.log("Device responded to version request");
          return listDirectory(rootPath);
        })
        .then((entries) => {
          console.log(`Root directory loaded with ${entries.length} entries`);
        })
        .catch((err) => {
          console.error("Failed to load root directory:", err);
          error.value = err.message || "Failed to communicate with Deluge";
        })
        .finally(() => {
          isLoading.value = false;
        });
    } else if (fileTree.value[rootPath]) {
      console.log("Root directory already loaded");
    }
  }, []);

  const handleRootContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop event bubbling

    // If clicking on empty space (not a file or folder), clear selection
    const target = e.target as HTMLElement;
    if (!target.closest("[data-path]")) {
      selectedPaths.value = new Set();
    }

    contextMenuPosition.value = { x: e.clientX, y: e.clientY };
  };

  // Handle new folder button click
  const handleNewFolderClick = () => {
    showNewFolderModal.value = true;
  };

  // Handle new file button click
  const handleNewFileClick = () => {
    showNewFileModal.value = true;
  };

  return (
    <div className="h-full flex flex-col" onContextMenu={handleRootContextMenu}>
      <div className="p-2 flex items-center justify-between bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center">
          <button
            onClick={toggleDebugMode}
            className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 mr-2"
            title="Toggle Debug Mode"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path
                fillRule="evenodd"
                d="M4.25 2A2.25 2.25 0 002 4.25v11.5A2.25 2.25 0 004.25 18h11.5A2.25 2.25 0 0018 16.75V4.25A2.25 2.25 0 0015.75 2H4.25zM6 13.25V3.5h8v9.75a.75.75 0 01-1.5 0V6.25a.75.75 0 00-.75-.75h-5.5a.75.75 0 01-.75-.75z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <button
            onClick={() =>
              (showFileManagementToolbar.value =
                !showFileManagementToolbar.value)
            }
            className={`p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 ${showFileManagementToolbar.value ? "bg-blue-100 dark:bg-blue-900/30" : ""}`}
            title="Show File Management Tools"
            aria-pressed={showFileManagementToolbar.value}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M2 4.5A2.5 2.5 0 014.5 2h11a2.5 2.5 0 010 5h-11A2.5 2.5 0 012 4.5zM2.75 9.083a.75.75 0 000 1.5h14.5a.75.75 0 000-1.5H2.75zM2.75 12.663a.75.75 0 000 1.5h14.5a.75.75 0 000-1.5H2.75zM2.75 16.25a.75.75 0 000 1.5h14.5a.75.75 0 100-1.5H2.75z" />
            </svg>
          </button>
        </div>
      </div>

      {showFileManagementToolbar.value && (
        <div className="px-2 py-1 flex items-center space-x-1 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 overflow-x-auto">
          <button
            className="p-1 rounded text-xs flex items-center hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="New Folder"
            onClick={handleNewFolderClick}
            disabled={fileTransferInProgress.value || !midiOut.value}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 mr-1"
            >
              <path
                fillRule="evenodd"
                d="M3.75 3A1.75 1.75 0 002 4.75v10.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-8.5A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75zM10 8a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 0110 8z"
                clipRule="evenodd"
              />
            </svg>
            New Folder
          </button>

          <button
            className="p-1 rounded text-xs flex items-center hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="New File"
            onClick={handleNewFileClick}
            disabled={fileTransferInProgress.value || !midiOut.value}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 mr-1"
            >
              <path
                fillRule="evenodd"
                d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm4.75 6.75a.75.75 0 011.5 0v2.546l.943-1.048a.75.75 0 111.114 1.004l-2.25 2.5a.75.75 0 01-1.114 0l-2.25-2.5a.75.75 0 111.114-1.004l.943 1.048V8.75z"
                clipRule="evenodd"
              />
            </svg>
            New File
          </button>

          <div className="h-4 border-l border-neutral-300 dark:border-neutral-600"></div>

          <button
            className="p-1 rounded text-xs flex items-center hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Rename"
            onClick={() => {
              if (selectedPaths.value.size !== 1) return;

              const selectedPath = Array.from(selectedPaths.value)[0];
              // Set editing path to trigger inline editor
              editingPath.value = selectedPath;
            }}
            disabled={
              fileTransferInProgress.value ||
              !midiOut.value ||
              selectedPaths.value.size !== 1
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 mr-1"
            >
              <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
              <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
            </svg>
            Rename
          </button>

          <button
            className="p-1 rounded text-xs flex items-center text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete"
            onClick={() => {
              if (selectedPaths.value.size < 1) return;

              // Get all selected entries
              const selectedEntries = Array.from(selectedPaths.value)
                .map((selPath) => {
                  const dirPath =
                    selPath.substring(0, selPath.lastIndexOf("/")) || "/";
                  const name = selPath.substring(selPath.lastIndexOf("/") + 1);
                  const selEntry = fileTree.value[dirPath]?.find(
                    (e) => e.name === name,
                  );
                  return selEntry ? { path: dirPath, entry: selEntry } : null;
                })
                .filter(Boolean) as { path: string; entry: FileEntry }[];

              if (selectedEntries.length > 0) {
                // Show delete confirmation modal with the centered position
                contextMenuPosition.value = {
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                };
              }
            }}
            disabled={
              fileTransferInProgress.value ||
              !midiOut.value ||
              selectedPaths.value.size < 1
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 mr-1"
            >
              <path
                fillRule="evenodd"
                d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                clipRule="evenodd"
              />
            </svg>
            {selectedPaths.value.size > 1
              ? `Delete (${selectedPaths.value.size})`
              : "Delete"}
          </button>
        </div>
      )}

      <div className="flex-grow overflow-y-auto">
        {isLoading.value ? (
          <div className="p-4 text-center">
            <span className="inline-block animate-spin mr-2">⏳</span>
            Loading files...
          </div>
        ) : error.value ? (
          <div className="p-4 text-red-500 text-center">
            <p className="mb-2">❌ {error.value}</p>
            <p className="text-sm text-neutral-500">
              Make sure your Deluge is connected and in USB MIDI mode
            </p>
          </div>
        ) : fileTree.value[rootPath]?.length ? (
          <ul className="p-2">
            {sortEntriesDirectoriesFirst(fileTree.value[rootPath]).map(
              (entry) =>
                isDirectory(entry) ? (
                  <DirectoryItem
                    key={entry.name}
                    path={rootPath}
                    entry={entry}
                    level={0}
                    debugMode={debugMode.value}
                  />
                ) : (
                  <FileItem key={entry.name} path={rootPath} entry={entry} />
                ),
            )}
          </ul>
        ) : (
          <div className="p-4 text-center text-neutral-500">
            No files found on SD card
          </div>
        )}
      </div>

      {/* Root-level context menu */}
      {contextMenuPosition.value && (
        <FileContextMenu
          path={rootPath}
          position={contextMenuPosition.value}
          isDirectory={true}
          onClose={() => (contextMenuPosition.value = null)}
          selectedEntries={
            Array.from(selectedPaths.value)
              .map((selPath) => {
                const dirPath =
                  selPath.substring(0, selPath.lastIndexOf("/")) || "/";
                const name = selPath.substring(selPath.lastIndexOf("/") + 1);
                const selEntry = fileTree.value[dirPath]?.find(
                  (e) => e.name === name,
                );
                return selEntry ? { path: dirPath, entry: selEntry } : null;
              })
              .filter(Boolean) as { path: string; entry: FileEntry }[]
          }
        />
      )}

      {showNewFolderModal.value && (
        <FileContextMenu
          path={rootPath}
          position={{ x: 0, y: 0 }}
          isDirectory={true}
          onClose={() => (showNewFolderModal.value = false)}
        />
      )}

      {showNewFileModal.value && (
        <FileContextMenu
          path={rootPath}
          position={{ x: 0, y: 0 }}
          isDirectory={true}
          onClose={() => (showNewFileModal.value = false)}
        />
      )}
    </div>
  );
}
