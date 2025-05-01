import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import {
  fileTree,
  expandedPaths,
  midiOut,
  FileEntry,
  selectedPath,
} from "../state";
import {
  listDirectory,
  testSysExConnectivity,
  checkFirmwareSupport,
} from "../lib/midi";
import { iconForEntry } from "../lib/fileIcons";

/**
 * Checks if an entry is a directory based on its attribute flags
 * @param entry FileEntry to check
 * @returns true if the entry is a directory
 */
function isDirectory(entry: FileEntry): boolean {
  return (entry.attr & 0x10) !== 0;
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
  const isSelected = selectedPath.value === childPath;
  const itemError = useSignal<string | null>(null);

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

  const handleSelect = () => {
    selectedPath.value = childPath;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      toggleExpand(e as unknown as MouseEvent);
    }
  };

  return (
    <li>
      <div
        className={`flex items-center py-1 px-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer select-none ${
          isSelected
            ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
            : ""
        } ${isExpanded ? "font-medium" : ""}`}
        onClick={handleSelect}
        onDblClick={toggleExpand}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        data-path={childPath}
        data-expanded={isExpanded}
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
        <span className="ml-1 truncate">{entry.name}</span>
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
            fileTree.value[childPath]?.map((childEntry) =>
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
  const isSelected = selectedPath.value === fullPath;

  const handleSelect = () => {
    selectedPath.value = fullPath;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSelect();
    }
  };

  return (
    <li
      className={`py-1 px-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer flex items-center ml-6 select-none ${
        isSelected
          ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
          : ""
      }`}
      data-path={fullPath}
      onClick={handleSelect}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {iconForEntry(entry)}
      <span className="ml-1 truncate">{entry.name}</span>
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
            fileTree.value[rootPath].map((entry) =>
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
