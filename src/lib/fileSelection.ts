import { selectedPaths } from "../state";

/**
 * Handle file selection with support for multi-select
 */
export function handleFileSelect(path: string, e: MouseEvent) {
  if (e.ctrlKey || e.metaKey) {
    // Ctrl/Cmd click: toggle selection
    const newSelection = new Set(selectedPaths.value);
    if (newSelection.has(path)) {
      newSelection.delete(path);
    } else {
      newSelection.add(path);
    }
    selectedPaths.value = newSelection;
  } else if (e.shiftKey) {
    // Shift click: range selection (would need additional logic for range)
    // For now, just add to selection
    const newSelection = new Set(selectedPaths.value);
    newSelection.add(path);
    selectedPaths.value = newSelection;
  } else {
    // Regular click: select only this item
    selectedPaths.value = new Set([path]);
  }
}

/**
 * Sort entries with directories first
 */
export function sortEntriesDirectoriesFirst<
  T extends { name: string; attr: number },
>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const aIsDir = (a.attr & 0x10) !== 0;
    const bIsDir = (b.attr & 0x10) !== 0;

    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;

    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

/**
 * Sort entries by column and direction
 */
export function sortEntries<
  T extends {
    name: string;
    size: number;
    attr: number;
    date: number;
    time: number;
  },
>(entries: T[], sortColumn: string, sortDirection: "asc" | "desc"): T[] {
  const sorted = [...entries].sort((a, b) => {
    let comparison = 0;

    switch (sortColumn) {
      case "name":
        comparison = a.name.localeCompare(b.name, undefined, { numeric: true });
        break;
      case "size":
        comparison = a.size - b.size;
        break;
      case "date": {
        // Combine date and time for proper sorting
        const aDateTime = (a.date << 16) | a.time;
        const bDateTime = (b.date << 16) | b.time;
        comparison = aDateTime - bDateTime;
        break;
      }
      case "type": {
        const aIsDir = (a.attr & 0x10) !== 0;
        const bIsDir = (b.attr & 0x10) !== 0;
        if (aIsDir && !bIsDir) comparison = -1;
        else if (!aIsDir && bIsDir) comparison = 1;
        else {
          const aExt = a.name.split(".").pop()?.toLowerCase() || "";
          const bExt = b.name.split(".").pop()?.toLowerCase() || "";
          comparison = aExt.localeCompare(bExt);
        }
        break;
      }
      default:
        comparison = 0;
    }

    return sortDirection === "asc" ? comparison : -comparison;
  });

  return sorted;
}
