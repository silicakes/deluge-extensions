import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { Signal } from "@preact/signals";
import {
  fileTree,
  expandedPaths,
  midiOut,
  FileEntry,
  selectedPaths,
  fileTransferInProgress,
  fileTransferProgress,
  editingPath,
  previewFile,
  editingFileState,
  // fileUploadConflictState, // Conceptually, import a global state for the conflict dialog
} from "../state";
import { testSysExConnectivity, checkFirmwareSupport } from "@/commands";
import {
  listDirectoryComplete,
  renameFile,
  uploadFiles,
  readFile,
  triggerBrowserDownload,
} from "@/commands";
import { iconUrlForEntry } from "../lib/fileIcons";
import { isExternalFileDrag, isInternalDrag } from "../lib/drag";
import { isAudio, isText } from "../lib/fileType";
import FileContextMenu from "./FileContextMenu";
import {
  fileOverrideConfirmationOpen,
  filesToOverride,
  confirmCallback,
} from "./FileOverrideConfirmation"; // Assuming same directory or adjust path
import FileNameIssuesDialog, {
  fileNameIssuesOpen,
  fileValidationResults,
  fileIssuesCallback,
} from "./FileNameIssuesDialog";
import { validateFilename } from "@/lib/filenameValidator";

// Track last selected path for shift-clicking
let lastSelectedPath: string | null = null;

/**
 * Checks if a file entry has corrupted/invalid attributes
 * Common issue: attr 47 (0x2F) indicates volume label + archive which is invalid
 */
