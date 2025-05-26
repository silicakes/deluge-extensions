import { useSignal, useComputed } from "@preact/signals";
import {
  fileTree,
  selectedPaths,
  FileEntry,
  previewFile,
  editingFileState,
} from "../state";
import { formatBytes, formatDate } from "../lib/format";
import { iconUrlForEntry } from "../lib/fileIcons";
import { isDirectory, isAudio, isText } from "../lib/fileType";
import { sortEntriesDirectoriesFirst } from "../lib/fileSelection";
import { listDirectoryComplete } from "@/commands";
import FileContextMenu from "./FileContextMenu";

interface DirectoryPaneProps {
  path: string;
  side: "left" | "right";
  isActive: boolean;
  onActivate: () => void;
  onPathChange?: (newPath: string) => void;
}

export default function DirectoryPane({
  path,
  isActive,
  onActivate,
  onPathChange,
}: DirectoryPaneProps) {
  const isLoading = useSignal(false);
  const error = useSignal<string | null>(null);
  const contextMenuPosition = useSignal<{
    x: number;
    y: number;
    entry: FileEntry;
  } | null>(null);

  // Make path reactive within the component
  const currentPath = useSignal(path);

  // Update currentPath when prop changes
  if (currentPath.value !== path) {
    currentPath.value = path;
  }

  // Get entries for current path
  const entries = useComputed(() => {
    const rawEntries = fileTree.value[currentPath.value] || [];
    return sortEntriesDirectoriesFirst(rawEntries);
  });

  // Load directory contents if not already loaded
  const loadDirectory = async (dirPath: string) => {
    if (fileTree.value[dirPath]) {
      return; // Already loaded
    }

    isLoading.value = true;
    error.value = null;

    try {
      const entries = await listDirectoryComplete({ path: dirPath });
      fileTree.value = { ...fileTree.value, [dirPath]: entries };
    } catch (err) {
      console.error(`Failed to load directory ${dirPath}:`, err);
      error.value = `Failed to load ${dirPath}: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      isLoading.value = false;
    }
  };

  // Navigate to a new path
  const navigateTo = async (newPath: string) => {
    try {
      // Always load the directory (loadDirectory will skip if already loaded)
      await loadDirectory(newPath);

      // Update path after successful load
      onPathChange?.(newPath);
    } catch (err) {
      console.error(`Failed to navigate to ${newPath}:`, err);
    }
  };

  // Handle breadcrumb navigation
  const getBreadcrumbs = (): Array<{
    name: string;
    path: string;
    isEllipsis?: boolean;
  }> => {
    if (currentPath.value === "/") return [{ name: "Root", path: "/" }];

    const parts = currentPath.value.split("/").filter(Boolean);
    const breadcrumbs = [{ name: "Root", path: "/" }];

    let pathBuilder = "";
    for (const part of parts) {
      pathBuilder += "/" + part;
      breadcrumbs.push({ name: part, path: pathBuilder });
    }

    // If we have more than 4 breadcrumbs, show a compact version
    if (breadcrumbs.length > 4) {
      return [
        breadcrumbs[0], // Root
        { name: "...", path: "", isEllipsis: true }, // Ellipsis
        ...breadcrumbs.slice(-2), // Last 2 items
      ];
    }

    return breadcrumbs;
  };

  const handleItemClick = async (entry: FileEntry, e: MouseEvent) => {
    onActivate(); // Make this pane active

    const fullPath =
      currentPath.value === "/"
        ? `/${entry.name}`
        : `${currentPath.value}/${entry.name}`;

    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd click: toggle selection
      const newSelection = new Set(selectedPaths.value);
      if (newSelection.has(fullPath)) {
        newSelection.delete(fullPath);
      } else {
        newSelection.add(fullPath);
      }
      selectedPaths.value = newSelection;
    } else {
      // Regular click: select item
      selectedPaths.value = new Set([fullPath]);
    }
  };

  const handleItemDoubleClick = async (entry: FileEntry) => {
    const fullPath =
      currentPath.value === "/"
        ? `/${entry.name}`
        : `${currentPath.value}/${entry.name}`;

    if (isDirectory(entry)) {
      try {
        // Always load the directory (loadDirectory will skip if already loaded)
        await loadDirectory(fullPath);

        // Update path after successful load
        onPathChange?.(fullPath);
      } catch (err) {
        console.error(`Failed to navigate to directory ${fullPath}:`, err);
      }
    } else if (isAudio(entry)) {
      // Preview audio file
      previewFile.value = { path: fullPath, type: "audio" };
    } else if (isText(entry)) {
      // Edit text file
      editingFileState.value = {
        path: fullPath,
        initialContent: "",
        currentContent: "",
        dirty: false,
      };
    }
  };

  const handleContextMenu = (entry: FileEntry, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const fullPath =
      currentPath.value === "/"
        ? `/${entry.name}`
        : `${currentPath.value}/${entry.name}`;

    // Select the item if not already selected
    if (!selectedPaths.value.has(fullPath)) {
      selectedPaths.value = new Set([fullPath]);
    }

    contextMenuPosition.value = {
      x: e.pageX,
      y: e.pageY,
      entry,
    };
  };

  // Load initial directory
  if (!fileTree.value[currentPath.value] && !isLoading.value && !error.value) {
    loadDirectory(currentPath.value);
  }

  return (
    <div
      className={`h-full flex flex-col ${
        isActive ? "bg-blue-50 dark:bg-blue-900/10" : ""
      }`}
      onClick={onActivate}
    >
      {/* Breadcrumb Navigation */}
      <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
        <div className="flex items-center space-x-1 text-sm overflow-x-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800">
          <div className="flex items-center space-x-1 min-w-max">
            {getBreadcrumbs().map((crumb, index) => (
              <div
                key={crumb.path || `ellipsis-${index}`}
                className="flex items-center flex-shrink-0"
              >
                {index > 0 && (
                  <span className="mx-1 text-gray-400 flex-shrink-0">/</span>
                )}
                {crumb.isEllipsis ? (
                  <span
                    className="px-2 py-1 text-gray-500 dark:text-gray-400 cursor-default"
                    title={`Full path: ${currentPath.value}`}
                  >
                    {crumb.name}
                  </span>
                ) : (
                  <button
                    onClick={() => navigateTo(crumb.path)}
                    disabled={isLoading.value}
                    className={`px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${
                      crumb.path === currentPath.value
                        ? "bg-blue-500 text-white"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                    title={crumb.path} // Show full path on hover
                  >
                    {crumb.name}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Directory Contents */}
      <div className="flex-1 overflow-y-auto">
        {isLoading.value ? (
          <div className="p-4 text-center text-gray-500">
            <span className="inline-block animate-spin mr-2">⏳</span>
            Loading...
          </div>
        ) : error.value ? (
          <div className="p-4 text-center">
            <div className="text-red-500 mb-2">{error.value}</div>
            <button
              onClick={() => loadDirectory(currentPath.value)}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        ) : entries.value.length === 0 ? (
          <div className="p-4 text-center text-gray-500">Empty directory</div>
        ) : (
          <div className="p-2">
            {entries.value.map((entry) => {
              const fullPath =
                currentPath.value === "/"
                  ? `/${entry.name}`
                  : `${currentPath.value}/${entry.name}`;
              const isSelected = selectedPaths.value.has(fullPath);

              return (
                <div
                  key={entry.name}
                  className={`flex items-center p-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    isSelected ? "bg-blue-100 dark:bg-blue-900/30" : ""
                  }`}
                  onClick={(e) => handleItemClick(entry, e)}
                  onDblClick={() => handleItemDoubleClick(entry)}
                  onContextMenu={(e) => handleContextMenu(entry, e)}
                  data-path={fullPath}
                >
                  {/* File Icon */}
                  <img
                    src={iconUrlForEntry(entry)}
                    alt=""
                    className="w-4 h-4 mr-2 flex-shrink-0"
                  />

                  {/* File Name */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {entry.name}
                      {isDirectory(entry) && (
                        <span className="text-gray-500">/</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 flex space-x-2">
                      <span>
                        {isDirectory(entry) ? "—" : formatBytes(entry.size)}
                      </span>
                      <span>{formatDate(entry.date, entry.time)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenuPosition.value && (
        <FileContextMenu
          path={currentPath.value}
          entry={contextMenuPosition.value.entry}
          position={{
            x: contextMenuPosition.value.x,
            y: contextMenuPosition.value.y,
          }}
          isDirectory={isDirectory(contextMenuPosition.value.entry)}
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
    </div>
  );
}
