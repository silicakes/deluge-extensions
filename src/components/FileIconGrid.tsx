import { useSignal, useComputed } from "@preact/signals";
import {
  iconSize,
  fileTree,
  selectedPaths,
  searchMode,
  searchResults,
  SearchResult,
  FileEntry,
} from "../state";
import { iconUrlForEntry } from "../lib/fileIcons";
import { isDirectory, isAudio, isText } from "../lib/fileType";
import { handleFileSelect } from "../lib/fileSelection";
import HighlightedText from "./HighlightedText";
import { listDirectoryComplete } from "@/commands";
import { expandedPaths, previewFile, editingFileState } from "../state";
import FileContextMenu from "./FileContextMenu";

interface ExtendedEntry extends FileEntry {
  fullPath: string;
  searchResult?: SearchResult;
}

export default function FileIconGrid({ path }: { path: string }) {
  const contextMenuPosition = useSignal<{
    x: number;
    y: number;
    entry: ExtendedEntry;
  } | null>(null);

  // Use search results when in search mode, otherwise use directory entries
  const entries = useComputed(() => {
    if (searchMode.value) {
      return searchResults.value.map((result) => ({
        ...result.item.entry,
        fullPath: result.item.path,
        searchResult: result,
      })) as ExtendedEntry[];
    }
    return (fileTree.value[path] || []).map((entry) => ({
      ...entry,
      fullPath: path === "/" ? `/${entry.name}` : `${path}/${entry.name}`,
    })) as ExtendedEntry[];
  });

  const iconSizeMap = {
    small: "w-12 h-12",
    medium: "w-16 h-16",
    large: "w-24 h-24",
  };

  const gridCols = {
    small: "grid-cols-8 sm:grid-cols-12 lg:grid-cols-16",
    medium: "grid-cols-4 sm:grid-cols-6 lg:grid-cols-8",
    large: "grid-cols-2 sm:grid-cols-4 lg:grid-cols-6",
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
      // For directories, expand them and navigate
      const expandPaths = new Set(expandedPaths.value);
      expandPaths.add(entry.fullPath);
      expandedPaths.value = expandPaths;

      // Load directory contents if not already loaded
      if (!fileTree.value[entry.fullPath]) {
        try {
          const entries = await listDirectoryComplete({ path: entry.fullPath });
          fileTree.value = { ...fileTree.value, [entry.fullPath]: entries };
        } catch (err) {
          console.error(`Failed to load directory ${entry.fullPath}:`, err);
        }
      }
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

  return (
    <div className="p-4">
      {/* Size Controls - hide during search mode */}
      {!searchMode.value && (
        <div className="mb-4 flex justify-end">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(["small", "medium", "large"] as const).map((size) => (
              <button
                key={size}
                onClick={() => (iconSize.value = size)}
                className={`px-2 py-1 rounded text-xs ${
                  iconSize.value === size
                    ? "bg-white dark:bg-gray-700 shadow-sm"
                    : "hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Icon Grid */}
      <div
        className={`grid gap-4 ${gridCols[iconSize.value]}`}
        data-testid="icon-grid"
      >
        {entries.value.map((entry, index) => {
          const isSelected = selectedPaths.value.has(entry.fullPath);
          const isDirResult = isDirectory(entry);

          return (
            <div
              key={`${entry.fullPath}-${index}`}
              className={`flex flex-col items-center p-2 rounded-lg cursor-pointer transition-colors ${
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
                className={`${iconSizeMap[iconSize.value]} object-contain mb-2`}
              />
              <span
                className="text-xs text-center truncate w-full"
                title={entry.name}
              >
                {/* Highlight search matches if in search mode */}
                {searchMode.value && entry.searchResult ? (
                  <HighlightedText
                    text={entry.name}
                    matches={entry.searchResult.matches}
                  />
                ) : (
                  entry.name
                )}
                {isDirResult && <span className="ml-1 text-gray-500">/</span>}
              </span>
            </div>
          );
        })}
      </div>

      {/* Context Menu */}
      {contextMenuPosition.value && (
        <FileContextMenu
          path={path}
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
