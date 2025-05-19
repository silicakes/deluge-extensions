import { lazy, Suspense } from "preact/compat";
import { useSignal, useSignalEffect } from "@preact/signals";
import {
  fileBrowserOpen,
  midiOut,
  selectedPaths,
  fileTransferInProgress,
  fileTransferProgress,
  fileTree,
  anyTransferInProgress,
} from "../state";
import {
  triggerBrowserDownload,
  uploadFiles,
  makeDirectory,
  writeFile,
  readFile,
  listDirectory,
} from "@/commands";
import {
  fileOverrideConfirmationOpen,
  filesToOverride,
  confirmCallback,
} from "./FileOverrideConfirmation";
import FileTransferQueue from "./FileTransferQueue";
import FileTransferProgress from "./FileTransferProgress";

// Lazily load the FileBrowserTree component
const FileBrowserTree = lazy(() => import("./FileBrowserTree"));

export default function FileBrowserSidebar() {
  const isDraggingOver = useSignal(false);
  const hasSelectedFiles = useSignal(false);
  const downloadButtonVisible = useSignal(false); // For debugging
  const showNewFolderModal = useSignal(false);
  const showNewFileModal = useSignal(false);
  const newName = useSignal("");
  const showConflictDialog = useSignal(false);
  const isRefreshing = useSignal(false);

  // Auto-close sidebar when MIDI is disconnected
  useSignalEffect(() => {
    if (fileBrowserOpen.value && midiOut.value === null) {
      fileBrowserOpen.value = false;
    }
  });

  // Determine if there are any selected files - simplified logic
  useSignalEffect(() => {
    console.log(
      "Selection changed, selectedPaths.size =",
      selectedPaths.value.size,
    );

    // Always show download button if any paths are selected
    if (selectedPaths.value.size > 0) {
      hasSelectedFiles.value = true;
      downloadButtonVisible.value = true;
      console.log("Download button should be visible", hasSelectedFiles.value);
    } else {
      hasSelectedFiles.value = false;
      downloadButtonVisible.value = false;
      console.log("No selection, hiding download button");
    }
  });

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();

    // Only show overlay for files being dragged, not text selection
    if (!e.dataTransfer?.types.includes("Files")) {
      return;
    }

    // Don't show the overlay if we're hovering over a directory item
    // Check if the current target or any of its parents has a data-path attribute
    let element = e.target as HTMLElement;
    while (element && element !== e.currentTarget) {
      if (element.hasAttribute("data-path")) {
        // We're hovering over a directory item, don't show the root upload overlay
        return;
      }
      element = element.parentElement!;
    }

    isDraggingOver.value = true;
    console.log("File drag detected, showing upload indicator");
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    // Check if we're leaving the sidebar entirely
    // (not just moving between elements)
    if (
      e.relatedTarget === null ||
      !(e.currentTarget as Node).contains(e.relatedTarget as Node)
    ) {
      isDraggingOver.value = false;
      console.log("Drag left sidebar");
    }
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();

    let element = e.target as HTMLElement;
    while (element && element !== e.currentTarget) {
      if (element.hasAttribute("data-path")) {
        console.log("Drop handled by directory item, skipping sidebar handler");
        isDraggingOver.value = false;
        return;
      }
      element = element.parentElement!;
    }

    isDraggingOver.value = false;
    console.log("File dropped on sidebar (root level)");

    let targetDir = "/";
    if (selectedPaths.value.size > 0) {
      const selectedPath = Array.from(selectedPaths.value)[0];
      if (
        fileTree.value[selectedPath] &&
        Array.isArray(fileTree.value[selectedPath])
      ) {
        targetDir = selectedPath;
      } else {
        const parent =
          selectedPath.substring(0, selectedPath.lastIndexOf("/") || 0) || "/";
        targetDir = parent;
      }
    } else {
      console.log("No selection, uploading to root directory for drop event");
    }

    if (e.dataTransfer?.files.length) {
      const allDroppedFiles = Array.from(e.dataTransfer.files);

      console.log(
        `Files dropped on sidebar, processing ${allDroppedFiles.length} files for directory: ${targetDir}`,
      );

      const existingEntries = fileTree.value[targetDir] || [];
      const conflictingFiles: File[] = [];
      const nonConflictingFiles: File[] = [];

      const isDirectoryEntry = (entry: { name: string; attr: number }) =>
        (entry.attr & 0x10) !== 0;

      for (const file of allDroppedFiles) {
        const isConflict = existingEntries.some(
          (entry) => entry.name === file.name && !isDirectoryEntry(entry),
        );
        if (isConflict) {
          conflictingFiles.push(file);
        } else {
          nonConflictingFiles.push(file);
        }
      }

      const totalFilesToProcess = allDroppedFiles.length;
      let filesProcessedSoFar = 0;

      const doUpload = async (filesToUpload: File[], overwrite = false) => {
        if (filesToUpload.length === 0) return;
        console.log(
          `[Sidebar Drop] Uploading ${filesToUpload.length} files to ${targetDir} (overwrite: ${overwrite})`,
        );
        fileTransferInProgress.value = true;
        try {
          await uploadFiles({
            files: filesToUpload,
            destDir: targetDir,
            overwrite: overwrite,
            onProgress: (index, sent, total) => {
              const currentFile = filesToUpload[index];
              const fullPath = targetDir.endsWith("/")
                ? `${targetDir}${currentFile.name}`
                : `${targetDir}/${currentFile.name}`;
              fileTransferProgress.value = {
                path: fullPath,
                bytes: sent,
                total,
                currentFileIndex: filesProcessedSoFar + index + 1,
                totalFiles: totalFilesToProcess,
              };
            },
          });
          const updatedEntries = await listDirectory({
            path: targetDir,
            force: true,
          });
          fileTree.value = {
            ...fileTree.value,
            [targetDir]: updatedEntries,
          };
          filesProcessedSoFar += filesToUpload.length;
          console.log(
            `[Sidebar Drop] Batch upload to ${targetDir} successful. Processed: ${filesProcessedSoFar}/${totalFilesToProcess}`,
          );
        } catch (err) {
          console.error("[Sidebar Drop] Failed to upload files:", err);
          alert(
            `Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`,
          );
        } finally {
          if (filesProcessedSoFar === totalFilesToProcess) {
            fileTransferInProgress.value = false;
            fileTransferProgress.value = null;
            console.log("[Sidebar Drop] All drop uploads finished.");
          }
        }
      };

      if (conflictingFiles.length > 0) {
        filesToOverride.value = conflictingFiles.map((f) => f.name);
        confirmCallback.value = async (confirmed) => {
          fileOverrideConfirmationOpen.value = false;
          confirmCallback.value = null;
          if (confirmed) {
            console.log("[Sidebar Drop] User confirmed overwrite.");
            await doUpload(conflictingFiles, true);
            await doUpload(nonConflictingFiles, false);
          } else {
            console.log("[Sidebar Drop] User cancelled overwrite.");
            await doUpload(nonConflictingFiles, false);
          }
        };
        fileOverrideConfirmationOpen.value = true;
      } else {
        console.log("[Sidebar Drop] No conflicts, proceeding with upload.");
        await doUpload(allDroppedFiles, false);
      }
      return; // Important to return after initiating async operations
    }
  };

  const handleDownload = async () => {
    console.log(
      "Download button clicked, selections:",
      Array.from(selectedPaths.value),
    );

    if (selectedPaths.value.size === 0) return;

    // Find the first selected file path
    const filePath = Array.from(selectedPaths.value)[0];

    try {
      console.log("Attempting to download:", filePath);
      const data = await readFile({ path: filePath });
      const fileName = filePath.substring(filePath.lastIndexOf("/") + 1);
      triggerBrowserDownload(data, fileName);
    } catch (err) {
      console.error("Failed to download file:", err);
    }
  };

  const handleFileInputChange = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    const allDroppedFiles = Array.from(input.files);

    // Determine target directory
    let targetDir = "/";
    if (selectedPaths.value.size > 0) {
      const selectedPath = Array.from(selectedPaths.value)[0];
      // Check if selected path is a directory by seeing if it's a key in fileTree
      // and its value is an array (list of entries)
      if (
        fileTree.value[selectedPath] &&
        Array.isArray(fileTree.value[selectedPath])
      ) {
        targetDir = selectedPath;
      } else {
        // If it's a file or not a loaded directory, use its parent directory
        targetDir =
          selectedPath.substring(0, selectedPath.lastIndexOf("/") || 0) || "/";
      }
    }
    console.log(`File input change, target directory for upload: ${targetDir}`);

    const existingEntries = fileTree.value[targetDir] || [];
    const conflictingFiles: File[] = [];
    const nonConflictingFiles: File[] = [];

    // Helper to check if an entry is a directory (can be moved to a lib later)
    const isDirectoryEntry = (entry: { name: string; attr: number }) =>
      (entry.attr & 0x10) !== 0;

    for (const file of allDroppedFiles) {
      const isConflict = existingEntries.some(
        (entry) => entry.name === file.name && !isDirectoryEntry(entry),
      );
      if (isConflict) {
        conflictingFiles.push(file);
      } else {
        nonConflictingFiles.push(file);
      }
    }

    const totalFilesToProcess = allDroppedFiles.length;
    let filesProcessedSoFar = 0;

    const doUpload = async (filesToUpload: File[], overwrite = false) => {
      if (filesToUpload.length === 0) return;

      console.log(
        `Uploading ${filesToUpload.length} files to directory: ${targetDir} (overwrite: ${overwrite})`,
      );
      fileTransferInProgress.value = true; // Set before starting

      try {
        await uploadFiles({
          files: filesToUpload,
          destDir: targetDir,
          overwrite: overwrite,
          onProgress: (index, sent, total) => {
            const currentFile = filesToUpload[index];
            const fullPath = targetDir.endsWith("/")
              ? `${targetDir}${currentFile.name}`
              : `${targetDir}/${currentFile.name}`;
            fileTransferProgress.value = {
              path: fullPath,
              bytes: sent,
              total,
              currentFileIndex: filesProcessedSoFar + index + 1, // +1 for 1-based UI if needed
              totalFiles: totalFilesToProcess,
            };
          },
        });
        // Refresh the target directory content after successful upload
        const updatedEntries = await listDirectory({
          path: targetDir,
          force: true,
        });
        fileTree.value = {
          ...fileTree.value,
          [targetDir]: updatedEntries,
        };
        filesProcessedSoFar += filesToUpload.length;
        console.log(
          `Batch upload to ${targetDir} successful, ${filesToUpload.length} files. Processed so far: ${filesProcessedSoFar}/${totalFilesToProcess}`,
        );
      } catch (err) {
        console.error("Failed to upload files from input:", err);
        alert(
          `Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        if (filesProcessedSoFar === totalFilesToProcess) {
          fileTransferInProgress.value = false;
          fileTransferProgress.value = null;
          input.value = ""; // Clear input only after all operations are done
          console.log("All file input uploads finished, input cleared.");
        }
      }
    };

    if (conflictingFiles.length > 0) {
      filesToOverride.value = conflictingFiles.map((f) => f.name);
      confirmCallback.value = async (confirmed) => {
        fileOverrideConfirmationOpen.value = false;
        confirmCallback.value = null; // Clear callback immediately

        if (confirmed) {
          console.log("User confirmed overwrite for input upload.");
          await doUpload(conflictingFiles, true);
          await doUpload(nonConflictingFiles, false);
        } else {
          console.log("User cancelled overwrite for input upload.");
          await doUpload(nonConflictingFiles, false);
        }
        // Ensure input is cleared if no further operations pending
        if (filesProcessedSoFar === totalFilesToProcess && input) {
          input.value = "";
        }
      };
      fileOverrideConfirmationOpen.value = true;
    } else {
      console.log("No conflicts detected for input upload, proceeding.");
      await doUpload(allDroppedFiles, false);
    }
  };

  const handleNewFolder = async () => {
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

    // Determine target directory
    let targetDir = "/";
    if (selectedPaths.value.size > 0) {
      const selectedPath = Array.from(selectedPaths.value)[0];
      // Check if selected path is a directory
      if (fileTree.value[selectedPath]) {
        targetDir = selectedPath;
      } else {
        // If it's a file, use its parent directory
        targetDir =
          selectedPath.substring(0, selectedPath.lastIndexOf("/") || 0) || "/";
      }
    }
    // Conflict: duplicate name in directory
    if (
      (fileTree.value[targetDir] || []).some((e) => e.name === newName.value)
    ) {
      showConflictDialog.value = true;
      return;
    }

    const newDirPath =
      targetDir === "/" ? `/${newName.value}` : `${targetDir}/${newName.value}`;

    try {
      await makeDirectory({ path: newDirPath });
      showNewFolderModal.value = false;
      newName.value = "";

      // Refresh directory after creation
      const updatedEntries = await listDirectory({ path: targetDir });
      fileTree.value = {
        ...fileTree.value,
        [targetDir]: updatedEntries,
      };
    } catch (error) {
      console.error("Failed to create directory:", error);
      alert(
        `Create folder failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleNewFile = async () => {
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

    // Determine target directory
    let targetDir = "/";
    if (selectedPaths.value.size > 0) {
      const selectedPath = Array.from(selectedPaths.value)[0];
      // Check if selected path is a directory
      if (fileTree.value[selectedPath]) {
        targetDir = selectedPath;
      } else {
        // If it's a file, use its parent directory
        targetDir =
          selectedPath.substring(0, selectedPath.lastIndexOf("/") || 0) || "/";
      }
    }
    // Conflict: duplicate name in directory
    if (
      (fileTree.value[targetDir] || []).some((e) => e.name === newName.value)
    ) {
      showConflictDialog.value = true;
      return;
    }

    const newFilePath =
      targetDir === "/" ? `/${newName.value}` : `${targetDir}/${newName.value}`;

    try {
      await writeFile({ path: newFilePath, data: new Uint8Array(0) });
      showNewFileModal.value = false;
      newName.value = "";

      // Refresh directory after creation
      const updatedEntries = await listDirectory({ path: targetDir });
      fileTree.value = {
        ...fileTree.value,
        [targetDir]: updatedEntries,
      };
    } catch (error) {
      console.error("Failed to create file:", error);
      alert(
        `Create file failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  // Refresh current directory function
  const refreshRootDirectory = async () => {
    if (isRefreshing.value) return;
    isRefreshing.value = true;

    const rootDir = "/"; // Always refresh root

    try {
      console.log(`Refreshing root directory: ${rootDir}`);
      const updatedEntries = await listDirectory({
        path: rootDir,
        force: true,
      });
      fileTree.value = {
        ...fileTree.value,
        [rootDir]: updatedEntries,
      };
      console.log(
        `Root directory ${rootDir} refreshed successfully, UI update triggered`,
      );
    } catch (err) {
      console.error(`Failed to refresh root directory ${rootDir}:`, err);
    } finally {
      isRefreshing.value = false;
    }
  };

  return (
    <aside
      data-testid="file-browser-panel"
      className="fixed top-0 left-0 h-full w-72 sm:w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-hidden z-20 shadow-md flex flex-col"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h2 className="font-semibold text-sm">
          SD Card{" "}
          {selectedPaths.value.size > 0 &&
            `(${selectedPaths.value.size} selected)`}
        </h2>
        <div className="flex items-center space-x-1">
          {/* Refresh button */}
          <button
            aria-label="Refresh directory"
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            onClick={refreshRootDirectory}
            disabled={isRefreshing.value || fileTransferInProgress.value}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className={`w-5 h-5 ${isRefreshing.value ? "animate-spin" : ""}`}
            >
              <path
                fillRule="evenodd"
                d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* New Folder button - always visible */}
          <button
            aria-label="New Folder"
            data-testid="new-folder-button"
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-green-600 dark:text-green-400"
            onClick={() => {
              newName.value = "";
              showNewFolderModal.value = true;
            }}
            disabled={fileTransferInProgress.value}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M3.75 3A1.75 1.75 0 002 4.75v10.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-8.5A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75z" />
              <path d="M10 8a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1H8a1 1 0 110-2h1V9a1 1 0 011-1z" />
            </svg>
          </button>

          {/* New File button - always visible */}
          <button
            aria-label="New File"
            data-testid="new-file-button"
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400"
            onClick={() => {
              newName.value = "";
              showNewFileModal.value = true;
            }}
            disabled={fileTransferInProgress.value}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" />
              <path d="M10 8a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1H8a1 1 0 110-2h1V9a1 1 0 011-1z" />
            </svg>
          </button>

          {/* Always show download button if paths are selected */}
          {selectedPaths.value.size > 0 && (
            <button
              aria-label="Download selected file"
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400"
              onClick={handleDownload}
              disabled={fileTransferInProgress.value}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
              </svg>
            </button>
          )}
          <button
            aria-label="Close"
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={() => (fileBrowserOpen.value = false)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path
                fillRule="evenodd"
                d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Hidden file input for uploads */}
      <input
        type="file"
        className="hidden"
        data-testid="upload-file-input"
        multiple
        onChange={handleFileInputChange}
      />

      {/* Main scrollable content area with bottom padding when transfer is in progress */}
      <div
        className={`flex-grow overflow-y-auto ${fileTransferInProgress.value ? "pb-20" : ""}`}
        data-testid="file-tree"
      >
        <Suspense
          fallback={
            <div className="p-4 text-center">Loading file browser...</div>
          }
        >
          <FileBrowserTree />
        </Suspense>
      </div>

      {/* File Transfer UI: progress for single transfers or queue for multiple */}
      {fileTransferInProgress.value && (
        <div className="absolute bottom-0 left-0 right-0 pb-2 px-3 z-10">
          <FileTransferProgress />
        </div>
      )}
      {!fileTransferInProgress.value && anyTransferInProgress.value && (
        <div className="absolute bottom-0 left-0 right-0 pb-2 px-3 z-10">
          <FileTransferQueue />
        </div>
      )}

      {/* Keep this existing upload overlay */}
      {isDraggingOver.value && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
          <div className="text-xl bg-white dark:bg-gray-800 p-5 rounded-lg shadow-lg border-2 border-blue-500">
            Drop to upload
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal.value && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-medium mb-3">New Folder</h3>
            <input
              type="text"
              value={newName.value}
              onInput={(e) =>
                (newName.value = (e.target as HTMLInputElement).value)
              }
              className="w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded mb-4"
              placeholder="Enter folder name"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded"
                onClick={() => {
                  showNewFolderModal.value = false;
                  newName.value = "";
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-green-500 text-white rounded"
                onClick={handleNewFolder}
                disabled={fileTransferInProgress.value}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New File Modal */}
      {showNewFileModal.value && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-medium mb-3">New File</h3>
            <input
              type="text"
              value={newName.value}
              onInput={(e) =>
                (newName.value = (e.target as HTMLInputElement).value)
              }
              className="w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded mb-4"
              placeholder="Enter file name"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded"
                onClick={() => {
                  showNewFileModal.value = false;
                  newName.value = "";
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded"
                onClick={handleNewFile}
                disabled={fileTransferInProgress.value}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict resolution dialog for duplicate names */}
      {showConflictDialog.value && (
        <div
          data-testid="conflict-dialog"
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        >
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-medium mb-3">Conflict Resolution</h3>
            <p className="mb-4">
              A file or folder named '{newName.value}' already exists. What
              would you like to do?
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-red-500 text-white rounded"
                data-testid="conflict-overwrite-button"
                onClick={() => {
                  /* Overwrite logic placeholder */
                }}
              >
                Overwrite
              </button>
              <button
                className="px-4 py-2 bg-gray-200 rounded"
                data-testid="conflict-skip-button"
                onClick={() => {
                  showConflictDialog.value = false;
                  newName.value = "";
                }}
              >
                Skip
              </button>
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded"
                data-testid="conflict-rename-button"
                onClick={() => {
                  showConflictDialog.value = false;
                }}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
