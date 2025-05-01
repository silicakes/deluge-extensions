import { lazy, Suspense } from "preact/compat";
import { useSignal, useSignalEffect } from "@preact/signals";
import {
  fileBrowserOpen,
  midiOut,
  selectedPaths,
  fileTransferProgress,
  fileTransferInProgress,
  fileTree,
  expandedPaths,
} from "../state";
import {
  readFile,
  triggerBrowserDownload,
  uploadFiles,
  listDirectory,
  createDirectory,
  createFile,
} from "../lib/midi";

// Lazily load the FileBrowserTree component
const FileBrowserTree = lazy(() => import("./FileBrowserTree"));

/**
 * Format bytes into a human-readable string
 */
function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export default function FileBrowserSidebar() {
  const isDraggingOver = useSignal(false);
  const hasSelectedFiles = useSignal(false);
  const downloadButtonVisible = useSignal(false); // For debugging
  const showNewFolderModal = useSignal(false);
  const showNewFileModal = useSignal(false);
  const newName = useSignal("");
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

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();

    // Don't handle the drop if it was caught by a specific folder in the tree
    // This checks if any parent of the target element has a data-path attribute,
    // which indicates it's a directory item in the tree (now on the <li> element)
    let element = e.target as HTMLElement;
    while (element && element !== e.currentTarget) {
      if (element.hasAttribute("data-path")) {
        // The event was caught by a directory item, don't duplicate handling
        console.log("Drop handled by directory item, skipping sidebar handler");
        isDraggingOver.value = false;
        return;
      }
      element = element.parentElement!;
    }

    isDraggingOver.value = false;
    console.log("File dropped on sidebar (root level)");

    // Handle file upload to root or current selected directory
    if (e.dataTransfer?.files.length) {
      const files = e.dataTransfer.files;
      console.log(`Detected ${files.length} files for upload`);

      let targetDir = "/";

      // If a directory is selected, use that as the target
      if (selectedPaths.value.size > 0) {
        const selectedPathsList = Array.from(selectedPaths.value);
        const firstPath = selectedPathsList[0];
        console.log("Selected path for upload target:", firstPath);

        // Check if the path exists as a key in fileTree (is a directory)
        if (fileTree.value[firstPath]) {
          console.log(`${firstPath} is a directory, using as upload target`);
          targetDir = firstPath;
        } else {
          // If it's a file, use its parent directory
          const parent =
            firstPath.substring(0, firstPath.lastIndexOf("/") || 0) || "/";
          console.log(
            `${firstPath} is a file, using parent dir ${parent} as upload target`,
          );
          targetDir = parent;
        }
      } else {
        // No selection, upload to root
        console.log("No selection, uploading to root directory");
      }

      console.log(`Starting upload of ${files.length} files to ${targetDir}`);
      uploadFiles(Array.from(files), targetDir)
        .then(() => {
          console.log("Upload completed successfully");
          // Refresh the directory contents to show the new files
          return listDirectory(targetDir);
        })
        .then(() => {
          console.log(`Directory ${targetDir} refreshed successfully`);
          // Force a UI update to ensure the changes are reflected
          fileTree.value = { ...fileTree.value };
        })
        .catch((err) => {
          console.error("Failed to upload files:", err);
          alert(`Upload failed: ${err.message || "Unknown error"}`);
        });
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
      const data = await readFile(filePath);
      const fileName = filePath.substring(filePath.lastIndexOf("/") + 1);
      triggerBrowserDownload(data, fileName);
    } catch (err) {
      console.error("Failed to download file:", err);
    }
  };

  // Calculate progress percentage for progress bar
  const progressPercent = fileTransferProgress.value
    ? Math.round(
        (100 * fileTransferProgress.value.bytes) /
          fileTransferProgress.value.total,
      )
    : 0;

  // Calculate overall progress if available
  const overallProgressPercent = fileTransferProgress.value?.overallTotal
    ? Math.round(
        (100 * (fileTransferProgress.value.overallBytes || 0)) /
          fileTransferProgress.value.overallTotal,
      )
    : progressPercent;

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

    const newDirPath =
      targetDir === "/" ? `/${newName.value}` : `${targetDir}/${newName.value}`;

    try {
      await createDirectory(newDirPath);
      showNewFolderModal.value = false;
      newName.value = "";

      // Refresh directory after creation
      await listDirectory(targetDir);
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

    const newFilePath =
      targetDir === "/" ? `/${newName.value}` : `${targetDir}/${newName.value}`;

    try {
      await createFile(newFilePath, "");
      showNewFileModal.value = false;
      newName.value = "";

      // Refresh directory after creation
      await listDirectory(targetDir);
    } catch (error) {
      console.error("Failed to create file:", error);
      alert(
        `Create file failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  // Determine current directory for refresh functionality
  const getCurrentDirectory = () => {
    // If a directory is selected, use that
    if (selectedPaths.value.size > 0) {
      const path = Array.from(selectedPaths.value)[0];
      if (fileTree.value[path]) {
        return path; // Selected path is a directory
      } else {
        // It's a file, use parent directory
        return path.substring(0, path.lastIndexOf("/") || 0) || "/";
      }
    }

    // If no selection, use first expanded path or default to root
    return expandedPaths.value.size > 0
      ? Array.from(expandedPaths.value)[0]
      : "/";
  };

  // Refresh current directory function
  const refreshCurrentDir = async () => {
    if (isRefreshing.value) return;
    isRefreshing.value = true;

    const currentDir = getCurrentDirectory();

    try {
      console.log(`Refreshing directory: ${currentDir}`);
      await listDirectory(currentDir, { force: true });
      console.log(`Directory ${currentDir} refreshed successfully`);
    } catch (err) {
      console.error(`Failed to refresh directory ${currentDir}:`, err);
    } finally {
      isRefreshing.value = false;
    }
  };

  return (
    <aside
      className="fixed top-16 bottom-0 left-0 w-72 sm:w-80 bg-neutral-50 dark:bg-neutral-900 shadow-lg z-10 file-browser-sidebar"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="flex items-center justify-between p-2 border-b border-neutral-300 dark:border-neutral-700">
        <h2 className="font-semibold text-sm">
          SD Card{" "}
          {selectedPaths.value.size > 0 &&
            `(${selectedPaths.value.size} selected)`}
        </h2>
        <div className="flex items-center space-x-1">
          {/* Refresh button */}
          <button
            aria-label="Refresh directory"
            className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-gray-600 dark:text-gray-400"
            onClick={refreshCurrentDir}
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
            className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-green-600 dark:text-green-400"
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
            className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-blue-600 dark:text-blue-400"
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
              className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-blue-600 dark:text-blue-400"
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
            className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800"
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
      <div className="overflow-y-auto h-[calc(100%-42px-4px)]">
        <Suspense
          fallback={
            <div className="p-4 text-center">Loading file browser...</div>
          }
        >
          <FileBrowserTree />
        </Suspense>
      </div>

      {/* Enhanced file transfer progress panel */}
      {fileTransferInProgress.value && fileTransferProgress.value && (
        <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 shadow-md">
          {/* File info */}
          <div className="p-2 text-xs">
            <div className="flex justify-between items-center mb-1">
              <div className="font-medium truncate">
                {fileTransferProgress.value.path.split("/").pop()}
              </div>
              <div>
                {fileTransferProgress.value.currentFileIndex !== undefined && (
                  <span className="text-neutral-500 dark:text-neutral-400">
                    File {fileTransferProgress.value.currentFileIndex + 1} of{" "}
                    {fileTransferProgress.value.totalFiles}
                  </span>
                )}
              </div>
            </div>

            {/* Current file progress */}
            <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              <span>
                {formatBytes(fileTransferProgress.value.bytes)} of{" "}
                {formatBytes(fileTransferProgress.value.total)}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden mb-1">
              <div
                className="h-1 bg-blue-500 transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Overall progress (if multiple files) */}
            {fileTransferProgress.value.totalFiles &&
              fileTransferProgress.value.totalFiles > 1 && (
                <>
                  <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mt-2 mb-1">
                    <span className="font-medium">Overall Progress</span>
                    <span>{overallProgressPercent}%</span>
                  </div>
                  <div className="h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden mb-1">
                    <div
                      className="h-1 bg-green-500 transition-all duration-200"
                      style={{ width: `${overallProgressPercent}%` }}
                    />
                  </div>
                </>
              )}
          </div>
        </div>
      )}

      {/* Upload status indicator - smaller non-blocking indicator */}
      {isDraggingOver.value && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-800/20 border-2 border-dashed border-blue-400 dark:border-blue-600 rounded m-4"></div>
          <div className="bg-blue-500 dark:bg-blue-600 text-white text-center text-sm font-medium px-4 py-2 rounded shadow-lg z-10">
            Drop files to upload to root
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal.value && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-medium mb-3">New Folder</h3>
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
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-medium mb-3">New File</h3>
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
    </aside>
  );
}
