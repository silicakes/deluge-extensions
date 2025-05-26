import {
  searchResults,
  selectedPaths,
  searchMode,
  searchQuery,
  expandedPaths,
  fileTree,
  previewFile,
  editingFileState,
} from "../state";
import { iconUrlForEntry } from "../lib/fileIcons";
import { isDirectory, isAudio, isText } from "../lib/fileType";
import { formatBytes } from "../lib/format";
import {
  listDirectoryComplete,
  readFile,
  triggerBrowserDownload,
} from "@/commands";
import { SearchResult, SearchResultMatch, FileEntry } from "../state";
import { useSignal } from "@preact/signals";
import FileContextMenu from "./FileContextMenu";

export default function FileSearchResults() {
  const contextMenuPosition = useSignal<{
    x: number;
    y: number;
    result: SearchResult;
  } | null>(null);

  if (!searchMode.value || searchQuery.value.trim() === "") {
    return null;
  }

  const handleResultClick = async (result: SearchResult, e: MouseEvent) => {
    // Handle different click types
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd click: toggle selection
      const newSelection = new Set(selectedPaths.value);
      if (newSelection.has(result.item.path)) {
        newSelection.delete(result.item.path);
      } else {
        newSelection.add(result.item.path);
      }
      selectedPaths.value = newSelection;
    } else {
      // Regular click: select and prepare for interaction
      selectedPaths.value = new Set([result.item.path]);

      // Ensure parent directories are loaded and expanded for context
      await ensureParentDirectoriesLoaded(result);
    }
  };

  const handleDoubleClick = async (result: SearchResult) => {
    const { item } = result;

    if (isDirectory(item.entry)) {
      // For directories, navigate to them in the tree and expand them
      await navigateToResult(result);

      // Also expand the directory itself
      const expandPaths = new Set(expandedPaths.value);
      expandPaths.add(item.path);
      expandedPaths.value = expandPaths;

      // Load directory contents if not already loaded
      if (!fileTree.value[item.path]) {
        try {
          const entries = await listDirectoryComplete({ path: item.path });
          fileTree.value = { ...fileTree.value, [item.path]: entries };
        } catch (err) {
          console.error(`Failed to load directory ${item.path}:`, err);
        }
      }
    } else if (isAudio(item.entry)) {
      // For audio files, open preview
      previewFile.value = { path: item.path, type: "audio" };
    } else if (isText(item.entry)) {
      // For text files, open editor
      editingFileState.value = {
        path: item.path,
        initialContent: "",
        currentContent: "",
        dirty: false,
      };
    }
  };

  const handleDownload = async (result: SearchResult, e: MouseEvent) => {
    e.stopPropagation();

    try {
      const data = await readFile({ path: result.item.path });
      triggerBrowserDownload(data, result.item.entry.name);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const handleContextMenu = (result: SearchResult, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Select the item if not already selected
    if (!selectedPaths.value.has(result.item.path)) {
      selectedPaths.value = new Set([result.item.path]);
    }

    contextMenuPosition.value = {
      x: e.pageX,
      y: e.pageY,
      result,
    };
  };

  const ensureParentDirectoriesLoaded = async (result: SearchResult) => {
    const { path } = result.item;

    // Expand all parent directories
    const pathParts = path.split("/").filter(Boolean);
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

  const navigateToResult = async (result: SearchResult) => {
    const { path } = result.item;

    // Exit search mode
    searchMode.value = false;
    searchQuery.value = "";

    // Select the item
    selectedPaths.value = new Set([path]);

    // Ensure parent directories are loaded
    await ensureParentDirectoriesLoaded(result);

    // Scroll to the item after a brief delay for DOM updates
    setTimeout(() => {
      const element = document.querySelector(`[data-path="${path}"]`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  };

  const highlightMatches = (text: string, matches?: SearchResultMatch[]) => {
    if (!matches || matches.length === 0) return text;

    // Find matches for the entry name
    const nameMatches = matches.find((m) => m.key === "entry.name");

    if (nameMatches && nameMatches.indices) {
      // Apply highlighting to matched characters
      return (
        <span>
          {text.split("").map((char, index) => {
            const isHighlighted = nameMatches.indices.some(
              ([start, end]) => index >= start && index <= end,
            );
            return isHighlighted ? (
              <mark key={index} className="bg-yellow-200 dark:bg-yellow-800">
                {char}
              </mark>
            ) : (
              char
            );
          })}
        </span>
      );
    }

    return text;
  };

  const formatPath = (path: string) => {
    // Show parent directory for context
    const parts = path.split("/").filter(Boolean);
    if (parts.length <= 1) return "/";

    return "/" + parts.slice(0, -1).join("/");
  };

  return (
    <div className="flex-1 overflow-y-auto" data-testid="search-results">
      {searchResults.value.length === 0 ? (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          No files found matching "{searchQuery.value}"
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {searchResults.value.map((result, index) => {
            const { item, matches } = result;
            const isSelected = selectedPaths.value.has(item.path);
            const isDirResult = isDirectory(item.entry);

            return (
              <li
                key={`${item.path}-${index}`}
                className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
                  isSelected ? "bg-blue-50 dark:bg-blue-900/30" : ""
                }`}
                onClick={(e) => handleResultClick(result, e)}
                onDblClick={() => handleDoubleClick(result)}
                onContextMenu={(e) => handleContextMenu(result, e)}
                data-testid={`search-result-${index}`}
              >
                <div className="flex items-center space-x-3">
                  {/* File Icon */}
                  <img
                    src={iconUrlForEntry(item.entry)}
                    alt=""
                    className="w-5 h-5 flex-shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    {/* File Name with Highlighting */}
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {highlightMatches(item.entry.name, matches)}
                      {isDirResult && (
                        <span className="ml-1 text-gray-500">/</span>
                      )}
                    </div>

                    {/* Path Context */}
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {formatPath(item.path)}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-1">
                    {/* Download button for files */}
                    {!isDirResult && (
                      <button
                        onClick={(e) => handleDownload(result, e)}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400"
                        title={`Download ${item.entry.name}`}
                        data-testid={`download-search-result-${index}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="w-4 h-4"
                        >
                          <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                          <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                        </svg>
                      </button>
                    )}

                    {/* File Size (for files only) */}
                    {!isDirResult && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 min-w-0">
                        {formatBytes(item.entry.size)}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Context Menu */}
      {contextMenuPosition.value && (
        <FileContextMenu
          path={contextMenuPosition.value.result.item.parentPath}
          entry={contextMenuPosition.value.result.item.entry}
          position={{
            x: contextMenuPosition.value.x,
            y: contextMenuPosition.value.y,
          }}
          isDirectory={isDirectory(contextMenuPosition.value.result.item.entry)}
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
          isFromSearchResults={true}
          onRevealInBrowser={() =>
            navigateToResult(contextMenuPosition.value!.result)
          }
        />
      )}
    </div>
  );
}
