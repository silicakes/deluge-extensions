import { useSignal, useComputed } from "@preact/signals";
import {
  fileTree,
  selectedPaths,
  searchMode,
  searchResults,
  SearchResult,
  FileEntry,
  currentPath,
} from "../state";
import { iconUrlForEntry } from "../lib/fileIcons";
import { isDirectory, isAudio, isText } from "../lib/fileType";
import { handleFileSelect } from "../lib/fileSelection";
import { truncateFileName } from "../lib/filenameDisplay";
import HighlightedText from "./HighlightedText";
import { listDirectoryComplete } from "@/commands";
import { expandedPaths, previewFile, editingFileState } from "../state";
import FileContextMenu from "./FileContextMenu";

interface ExtendedEntry extends FileEntry {
  fullPath: string;
  searchResult?: SearchResult;
}

export default function FileIconGrid({ path }: { path?: string } = {}) {
  const contextMenuPosition = useSignal<{
    x: number;
    y: number;
    entry: ExtendedEntry;
  } | null>(null);

  // Use currentPath for navigation when not in search mode
  const activePath = useComputed(() =>
    searchMode.value ? path || "/" : currentPath.value,
  );

  // Use search results when in search mode, otherwise use directory entries
  const entries = useComputed(() => {
    if (searchMode.value) {
      return searchResults.value.map((result) => ({
        ...result.item.entry,
        fullPath: result.item.path,
        searchResult: result,
      })) as ExtendedEntry[];
    }
    return (fileTree.value[activePath.value] || []).map((entry) => ({
      ...entry,
      fullPath:
        activePath.value === "/"
          ? `/${entry.name}`
          : `${activePath.value}/${entry.name}`,
    })) as ExtendedEntry[];
  });

  const iconSizeMap = "w-10 h-10"; // Larger icons for better visibility with more space
  const gridCols = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3"; // Fewer columns to allow readable file names

  // Handle breadcrumb navigation
  const getBreadcrumbs = (): Array<{
    name: string;
    path: string;
    isEllipsis?: boolean;
  }> => {
    if (activePath.value === "/") return [{ name: "Root", path: "/" }];

    const parts = activePath.value.split("/").filter(Boolean);
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

  const navigateTo = async (newPath: string) => {
    if (searchMode.value) return; // Don't navigate during search

    console.log(
      `[FileIconGrid] Navigating from ${currentPath.value} to ${newPath}`,
    );

    try {
      // Load directory if not already loaded
      if (!fileTree.value[newPath]) {
        console.log(`[FileIconGrid] Loading directory contents for ${newPath}`);
        const entries = await listDirectoryComplete({ path: newPath });
        fileTree.value = { ...fileTree.value, [newPath]: entries };
      }

      // Update current path
      console.log(`[FileIconGrid] Setting currentPath to ${newPath}`);
      currentPath.value = newPath;
      console.log(`[FileIconGrid] currentPath is now ${currentPath.value}`);
    } catch (err) {
      console.error(`Failed to navigate to ${newPath}:`, err);
    }
  };

  const handleItemClick = async (entry: ExtendedEntry, e: MouseEvent) => {
    if (searchMode.value && entry.searchResult) {
      // Handle search result click similar to FileSearchResults
      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd click: toggle selection
        const newSelection = new Set(selectedPaths.value);
        if (newSelection.has(entry.fullPath)) {
          newSelection.delete(entry.fullPath);
        } else {
          newSelection.add(entry.fullPath);
        }
        selectedPaths.value = newSelection;
      } else {
        // Regular click: select and prepare for interaction
        selectedPaths.value = new Set([entry.fullPath]);

        // Ensure parent directories are loaded and expanded for context
        await ensureParentDirectoriesLoaded(entry.fullPath);
      }
      return;
    }

    // Regular file selection logic
    handleFileSelect(entry.fullPath, e);
  };

  const handleDoubleClick = async (entry: ExtendedEntry) => {
    if (isDirectory(entry)) {
      // For directories, navigate to them
      await navigateTo(entry.fullPath);
    } else if (isAudio(entry)) {
      // For audio files, open preview
      previewFile.value = { path: entry.fullPath, type: "audio" };
    } else if (isText(entry)) {
      // For text files, open editor
      editingFileState.value = {
        path: entry.fullPath,
        initialContent: "",
        currentContent: "",
        dirty: false,
      };
    }
  };

  const handleContextMenu = (entry: ExtendedEntry, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Select the item if not already selected
    if (!selectedPaths.value.has(entry.fullPath)) {
      selectedPaths.value = new Set([entry.fullPath]);
    }

    contextMenuPosition.value = {
      x: e.pageX,
      y: e.pageY,
      entry,
    };
  };

  const ensureParentDirectoriesLoaded = async (filePath: string) => {
    const pathParts = filePath.split("/").filter(Boolean);
    const expandPaths = new Set(expandedPaths.value);

    let currentPath = "";
    for (let i = 0; i < pathParts.length - 1; i++) {
      currentPath += "/" + pathParts[i];
      expandPaths.add(currentPath);

      // Load directory if not already loaded
      if (!fileTree.value[currentPath]) {
        try {
          const entries = await listDirectoryComplete({ path: currentPath });
          fileTree.value = { ...fileTree.value, [currentPath]: entries };
        } catch (err) {
          console.error(`Failed to load directory ${currentPath}:`, err);
        }
      }
    }

    expandedPaths.value = expandPaths;
  };

  // Load initial directory if not already loaded
  if (!searchMode.value && !fileTree.value[activePath.value]) {
    listDirectoryComplete({ path: activePath.value })
      .then((entries) => {
        fileTree.value = { ...fileTree.value, [activePath.value]: entries };
      })
      .catch((err) => {
        console.error(`Failed to load directory ${activePath.value}:`, err);
      });
  }

  return (
    <div className="h-full flex flex-col">
      {/* Breadcrumb Navigation - hide during search mode */}
      {!searchMode.value && (
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
                      title={`Full path: ${activePath}`}
                    >
                      {crumb.name}
                    </span>
                  ) : (
                    <button
                      onClick={() => navigateTo(crumb.path)}
                      className={`px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 whitespace-nowrap ${
                        crumb.path === activePath.value
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
      )}

      <div className="flex-1 overflow-auto p-4">
        {/* Icon Grid */}
        <div className={`grid gap-3 ${gridCols}`} data-testid="icon-grid">
          {entries.value.map((entry, index) => {
            const isSelected = selectedPaths.value.has(entry.fullPath);
            const isDirResult = isDirectory(entry);

            return (
              <div
                key={`${entry.fullPath}-${index}`}
                className={`flex flex-col items-center p-3 rounded-lg cursor-pointer transition-colors min-h-[5rem] w-full ${
                  isSelected
                    ? "bg-blue-100 dark:bg-blue-900/30"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
                onClick={(e) => handleItemClick(entry, e)}
                onDblClick={() => handleDoubleClick(entry)}
                onContextMenu={(e) => handleContextMenu(entry, e)}
                data-path={entry.fullPath}
              >
                <img
                  src={iconUrlForEntry(entry)}
                  alt=""
                  className={`${iconSizeMap} object-contain mb-2`}
                />
                <div
                  className="text-sm text-center w-full mt-1 break-words"
                  title={entry.name}
                >
                  {/* Single-line filename display like Finder with intelligent truncation */}
                  <div className="leading-tight text-center w-full">
                    {/* Highlight search matches if in search mode */}
                    {searchMode.value && entry.searchResult ? (
                      <HighlightedText
                        text={entry.name}
                        matches={entry.searchResult.matches}
                      />
                    ) : (
                      truncateFileName(entry.name, 25)
                    )}
                    {isDirResult && (
                      <span className="ml-1 text-gray-500">/</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {/* Empty state */}
          {entries.value.length === 0 && !searchMode.value && (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
              <p>This directory is empty</p>
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenuPosition.value && (
        <FileContextMenu
          path={activePath.value}
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
