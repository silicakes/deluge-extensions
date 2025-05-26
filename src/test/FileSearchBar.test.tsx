import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { searchQuery, searchMode, searchResults } from "../state";
import FileSearchBar from "../components/FileSearchBar";

// Mock the search service
vi.mock("../lib/fileSearch", () => ({
  fileSearchService: {
    rebuildIndex: vi.fn(),
    search: vi.fn(),
  },
  searchLoading: { value: false },
}));

describe("FileSearchBar", () => {
  beforeEach(() => {
    // Reset state before each test
    searchQuery.value = "";
    searchMode.value = false;
    searchResults.value = [];
  });

  it("should render search input with placeholder", () => {
    render(<FileSearchBar />);
    const input = screen.getByTestId("file-search-input");

    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "Search files... (Ctrl+F)");
  });

  it("should update search query when typing", () => {
    render(<FileSearchBar />);
    const input = screen.getByTestId("file-search-input");

    fireEvent.input(input, { target: { value: "test" } });

    expect(searchQuery.value).toBe("test");
    expect(searchMode.value).toBe(true);
  });

  it("should show clear button when there is text", () => {
    render(<FileSearchBar />);
    const input = screen.getByTestId("file-search-input");

    fireEvent.input(input, { target: { value: "test" } });

    const clearButton = screen.getByTestId("clear-search-button");
    expect(clearButton).toBeInTheDocument();
  });

  it("should clear search when clear button is clicked", () => {
    searchQuery.value = "test";
    searchMode.value = true;

    render(<FileSearchBar />);

    const clearButton = screen.getByTestId("clear-search-button");
    fireEvent.click(clearButton);

    expect(searchQuery.value).toBe("");
    expect(searchMode.value).toBe(false);
  });

  it("should show result count when in search mode", () => {
    searchMode.value = true;
    searchQuery.value = "test";
    searchResults.value = [
      {
        item: {
          path: "/test.wav",
          entry: { name: "test.wav", size: 1024, attr: 0, date: 0, time: 0 },
          parentPath: "/",
        },
        score: 0.5,
      },
    ];

    render(<FileSearchBar />);

    expect(screen.getByText("1 result found")).toBeInTheDocument();
  });

  it("should show no results message when search returns empty", () => {
    searchMode.value = true;
    searchQuery.value = "nonexistent";
    searchResults.value = [];

    render(<FileSearchBar />);

    expect(screen.getByText("No results found")).toBeInTheDocument();
  });

  it("should show start typing message when search mode is active but no query", () => {
    searchMode.value = true;
    searchQuery.value = "";
    searchResults.value = [];

    render(<FileSearchBar />);

    expect(screen.getByText("Start typing to search...")).toBeInTheDocument();
  });
});