function isCorruptedEntry(entry: FileEntry): boolean {
  // Check for invalid attribute combinations
  const ATTR_VOLUME_LABEL = 0x08;
  const ATTR_ARCHIVE = 0x20;

  // Volume label can't have archive bit
  if (entry.attr & ATTR_VOLUME_LABEL && entry.attr & ATTR_ARCHIVE) {
    return true;
  }

  // Additional check: single letter names with attr 47 are known corrupted entries
  if (entry.attr === 47 && entry.name.length === 1) {
    return true;
  }

  return false;
}

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
}: {
  path: string;
  entry: FileEntry;
  level?: number;
}) {
  const childPath = path === "/" ? `/${entry.name}` : `${path}/${entry.name}`;
  const isExpanded = expandedPaths.value.has(childPath);
  const isLoading = useSignal(false);
  const isSelected = selectedPaths.value.has(childPath);
  const itemError = useSignal<string | null>(null);
  const isDragOver = useSignal(false);
  const isContainerDragOver = useSignal(false);
  const contextMenuPosition = useSignal<{
    x: number;
    y: number;
    directAction?: "delete";
  } | null>(null);
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
          const entries = await listDirectoryComplete({ path: childPath });
          fileTree.value = {
            ...fileTree.value,
            [childPath]: entries,
          };
          console.log(`Pulled additional files for ${childPath}`);

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
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      // Ensure the current item is selected if not already part of a multi-selection
      if (!selectedPaths.value.has(childPath)) {
        selectedPaths.value = new Set([childPath]);
      } // If already selected (single or multi), respect existing selection for deletion

      const el = e.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      contextMenuPosition.value = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        directAction: "delete",
      };
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

  const handleDrop = async (e: DragEvent) => {
    console.log(
      `DirectoryItem.handleDrop called for path=${childPath}, dataTransfer types=`,
      e.dataTransfer?.types,
    );
    console.log("Selected paths before drop:", Array.from(selectedPaths.value));
    e.preventDefault();
    e.stopPropagation();
    console.log(
      `After preventDefault/stopPropagation for ${childPath}, isContainerDragOver was:`,
      isContainerDragOver.value,
    );

    isContainerDragOver.value = false;
    console.log(`isContainerDragOver reset for ${childPath} (now false)`);
    // Expand directory on drop so new entries are visible
    const newExpandedOnDrop = new Set(expandedPaths.value);
    newExpandedOnDrop.add(childPath);
    expandedPaths.value = newExpandedOnDrop;

    const element = e.currentTarget as HTMLElement;
    element.classList.add("bg-green-100", "dark:bg-green-900/30");
    setTimeout(() => {
      element.classList.remove("bg-green-100", "dark:bg-green-900/30");
    }, 500);

    console.log(`Files dropped onto directory: ${childPath}`);

    if (e.dataTransfer?.files.length) {
      const allDroppedFiles = Array.from(e.dataTransfer.files);
      console.log(
        "allDroppedFiles:",
        allDroppedFiles.map((f) => f.name),
      );
      // Log planned upload paths for each file
      const uploadPaths = allDroppedFiles.map((f) =>
        childPath.endsWith("/")
          ? `${childPath}${f.name}`
          : `${childPath}/${f.name}`,
      );
      console.log("Planned upload paths:", uploadPaths);

      const existingEntries = fileTree.value[childPath] || [];
      console.log(
        `Existing entries in ${childPath}:`,
        existingEntries.map((e) => e.name),
      );
      const conflictingFiles: File[] = [];
      const nonConflictingFiles: File[] = [];

      // Separate files into conflicting and non-conflicting
      for (const file of allDroppedFiles) {
        const conflict = existingEntries.some(
          (entry) => entry.name.toLowerCase() === file.name.toLowerCase(),
        );
        if (conflict) {
          conflictingFiles.push(file);
        } else {
          nonConflictingFiles.push(file);
        }
      }

      // Define the upload process function
      async function proceedWithUpload(forceSanitize?: boolean) {
        // Keep track of total files for progress updates if uploads are sequential
        const totalFilesToProcess = allDroppedFiles.length;
        console.log(`totalFilesToProcess: ${totalFilesToProcess}`);
        let filesProcessedSoFar = 0;

        const doUpload = async (filesToUpload: File[], overwrite = false) => {
          if (filesToUpload.length === 0) return Promise.resolve();

          console.log(
            `Uploading ${filesToUpload.length} files to directory: ${childPath} (overwrite: ${overwrite})`,
          );
          fileTransferInProgress.value = true;

          try {
            await uploadFiles({
              files: filesToUpload,
              destDir: childPath,
              overwrite: overwrite,
              forceSanitize: forceSanitize,
              onProgress: (index, sent, total) => {
                const currentFile = filesToUpload[index];
                fileTransferProgress.value = {
                  path:
                    childPath === "/"
                      ? `/${currentFile.name}`
                      : `${childPath}/${currentFile.name}`,
                  bytes: sent,
                  total,
                  currentFileIndex: filesProcessedSoFar + index,
                  totalFiles: totalFilesToProcess,
                };
              },
            });
            console.log(
              `Upload batch complete for ${filesToUpload.map((f) => f.name).join(", ")}, refreshing directory ${childPath}`,
            );
            const entries = await listDirectoryComplete({
              path: childPath,
              force: true,
            });
            console.log(
              `doUpload listDirectory returned entries for ${childPath}:`,
              entries.map((e) => e.name),
            );
            fileTree.value = {
              ...fileTree.value,
              [childPath]: entries,
            };
            filesProcessedSoFar += filesToUpload.length;
          } catch (err) {
            console.error("Failed to upload files:", err);
            alert(
              `Upload failed: ${err instanceof Error ? err.message : String(err)}`,
            );
          } finally {
            // Only set to false when ALL operations (potential multiple calls to doUpload) are done
            if (filesProcessedSoFar === totalFilesToProcess) {
              fileTransferInProgress.value = false;
              fileTransferProgress.value = null;
            }
          }
        };

        if (conflictingFiles.length > 0) {
          filesToOverride.value = conflictingFiles.map((f) => f.name);
          confirmCallback.value = async (confirmed) => {
            fileOverrideConfirmationOpen.value = false;
            confirmCallback.value = null;

            if (confirmed) {
              await doUpload(conflictingFiles, true);
              // Only upload non-conflicting if they haven't been implicitly handled
              // or if the overwrite didn't also create them (unlikely for simple overwrite)
              await doUpload(nonConflictingFiles, false);
            } else {
              await doUpload(nonConflictingFiles, false);
            }
          };
          fileOverrideConfirmationOpen.value = true;
        } else {
          await doUpload(allDroppedFiles, false);
        }
      }

      // Validate all filenames
      const validationResults = allDroppedFiles.map((file) => ({
        file,
        validation: validateFilename(file.name),
      }));

      const hasIssues = validationResults.some(
        (r) => !r.validation.isValid || r.validation.warnings.length > 0,
      );

      if (hasIssues) {
        // Show validation dialog
        fileValidationResults.value = validationResults;
        fileIssuesCallback.value = async (proceed, forceSanitize) => {
          fileNameIssuesOpen.value = false;
          fileIssuesCallback.value = null;

          if (!proceed) {
            fileValidationResults.value = [];
            return;
          }

          // Continue with the upload process using forceSanitize if needed
          await proceedWithUpload(forceSanitize);
        };
        fileNameIssuesOpen.value = true;
        return; // Exit and wait for user response
      }

      // If no filename issues, proceed directly
      await proceedWithUpload();
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

      renameFile({ oldPath: sourcePath, newPath: targetPath })
        .then(() => {
          console.log(
            `Move complete, refreshing tree globally from handleDrop`,
          );
          // A more targeted refresh would be better:
          // Refresh sourceParentDir, targetParentDir (childPath)
          // For simplicity, a global refresh or targeted refresh of relevant paths:
          const sourceParentDir =
            sourcePath.substring(0, sourcePath.lastIndexOf("/")) || "/";
          Promise.all([
            listDirectoryComplete({ path: sourceParentDir, force: true }),
            listDirectoryComplete({ path: childPath, force: true }),
          ]).then(([sourceEntries, targetEntries]) => {
            const newFileTree = { ...fileTree.value };
            newFileTree[sourceParentDir] = sourceEntries;
            newFileTree[childPath] = targetEntries;
            // Remove the old source path if it was a directory and is now empty or gone
            // delete newFileTree[sourcePath]; // Be careful with this
            fileTree.value = newFileTree;
          });
        })
        .catch((err) => {
          console.error("Failed to move file:", err);
          alert(
            `Move failed: ${err instanceof Error ? err.message : String(err)}`,
          );
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

    /*
     * If the user right-clicks on an item that is *already* inside the current
     * selection we want to keep that multi-selection intact. If the item is
     * *not* part of the selection we follow desktop-style semantics and make
     * it the sole selected item.
     */
    if (!selectedPaths.value.has(childPath)) {
      selectedPaths.value = new Set([childPath]);
      lastSelectedPath = childPath;
    }

    // Finally, open the context-menu at the cursor position.
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
    if (isProcessingRename.value) return;
    isProcessingRename.value = true;

    const trimmedNewName = inputValue.value.trim();

    if (trimmedNewName === "") {
      cancelEdit();
      isProcessingRename.value = false;
      return;
    }
    if (/[\/\\:*?"<>|]/.test(trimmedNewName)) {
      alert(
        'The name cannot contain the following characters: \\ / : * ? " < > |',
      );
      cancelEdit();
      isProcessingRename.value = false;
      return;
    }
    if (trimmedNewName === entry.name) {
      cancelEdit();
      isProcessingRename.value = false;
      return;
    }

    const oldPath = childPath; // Full path of the item being renamed
    const parentDir = path; // Parent path of the item being renamed
    const newPath =
      parentDir === "/"
        ? `/${trimmedNewName}`
        : `${parentDir}/${trimmedNewName}`;

    try {
      cancelEdit();
      await renameFile({ oldPath, newPath });

      // For files, oldParentPath and newParentPath will be the same unless future move logic is added here.
      // For now, it simplifies to refreshing just one parent directory.
      const parentPathToRefresh = parentDir; // Same as oldParentPath and newParentPath for file rename

      const updatedEntries = await listDirectoryComplete({
        path: parentPathToRefresh,
        force: true,
      });
      const newFileTreeData = {
        ...fileTree.peek(),
        [parentPathToRefresh]: updatedEntries,
      };

      // File items are not keys in fileTree for children, so no key renaming needed for fileTreeData itself.
      // File items are not typically in expandedPaths unless we change that feature.

      if (selectedPaths.value.has(oldPath)) {
        const newSelection = new Set(selectedPaths.value);
        newSelection.delete(oldPath);
        newSelection.add(newPath);
        selectedPaths.value = newSelection;
      }
      // Also update lastSelectedPath if it was the one renamed
      if (lastSelectedPath === oldPath) {
        lastSelectedPath = newPath;
      }

      fileTree.value = newFileTreeData;
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
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename(); // commitRename will use inputValue and component props
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  return (
    <>
      <li
        data-testid={`file-tree-folder-${entry.name}`}
        aria-selected={isSelected}
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
          onDrop={handleDrop}
          onContextMenu={handleContextMenu}
        >
          <div
            className="toggle-icon w-4 h-4 mr-1 flex-shrink-0"
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
          <span className="ml-2 text-xs text-gray-500">
            {isExpanded ? "📂" : "📁"}
          </span>
        </div>

        {isExpanded && (
          <ul
            className="ml-4"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isLoading.value ? (
              <li className="py-1 px-2 text-gray-500">Loading...</li>
            ) : itemError.value ? (
              <li className="py-1 px-2 flex flex-col">
                <span className="text-red-500 text-xs">{itemError.value}</span>
                <button
                  className="mt-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center justify-center"
                  onClick={() => {
                    isLoading.value = true;
                    itemError.value = null;
                    listDirectoryComplete({ path: childPath, force: true })
                      .then((entries) => {
                        fileTree.value = {
                          ...fileTree.value,
                          [childPath]: entries,
                        };
                        console.log(`Retry successful for ${childPath}`);
                        // Make sure the directory is marked as expanded
                        const newExpanded = new Set(expandedPaths.value);
                        newExpanded.add(childPath);
                        expandedPaths.value = newExpanded;
                        // Force re-render by creating a new Set object
                        setTimeout(() => {
                          // If for some reason the UI didn't update, force it
                          if (
                            !document.querySelector(
                              `[data-path="${childPath}"][data-expanded="true"]`,
                            )
                          ) {
                            console.log(
                              "UI didn't update after retry, forcing refresh",
                            );
                            expandedPaths.value = new Set(expandedPaths.value);
                          }
                        }, 50);
                      })
                      .catch((err) => {
                        console.error(`Retry failed for ${childPath}:`, err);
                        itemError.value = `Failed to load ${childPath}: ${err instanceof Error ? err.message : String(err)}`;
                      })
                      .finally(() => {
                        isLoading.value = false;
                      });
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                    />
                  </svg>
                  Retry
                </button>
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
  const contextMenuPosition = useSignal<{
    x: number;
    y: number;
    directAction?: "delete";
  } | null>(null);
  const isEditing = editingPath.value === childPath;
  const nameInputRef = useSignal<HTMLInputElement | null>(null);
  const inputValue = useSignal(entry.name);
  const isProcessingRename = useSignal(false);
  const isCorrupted = isCorruptedEntry(entry);

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
    // Don't allow selection of corrupted entries
    if (isCorrupted) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

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
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      // Ensure the current item is selected if not already part of a multi-selection
      if (!selectedPaths.value.has(childPath)) {
        selectedPaths.value = new Set([childPath]);
      } // If already selected (single or multi), respect existing selection for deletion

      const el = e.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      contextMenuPosition.value = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        directAction: "delete",
      };
    }
  };

  const handleDragStart = (e: DragEvent) => {
    // Don't allow dragging corrupted entries
    if (isCorrupted) {
      e.preventDefault();
      return;
    }

    if (e.dataTransfer) {
      e.dataTransfer.setData("application/deluge-path", childPath);
      e.dataTransfer.setData("text/plain", entry.name);
      e.dataTransfer.effectAllowed = "move";
    }
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop event bubbling

    // Don't show context menu for corrupted entries
    if (isCorrupted) {
      return;
    }

    /*
     * If the user right-clicks on an item that is *already* inside the current
     * selection we want to keep that multi-selection intact. If the item is
     * *not* part of the selection we follow desktop-style semantics and make
     * it the sole selected item.
     */
    if (!selectedPaths.value.has(childPath)) {
      selectedPaths.value = new Set([childPath]);
      lastSelectedPath = childPath;
    }

    // Finally, open the context-menu at the cursor position.
    contextMenuPosition.value = { x: e.pageX, y: e.pageY };
  };

  const startEdit = () => {
    // Don't allow editing corrupted entries
    if (isCorrupted) return;

    // Don't allow editing if file transfer is in progress
    if (fileTransferInProgress.value || !midiOut.value) return;

    editingPath.value = childPath;
    inputValue.value = entry.name;
  };

  const cancelEdit = () => {
    editingPath.value = null;
  };

  const commitRename = async () => {
    if (isProcessingRename.value) return;
    isProcessingRename.value = true;

    const trimmedNewName = inputValue.value.trim();

    if (trimmedNewName === "") {
      cancelEdit();
      isProcessingRename.value = false;
      return;
    }
    if (/[\/\\:*?"<>|]/.test(trimmedNewName)) {
      alert(
        'The name cannot contain the following characters: \\ / : * ? " < > |',
      );
      cancelEdit();
      isProcessingRename.value = false;
      return;
    }
    if (trimmedNewName === entry.name) {
      cancelEdit();
      isProcessingRename.value = false;
      return;
    }

    const oldPath = childPath; // Full path of the item being renamed
    const parentDir = path; // Parent path of the item being renamed
    const newPath =
      parentDir === "/"
        ? `/${trimmedNewName}`
        : `${parentDir}/${trimmedNewName}`;

    try {
      cancelEdit();
      await renameFile({ oldPath, newPath });

      // For files, oldParentPath and newParentPath will be the same unless future move logic is added here.
      // For now, it simplifies to refreshing just one parent directory.
      const parentPathToRefresh = parentDir; // Same as oldParentPath and newParentPath for file rename

      const updatedEntries = await listDirectoryComplete({
        path: parentPathToRefresh,
        force: true,
      });
      const newFileTreeData = {
        ...fileTree.peek(),
        [parentPathToRefresh]: updatedEntries,
      };

      // File items are not keys in fileTree for children, so no key renaming needed for fileTreeData itself.
      // File items are not typically in expandedPaths unless we change that feature.

      if (selectedPaths.value.has(oldPath)) {
        const newSelection = new Set(selectedPaths.value);
        newSelection.delete(oldPath);
        newSelection.add(newPath);
        selectedPaths.value = newSelection;
      }
      // Also update lastSelectedPath if it was the one renamed
      if (lastSelectedPath === oldPath) {
        lastSelectedPath = newPath;
      }

      fileTree.value = newFileTreeData;
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
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename(); // commitRename will use inputValue and component props
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  // Handle double-click for file preview/edit
  const handleDoubleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Don't trigger for corrupted entries
    if (isCorrupted) return;

    // Don't trigger if we're editing
    if (isEditing) return;

    // Check if this is an audio or text file
    if (isAudio(entry)) {
      // For audio files, still use preview mode
      previewFile.value = { path: childPath, type: "audio" };
    } else if (isText(entry)) {
      // For text files, go directly to edit mode instead of preview
      editingFileState.value = {
        path: childPath,
        initialContent: "", // Will be populated when component loads
        currentContent: "",
        dirty: false,
      };
    }
    // Silently ignore other file types for now
  };

  // Handler for per-file download
  const handleDownloadFile = async (e: MouseEvent) => {
    e.stopPropagation();

    // Don't allow downloading corrupted entries
    if (isCorrupted) {
      e.preventDefault();
      return;
    }

    try {
      const data = await readFile({ path: childPath });
      triggerBrowserDownload(data, entry.name);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  return (
    <li
      data-testid={`file-tree-item-${entry.name}`}
      className={`py-0.5 px-2 border-b border-neutral-100 dark:border-neutral-800 flex items-center cursor-pointer select-none relative ${
        isSelected ? "bg-blue-100 dark:bg-blue-900" : ""
      } ${
        isDragOver.value ? "bg-blue-50 dark:bg-blue-950 border-blue-200" : ""
      } ${
        isCorrupted
          ? "opacity-50 cursor-not-allowed bg-red-50 dark:bg-red-900/20"
          : ""
      }`}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      data-path={childPath}
      tabIndex={0}
      draggable={!isCorrupted}
      onDragStart={handleDragStart}
      role="treeitem"
      aria-selected={isSelected}
      title={
        isCorrupted
          ? `Corrupted file entry (attr: ${entry.attr}) - Cannot be accessed. Run disk check on SD card to fix.`
          : undefined
      }
    >
      {/* Download button for individual file */}
      {!isCorrupted && (
        <button
          onClick={handleDownloadFile}
          data-testid={`download-file-button-${entry.name}`}
          className="cursor-pointer p-1 focus:outline-none hover:scale-120 transition-transform"
          aria-label={`Download ${entry.name}`}
        >
          {/* Download icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
            <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
          </svg>
        </button>
      )}

      {isCorrupted && (
        <span className="mr-1 text-red-500" title="Corrupted file entry">
          ⚠️
        </span>
      )}

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
        <span
          onDblClick={handleDoubleClick}
          className={isCorrupted ? "line-through" : ""}
        >
          {entry.name}
        </span>
      )}

      {isCorrupted && (
        <span className="ml-2 text-xs text-red-500">(corrupted)</span>
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
    </li>
  );
}

/**
 * Root tree component for browsing files on the Deluge SD card
 */
export default function FileBrowserTree({
  showWarning,
  showCorruptedWarning,
}: {
  showWarning: Signal<boolean>;
  showCorruptedWarning: Signal<boolean>;
}) {
  const rootPath = "/";
  const isLoading = useSignal(false);
  const error = useSignal<string | null>(null);
  const contextMenuPosition = useSignal<{ x: number; y: number } | null>(null);

  // Check if there are any corrupted entries in the current view
  const hasCorruptedEntries = () => {
    for (const entries of Object.values(fileTree.value)) {
      if (entries && entries.some(isCorruptedEntry)) {
        return true;
      }
    }
    return false;
  };

  // Load root directory when MIDI device is connected
  useEffect(() => {
    if (!fileTree.value[rootPath] && midiOut.value !== null) {
      isLoading.value = true;
      error.value = null;
      console.log("MIDI connected - loading root directory...");

      // Test sequence: ping -> version check -> directory listing
      testSysExConnectivity()
        .then(() => {
          console.log("Basic SysEx connectivity OK");
          return checkFirmwareSupport();
        })
        .then(() => {
          console.log("Device responded to version request");
          return listDirectoryComplete({ path: rootPath });
        })
        .then((entries) => {
          console.log(`Root directory loaded with ${entries.length} entries`);
          // Update fileTree state with loaded entries
          fileTree.value = { ...fileTree.value, [rootPath]: entries };
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
    } else if (!midiOut.value) {
      console.log("Waiting for MIDI device connection...");
    }
  }, [midiOut.value]); // Re-run when MIDI device changes

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

  return (
    <div
      className="h-full flex flex-col font-mono text-sm"
      onContextMenu={handleRootContextMenu}
      data-testid="file-browser-tree-root"
    >
      {showWarning.value && (
        <div className="bg-yellow-100 border border-yellow-300 text-yellow-900 p-2 text-sm font-medium flex flex-col">
          <span>
            <strong>Warning:</strong> The file system implementation may
            sometimes be unstable. Please back up your SD card before using this
            feature.
          </span>
          <button
            onClick={() => (showWarning.value = false)}
            className="cursor-pointer text-yellow-900 focus:outline-none border-t border-yellow-300 pt-2"
          >
            Hide
          </button>
        </div>
      )}

      {hasCorruptedEntries() && showCorruptedWarning.value && (
        <div className="bg-red-100 border border-red-300 text-red-900 p-3 text-sm">
          <div className="flex items-start">
            <span className="mr-2 text-lg">⚠️</span>
            <div className="flex-1">
              <p className="font-bold mb-1">Corrupted File Entries Detected</p>
              <p className="mb-2">
                Some files have invalid attributes (marked with ⚠️) and cannot
                be accessed. These are typically caused by interrupted uploads
                or filesystem corruption.
              </p>
              <p className="font-medium">To fix this issue:</p>
              <ol className="list-decimal list-inside ml-2 mt-1">
                <li>Safely eject and remove the SD card from your Deluge</li>
                <li>Insert it into your computer</li>
                <li>
                  Run disk repair:
                  <ul className="list-disc list-inside ml-4 mt-1">
                    <li>
                      <strong>macOS:</strong> Use Disk Utility → First Aid
                    </li>
                    <li>
                      <strong>Windows:</strong> Right-click drive → Properties →
                      Tools → Check
                    </li>
                    <li>
                      <strong>Linux:</strong> Run{" "}
                      <code className="bg-red-200 px-1 rounded">
                        fsck.vfat -a /dev/sdX
                      </code>
                    </li>
                  </ul>
                </li>
                <li>Safely eject the card and reinsert into Deluge</li>
              </ol>
              <button
                onClick={() => (showCorruptedWarning.value = false)}
                className="mt-3 text-red-700 underline hover:no-underline text-sm"
              >
                Hide this warning
              </button>
            </div>
          </div>
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
            <p className="text-sm text-neutral-500 mb-4">
              Make sure your Deluge is connected and that you're using community
              firmware 1.3.0 or later
            </p>
            <button
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded inline-flex items-center"
              onClick={() => {
                if (!midiOut.value) return;

                isLoading.value = true;
                error.value = null;

                // Retry with the same sequence used on initial load
                testSysExConnectivity()
                  .then(() => {
                    console.log("Retry: Basic SysEx connectivity OK");
                    return checkFirmwareSupport();
                  })
                  .then(() => {
                    console.log("Retry: Device responded to version request");
                    return listDirectoryComplete({
                      path: rootPath,
                      force: true,
                    });
                  })
                  .then((entries) => {
                    console.log(
                      `Retry: Root directory loaded with ${entries.length} entries`,
                    );
                    fileTree.value = {
                      ...fileTree.value,
                      [rootPath]: entries,
                    };
                  })
                  .catch((err) => {
                    console.error("Retry: Failed to load root directory:", err);
                    error.value =
                      err.message || "Failed to communicate with Deluge";
                  })
                  .finally(() => {
                    isLoading.value = false;
                  });
              }}
              disabled={!midiOut.value}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                  clipRule="evenodd"
                />
              </svg>
              Retry Connection
            </button>
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

      {/* Filename issues dialog */}
      <FileNameIssuesDialog />
    </div>
  );
}
