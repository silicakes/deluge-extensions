import Fuse from "fuse.js";
import { signal } from "@preact/signals";
import {
  FileEntry,
  fileTree,
  searchQuery,
  searchResults,
  SearchResult,
} from "../state";

// Export loading state for UI
export const searchLoading = signal<boolean>(false);
import { debounce } from "./throttle";
import { listDirectoryComplete } from "@/commands";

interface SearchableItem {
  path: string;
  entry: FileEntry;
  parentPath: string;
  searchableText: string; // Combined name + path for better matching
}

class FileSearchService {
  private fuse: Fuse<SearchableItem> | null = null;
  private searchableItems: SearchableItem[] = [];
  private isLoadingDirectories = false;
  private loadedDirectories = new Set<string>();

  // Fuse.js configuration optimized for file searching
  private fuseOptions = {
    keys: [
      { name: "entry.name", weight: 0.8 },
      { name: "searchableText", weight: 0.2 },
    ],
    threshold: 0.4, // Balanced matching - not too strict, not too lenient
    distance: 80, // Moderate distance for reasonable fuzzy matching
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 1, // Allow single character matches but enhance scoring will filter
    shouldSort: true,
    findAllMatches: false, // Only find best matches
    ignoreLocation: false, // Consider position of match
    ignoreFieldNorm: false, // Consider field length for scoring
  };

  /**
   * Rebuild the search index from current fileTree
   */
  rebuildIndex(): void {
    this.searchableItems = this.flattenFileTree();
    this.fuse = new Fuse(this.searchableItems, this.fuseOptions);
  }

  /**
   * Flatten the file tree into a searchable array
   */
  private flattenFileTree(): SearchableItem[] {
    const items: SearchableItem[] = [];
    const tree = fileTree.peek();

    const traverse = (dirPath: string, entries: FileEntry[]) => {
      for (const entry of entries) {
        const fullPath =
          dirPath === "/" ? `/${entry.name}` : `${dirPath}/${entry.name}`;

        items.push({
          path: fullPath,
          entry,
          parentPath: dirPath,
          searchableText: `${entry.name} ${fullPath}`.toLowerCase(),
        });

        // Recursively add children if directory is loaded
        if (this.isDirectory(entry) && tree[fullPath]) {
          traverse(fullPath, tree[fullPath]);
        }
      }
    };

    // Start from root
    if (tree["/"]) {
      traverse("/", tree["/"]);
    }

    return items;
  }

  /**
   * Load all directories progressively to build a complete search index
   */
  private async loadAllDirectories(): Promise<void> {
    if (this.isLoadingDirectories) return;

    this.isLoadingDirectories = true;
    searchLoading.value = true;
    const tree = fileTree.peek();
    const directoriesToLoad: string[] = [];

    // Find all directories that haven't been loaded yet
    const findUnloadedDirectories = (dirPath: string, entries: FileEntry[]) => {
      for (const entry of entries) {
        if (this.isDirectory(entry)) {
          const fullPath =
            dirPath === "/" ? `/${entry.name}` : `${dirPath}/${entry.name}`;
          if (!tree[fullPath] && !this.loadedDirectories.has(fullPath)) {
            directoriesToLoad.push(fullPath);
          }
        }
      }
    };

    // Start with root directory
    if (tree["/"]) {
      findUnloadedDirectories("/", tree["/"]);
    }

    // Load directories in batches to avoid overwhelming the system
    const batchSize = 3;
    for (let i = 0; i < directoriesToLoad.length; i += batchSize) {
      const batch = directoriesToLoad.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (dirPath) => {
          try {
            const entries = await listDirectoryComplete({ path: dirPath });
            // Update the file tree
            fileTree.value = { ...fileTree.value, [dirPath]: entries };
            this.loadedDirectories.add(dirPath);

            // Recursively find more directories in the newly loaded directory
            findUnloadedDirectories(dirPath, entries);
          } catch (err) {
            console.warn(
              `Failed to load directory ${dirPath} for search:`,
              err,
            );
            this.loadedDirectories.add(dirPath); // Mark as attempted to avoid retrying
          }
        }),
      );
    }

    this.isLoadingDirectories = false;
    searchLoading.value = false;
  }

  /**
   * Perform search and update results signal
   */
  async search(query: string): Promise<void> {
    if (query.trim() === "") {
      searchResults.value = [];
      return;
    }

    // If this is the first search or we have a meaningful query, try to load more directories
    if (query.length >= 2 && !this.isLoadingDirectories) {
      await this.loadAllDirectories();
      // Rebuild index with newly loaded directories
      this.rebuildIndex();
    }

    if (!this.fuse) {
      searchResults.value = [];
      return;
    }

    const results = this.fuse.search(query, { limit: 50 });

    // Convert Fuse results to our SearchResult format and apply additional filtering
    let convertedResults: SearchResult[] = results.map((result) => ({
      item: result.item,
      score: result.score || 0,
      matches: result.matches?.map((match) => ({
        indices: match.indices,
        key: match.key,
        refIndex: match.refIndex,
        value: match.value,
      })),
    }));

    // Apply additional scoring to prioritize better matches
    convertedResults = this.enhanceScoring(convertedResults, query);

    // Filter out results with very poor scores (> 0.8) - more lenient
    convertedResults = convertedResults.filter((result) => result.score <= 0.8);

    // Limit to top 20 results for better UX
    searchResults.value = convertedResults.slice(0, 20);
  }

  /**
   * Enhance scoring to prioritize better matches
   */
  private enhanceScoring(
    results: SearchResult[],
    query: string,
  ): SearchResult[] {
    const lowerQuery = query.toLowerCase();

    return results
      .map((result) => {
        const fileName = result.item.entry.name.toLowerCase();
        const fullPath = result.item.path.toLowerCase();
        let enhancedScore = result.score;

        // Boost exact matches (including common extensions)
        if (
          fileName === lowerQuery ||
          fileName === `${lowerQuery}.wav` ||
          fileName === `${lowerQuery}.xml`
        ) {
          enhancedScore *= 0.1; // Much better score
        }
        // Boost prefix matches
        else if (fileName.startsWith(lowerQuery)) {
          enhancedScore *= 0.2; // Better score
        }
        // Boost word boundary matches
        else if (
          fileName.includes(`_${lowerQuery}`) ||
          fileName.includes(` ${lowerQuery}`) ||
          fileName.includes(`-${lowerQuery}`)
        ) {
          enhancedScore *= 0.4; // Moderately better score
        }
        // Handle path matches (like "samples/kick")
        else if (fullPath.includes(lowerQuery)) {
          enhancedScore *= 0.6; // Good score for path matches
        }
        // Regular fuzzy matches get slight penalty
        else {
          enhancedScore *= 1.1; // Slightly worse score
        }

        return {
          ...result,
          score: enhancedScore,
        };
      })
      .sort((a, b) => a.score - b.score); // Re-sort by enhanced score
  }

  /**
   * Check if entry is a directory
   */
  private isDirectory(entry: FileEntry): boolean {
    return (entry.attr & 0x10) !== 0;
  }
}

export const fileSearchService = new FileSearchService();

// Auto-rebuild index when file tree changes
fileTree.subscribe(() => {
  fileSearchService.rebuildIndex();
});

// Debounced search function to avoid excessive searching while typing
const debouncedSearch = debounce(async (query: string) => {
  await fileSearchService.search(query);
}, 150);

// Auto-search when query changes
searchQuery.subscribe((query) => {
  debouncedSearch(query);
});
