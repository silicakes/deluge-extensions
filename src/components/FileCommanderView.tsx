import {
  commanderLeftPath,
  commanderRightPath,
  commanderActivePane,
  commanderUpdatePaths,
  searchMode,
  selectedPaths,
  fileTree,
} from "../state";
import FileSearchResults from "./FileSearchResults";
import DirectoryPane from "./DirectoryPane";
import {
  copyFile,
  moveFile,
  fsDelete,
  listDirectoryComplete,
} from "@/commands";

export default function FileCommanderView() {
  // When in search mode, show search results in the active pane
  if (searchMode.value) {
    return (
      <div className="h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex justify-between items-center p-2 border-b">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Search Results
          </div>
        </div>

        {/* Search Results */}
        <div className="flex-1 flex">
          <FileSearchResults />
        </div>
      </div>
    );
  }

  // Handle cross-pane file operations
  const handleCopyFiles = async () => {
    const selected = Array.from(selectedPaths.value);
    if (selected.length === 0) return;

    const targetPath =
      commanderActivePane.value === "left"
        ? commanderRightPath.value
        : commanderLeftPath.value;

    try {
      for (const sourcePath of selected) {
        const fileName = sourcePath.substring(sourcePath.lastIndexOf("/") + 1);
        const targetFilePath =
          targetPath === "/" ? `/${fileName}` : `${targetPath}/${fileName}`;

        console.log(`Copying ${sourcePath} to ${targetFilePath}`);

        // Use the new copyFile command
        await copyFile({ from: sourcePath, to: targetFilePath });
      }

      // Refresh the target directory to show the copied files
      const updatedEntries = await listDirectoryComplete({
        path: targetPath,
        force: true,
      });
      fileTree.value = { ...fileTree.value, [targetPath]: updatedEntries };

      // Clear selection after successful copy
      selectedPaths.value = new Set();

      console.log(
        `Successfully copied ${selected.length} files to ${targetPath}`,
      );
    } catch (error) {
      console.error("Copy failed:", error);
      alert(
        `Copy failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleMoveFiles = async () => {
    const selected = Array.from(selectedPaths.value);
    if (selected.length === 0) return;

    const targetPath =
      commanderActivePane.value === "left"
        ? commanderRightPath.value
        : commanderLeftPath.value;

    // Track unique source directories that need refreshing
    const sourceDirectories = new Set<string>();

    try {
      for (const sourcePath of selected) {
        const fileName = sourcePath.substring(sourcePath.lastIndexOf("/") + 1);
        const sourceDir =
          sourcePath.substring(0, sourcePath.lastIndexOf("/")) || "/";
        const newPath =
          targetPath === "/" ? `/${fileName}` : `${targetPath}/${fileName}`;

        console.log(`Moving ${sourcePath} to ${newPath}`);
        await moveFile({
          from: sourcePath,
          to: newPath,
          ...(commanderUpdatePaths.value && { update_paths: true }),
        });

        // Track source directory for refresh
        sourceDirectories.add(sourceDir);
      }

      // Refresh all affected directories
      const directoriesToRefresh = new Set([...sourceDirectories, targetPath]);
      const refreshPromises = Array.from(directoriesToRefresh).map(
        async (dirPath) => {
          const entries = await listDirectoryComplete({
            path: dirPath,
            force: true,
          });
          return { path: dirPath, entries };
        },
      );

      const refreshResults = await Promise.all(refreshPromises);

      // Update fileTree with all refreshed directories
      const updatedFileTree = { ...fileTree.value };
      refreshResults.forEach(({ path, entries }) => {
        updatedFileTree[path] = entries;
      });
      fileTree.value = updatedFileTree;

      // Clear selection after successful move
      selectedPaths.value = new Set();

      console.log(
        `Successfully moved ${selected.length} files to ${targetPath}`,
      );
    } catch (error) {
      console.error("Move failed:", error);
      alert(
        `Move failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleDeleteFiles = async () => {
    const selected = Array.from(selectedPaths.value);
    if (selected.length === 0) return;

    if (confirm(`Delete ${selected.length} selected items?`)) {
      // Track unique directories that need refreshing
      const directoriesToRefresh = new Set<string>();

      try {
        for (const filePath of selected) {
          console.log(`Deleting ${filePath}`);
          await fsDelete({ path: filePath });

          // Track directory for refresh
          const dirPath =
            filePath.substring(0, filePath.lastIndexOf("/")) || "/";
          directoriesToRefresh.add(dirPath);
        }

        // Refresh all affected directories
        const refreshPromises = Array.from(directoriesToRefresh).map(
          async (dirPath) => {
            const entries = await listDirectoryComplete({
              path: dirPath,
              force: true,
            });
            return { path: dirPath, entries };
          },
        );

        const refreshResults = await Promise.all(refreshPromises);

        // Update fileTree with all refreshed directories
        const updatedFileTree = { ...fileTree.value };
        refreshResults.forEach(({ path, entries }) => {
          updatedFileTree[path] = entries;
        });
        fileTree.value = updatedFileTree;

        // Clear selection after successful delete
        selectedPaths.value = new Set();

        console.log(`Successfully deleted ${selected.length} files`);
      } catch (error) {
        console.error("Delete failed:", error);
        alert(
          `Delete failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex justify-between items-center p-2 border-b">
        <div className="flex space-x-2">
          <button
            onClick={handleCopyFiles}
            disabled={selectedPaths.value.size === 0}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600"
          >
            Copy →
          </button>
          <button
            onClick={handleMoveFiles}
            disabled={selectedPaths.value.size === 0}
            className="px-3 py-1 bg-green-500 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-600"
          >
            Move →
          </button>
          <button
            onClick={handleDeleteFiles}
            disabled={selectedPaths.value.size === 0}
            className="px-3 py-1 bg-red-500 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-600"
          >
            Delete
          </button>

          {/* Update Paths Toggle */}
          <div className="flex items-center space-x-2 ml-4 pl-4 border-l border-gray-300 dark:border-gray-600">
            <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={commanderUpdatePaths.value}
                onChange={(e) =>
                  (commanderUpdatePaths.value = e.currentTarget.checked)
                }
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Update XML paths</span>
            </label>
          </div>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {selectedPaths.value.size > 0 &&
            `${selectedPaths.value.size} selected`}
        </div>
      </div>

      {/* Dual Panes */}
      <div className="flex-1 flex min-h-0">
        {/* Left Pane */}
        <div className="flex-1 min-w-0">
          <DirectoryPane
            path={commanderLeftPath.value}
            side="left"
            isActive={commanderActivePane.value === "left"}
            onActivate={() => (commanderActivePane.value = "left")}
            onPathChange={(newPath) => {
              commanderLeftPath.value = newPath;
            }}
          />
        </div>

        {/* Divider */}
        <div className="w-px bg-gray-300 dark:bg-gray-600 flex-shrink-0" />

        {/* Right Pane */}
        <div className="flex-1 min-w-0">
          <DirectoryPane
            path={commanderRightPath.value}
            side="right"
            isActive={commanderActivePane.value === "right"}
            onActivate={() => (commanderActivePane.value = "right")}
            onPathChange={(newPath) => {
              commanderRightPath.value = newPath;
            }}
          />
        </div>
      </div>
    </div>
  );
}
