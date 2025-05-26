import { useSignal, useSignalEffect } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import {
  searchQuery,
  searchMode,
  searchFocused,
  searchResults,
} from "../state";
import { searchLoading } from "../lib/fileSearch";

export default function FileSearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const showClearButton = useSignal(false);

  // Update clear button visibility
  useSignalEffect(() => {
    showClearButton.value = searchQuery.value.length > 0;
  });

  // Focus management
  useSignalEffect(() => {
    if (searchFocused.value && inputRef.current) {
      inputRef.current.focus();
    }
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchFocused.value = true;
        searchMode.value = true;
      }

      // Escape to clear search and exit search mode
      if (e.key === "Escape" && searchMode.value) {
        e.preventDefault();
        clearSearch();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    searchQuery.value = target.value;

    // Enter search mode when user starts typing
    if (target.value.length > 0) {
      searchMode.value = true;
    }
  };

  const clearSearch = () => {
    searchQuery.value = "";
    searchMode.value = false;
    searchFocused.value = false;
  };

  const handleFocus = () => {
    searchFocused.value = true;
  };

  const handleBlur = () => {
    searchFocused.value = false;
  };

  return (
    <div className="relative p-2 border-b border-gray-200 dark:border-gray-700">
      <div className="relative">
        {/* Search Icon / Loading Spinner */}
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {searchLoading.value ? (
            <svg
              className="h-4 w-4 text-blue-500 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg
              className="h-4 w-4 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          )}
        </div>

        {/* Search Input */}
        <input
          ref={inputRef}
          type="text"
          value={searchQuery.value}
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Search files... (Ctrl+F)"
          className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400
                     placeholder-gray-500 dark:placeholder-gray-400"
          data-testid="file-search-input"
        />

        {/* Clear Button */}
        {showClearButton.value && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Clear search"
            data-testid="clear-search-button"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Search Results Count */}
      {searchMode.value && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {searchLoading.value
            ? "Loading directories..."
            : searchResults.value.length > 0
              ? `${searchResults.value.length} result${searchResults.value.length === 1 ? "" : "s"} found`
              : searchQuery.value.length > 0
                ? "No results found"
                : "Start typing to search..."}
        </div>
      )}
    </div>
  );
}
