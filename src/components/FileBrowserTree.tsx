import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import {
  fileTree,
  expandedPaths,
  midiOut,
  FileEntry,
  selectedPaths,
} from "../state";
import {
  listDirectory,
  testSysExConnectivity,
  checkFirmwareSupport,
  uploadFiles,
  movePath,
} from "../lib/midi";
import { iconForEntry } from "../lib/fileIcons";
import { isExternalFileDrag, isInternalDrag } from "../lib/drag";

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

  const toggleExpand = async (e: MouseEvent) => {
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
        toggleExpand(e as unknown as MouseEvent);
      }
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

  return (
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
        {iconForEntry(entry)}
        <span className="ml-1 truncate" title={entry.name}>
          {entry.name}
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
  );
}

/**
 * Renders a file item in the tree
 */
function FileItem({ path, entry }: { path: string; entry: FileEntry }) {
  // Include the path in a data attribute for potential future use
  const fullPath = path === "/" ? `/${entry.name}` : `${path}/${entry.name}`;
  const isSelected = selectedPaths.value.has(fullPath);

  const handleSelect = (e: MouseEvent) => {
    if (e.shiftKey && lastSelectedPath) {
      // Shift key: range selection
      selectRange(lastSelectedPath, fullPath);
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd key: toggle selection
      const newSelection = new Set(selectedPaths.value);
      if (newSelection.has(fullPath)) {
        newSelection.delete(fullPath);
      } else {
        newSelection.add(fullPath);
        lastSelectedPath = fullPath;
      }
      selectedPaths.value = newSelection;
    } else {
      // Regular click: single selection
      selectedPaths.value = new Set([fullPath]);
      lastSelectedPath = fullPath;
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault(); // Prevent scrolling with spacebar
      handleSelect(e as unknown as MouseEvent);
    }
  };

  const handleDragStart = (e: DragEvent) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData("application/deluge-path", fullPath);
      e.dataTransfer.setData("text/plain", entry.name);
      e.dataTransfer.effectAllowed = "move";
    }
  };

  return (
    <li
      className={`py-1 px-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer flex items-center ml-6 select-none ${
        isSelected
          ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
          : ""
      }`}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      data-path={fullPath}
      draggable={true}
      onDragStart={handleDragStart}
    >
      {iconForEntry(entry)}
      <span className="ml-1 truncate" title={entry.name}>
        {entry.name}
      </span>
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

  const toggleDebugMode = () => {
    debugMode.value = !debugMode.value;
    localStorage.setItem("dex-file-debug", debugMode.value ? "true" : "false");
    console.log("Debug mode:", debugMode.value);
    console.log("expandedPaths:", Array.from(expandedPaths.value));
    console.log("fileTree paths:", Object.keys(fileTree.value));
  };

  // Pass debugMode to DirectoryItem components
  // Make DirectoryItem aware of debugMode
  function DirectoryItemWithDebug(props: {
    path: string;
    entry: FileEntry;
    level?: number;
  }) {
    return <DirectoryItem {...props} debugMode={debugMode.value} />;
  }

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

  // Check if we are connected to MIDI device
  if (midiOut.value === null) {
    return (
      <div className="p-4 text-center text-gray-500">
        Connect to your Deluge to browse files
      </div>
    );
  }

  // Debug button (only in development)
  const renderDebugButton = process.env.NODE_ENV === "development" && (
    <div className="bg-slate-700 border-t border-slate-600 px-2 py-1 text-xs flex justify-between items-center">
      <button
        onClick={toggleDebugMode}
        className={`px-2 py-1 rounded ${debugMode.value ? "bg-green-700" : "bg-slate-800"}`}
      >
        Debug {debugMode.value ? "ON" : "OFF"}
      </button>
      {debugMode.value && (
        <div className="text-gray-400">
          fileTree: {Object.keys(fileTree.value).length} paths, expanded:{" "}
          {expandedPaths.value.size} paths
        </div>
      )}
    </div>
  );

  return (
    <div className="overflow-auto h-full flex flex-col">
      <div className="flex-grow">
        <ul className="py-2">
          {isLoading.value ? (
            <li className="py-1 px-4 text-gray-500">Loading...</li>
          ) : error.value ? (
            <li className="py-1 px-4 text-red-500">
              <div className="mb-2">Error: {error.value}</div>
              <div className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                <p className="mb-1 font-semibold">Troubleshooting:</p>
                <ul className="list-disc pl-5">
                  <li>Make sure your Deluge is connected via USB</li>
                  <li>
                    <strong>Ensure you've selected "Deluge Port 3"</strong> (the
                    SysEx port)
                  </li>
                  <li>
                    Verify your Deluge's firmware supports file browsing:
                    <ul className="list-circle pl-4 mt-1 text-xs">
                      <li>Community firmware 1.3+ required</li>
                      <li>DEV_SYSEX runtime feature must be enabled</li>
                    </ul>
                  </li>
                  <li className="mt-2">
                    <button
                      onClick={() => {
                        isLoading.value = true;
                        error.value = null;
                        listDirectory(rootPath)
                          .then(() => {
                            console.log("Retry successful");
                          })
                          .catch((err) => {
                            console.error("Retry failed:", err);
                            error.value =
                              err.message ||
                              "Failed to communicate with Deluge";
                          })
                          .finally(() => {
                            isLoading.value = false;
                          });
                      }}
                      className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded text-xs"
                    >
                      Retry
                    </button>
                  </li>
                </ul>
              </div>
            </li>
          ) : fileTree.value[rootPath] ? (
            sortEntriesDirectoriesFirst(fileTree.value[rootPath]).map(
              (entry) =>
                isDirectory(entry) ? (
                  <DirectoryItemWithDebug
                    key={entry.name}
                    path={rootPath}
                    entry={entry}
                  />
                ) : (
                  <FileItem key={entry.name} path={rootPath} entry={entry} />
                ),
            )
          ) : (
            <li className="py-1 px-4 text-gray-500">
              No files found. Make sure your SD card is inserted.
            </li>
          )}
        </ul>
      </div>
      {renderDebugButton}
    </div>
  );
}
