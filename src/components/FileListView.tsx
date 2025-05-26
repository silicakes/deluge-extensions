import { useSignal, useComputed } from "@preact/signals";
import { JSX } from "preact";
import {
  fileTree,
  selectedPaths,
  listSortColumn,
  listSortDirection,
  searchMode,
  searchResults,
  SearchResult,
  FileEntry,
  expandedPaths,
  previewFile,
  editingFileState,
} from "../state";
import { formatBytes, formatDate } from "../lib/format";
import { iconUrlForEntry } from "../lib/fileIcons";
import { isDirectory, isAudio, isText } from "../lib/fileType";
import { handleFileSelect, sortEntries } from "../lib/fileSelection";
import HighlightedText from "./HighlightedText";
import { listDirectoryComplete } from "@/commands";
import FileContextMenu from "./FileContextMenu";

interface ExtendedEntry extends FileEntry {
  fullPath: string;
  searchResult?: SearchResult;
}

interface Column {
  key: string;
  label: string;
  width: string;
  sortable: boolean;
  render: (entry: ExtendedEntry, path: string) => JSX.Element | string;
}

const columns: Column[] = [
  {
    key: "name",
    label: "Name",
    width: "flex-1",
    sortable: true,
    render: (entry) => (
      <div className="flex items-center">
        <img src={iconUrlForEntry(entry)} className="w-4 h-4 mr-2" alt="" />
        {/* Show highlighting for search results */}
        {searchMode.value && entry.searchResult ? (
          <HighlightedText
            text={entry.name}
            matches={entry.searchResult.matches}
          />
        ) : (
          entry.name
        )}
        {isDirectory(entry) && <span className="ml-1 text-gray-500">/</span>}
      </div>
    ),
  },
  {
    key: "size",
    label: "Size",
    width: "w-20",
    sortable: true,
    render: (entry) => (isDirectory(entry) ? "—" : formatBytes(entry.size)),
  },
  {
    key: "date",
    label: "Modified",
    width: "w-32",
    sortable: true,
    render: (entry) => formatDate(entry.date, entry.time),
  },
  {
    key: "type",
    label: "Type",
    width: "w-24",
    sortable: true,
    render: (entry) => {
      if (isDirectory(entry)) return "Folder";
      const ext = entry.name.split(".").pop()?.toUpperCase();
      return ext || "File";
    },
  },
];

export default function FileListView({ path }: { path: string }) {
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

    const rawEntries = (fileTree.value[path] || []).map((entry) => ({
      ...entry,
      fullPath: path === "/" ? `/${entry.name}` : `${path}/${entry.name}`,
    })) as ExtendedEntry[];

    return sortEntries(
      rawEntries,
      listSortColumn.value,
      listSortDirection.value,
    );
  });

  const handleSort = (columnKey: string) => {
    // Don't allow sorting during search mode - search has its own relevance sorting
    if (searchMode.value) return;

    if (listSortColumn.value === columnKey) {
      listSortDirection.value =
        listSortDirection.value === "asc" ? "desc" : "asc";
    } else {
      listSortColumn.value = columnKey;
      listSortDirection.value = "asc";
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        {columns.map((column) => (
          <div
            key={column.key}
            className={`${column.width} px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 ${
              column.sortable && !searchMode.value
                ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                : ""
            }`}
            onClick={() => column.sortable && handleSort(column.key)}
          >
            <div className="flex items-center">
              {column.label}
              {column.sortable &&
                !searchMode.value &&
                listSortColumn.value === column.key && (
                  <span className="ml-1">
                    {listSortDirection.value === "asc" ? "↑" : "↓"}
                  </span>
                )}
              {searchMode.value && column.key === "name" && (
                <span className="ml-1 text-xs text-gray-500">
                  (by relevance)
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {entries.value.map((entry, index) => {
          const isSelected = selectedPaths.value.has(entry.fullPath);

          return (
            <div
              key={`${entry.fullPath}-${index}`}
              className={`flex border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
                isSelected ? "bg-blue-50 dark:bg-blue-900/30" : ""
              }`}
              onClick={(e) => handleItemClick(entry, e)}
              onDblClick={() => handleDoubleClick(entry)}
              onContextMenu={(e) => handleContextMenu(entry, e)}
              data-path={entry.fullPath}
            >
              {columns.map((column) => (
                <div
                  key={column.key}
                  className={`${column.width} px-3 py-2 text-sm`}
                >
                  {column.render(entry, entry.fullPath)}
                </div>
              ))}
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
