import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import {
  searchResults,
  searchMode,
  searchQuery,
  selectedPaths,
  fileTree,
} from "../state";
import FileSearchResults from "../components/FileSearchResults";

// Mock the commands
vi.mock("@/commands", () => ({
  listDirectoryComplete: vi.fn().mockResolvedValue([]),
  readFile: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  triggerBrowserDownload: vi.fn(),
}));

// Mock the file icons
vi.mock("../lib/fileIcons", () => ({
  iconUrlForEntry: vi.fn().mockReturnValue("/mock-icon.png"),
}));

describe("FileSearchResults", () => {
  beforeEach(() => {
    // Reset state before each test
    searchResults.value = [];
    searchMode.value = false;
    searchQuery.value = "";
    selectedPaths.value = new Set();
    fileTree.value = {};
  });

  it("should render nothing when not in search mode", () => {
    searchMode.value = false;
    render(<FileSearchResults />);

    expect(screen.queryByTestId("search-results")).not.toBeInTheDocument();
  });

  it("should render no results message when search returns empty", () => {
    searchMode.value = true;
    searchQuery.value = "test";
    searchResults.value = [];

    render(<FileSearchResults />);

    expect(
      screen.getByText('No files found matching "test"'),
    ).toBeInTheDocument();
  });

  it("should render search results with download buttons", () => {
    searchMode.value = true;
    searchQuery.value = "test";
    searchResults.value = [
      {
        item: {
          path: "/test.wav",
          entry: { name: "test.wav", size: 1024, attr: 0, date: 0, time: 0 },
          parentPath: "/",
        },
        score: 0.1,
      },
      {
        item: {
          path: "/folder",
          entry: { name: "folder", size: 0, attr: 0x10, date: 0, time: 0 },
          parentPath: "/",
        },
        score: 0.2,
      },
    ];

    render(<FileSearchResults />);

    // Should show both results
    expect(screen.getByText("test.wav")).toBeInTheDocument();
    expect(screen.getByText("folder")).toBeInTheDocument();

    // Should show download button for file but not directory
    expect(screen.getByTestId("download-search-result-0")).toBeInTheDocument();
    expect(
      screen.queryByTestId("download-search-result-1"),
    ).not.toBeInTheDocument();
  });

  it("should select file when clicked", () => {
    searchMode.value = true;
    searchQuery.value = "test"; // Need to set query for component to render
    searchResults.value = [
      {
        item: {
          path: "/test.wav",
          entry: { name: "test.wav", size: 1024, attr: 0, date: 0, time: 0 },
          parentPath: "/",
        },
        score: 0.1,
      },
    ];

    render(<FileSearchResults />);

    const resultItem = screen.getByTestId("search-result-0");
    fireEvent.click(resultItem);

    expect(selectedPaths.value.has("/test.wav")).toBe(true);
  });

  it("should toggle selection with Ctrl+click", () => {
    searchMode.value = true;
    searchQuery.value = "test";
    searchResults.value = [
      {
        item: {
          path: "/test.wav",
          entry: { name: "test.wav", size: 1024, attr: 0, date: 0, time: 0 },
          parentPath: "/",
        },
        score: 0.1,
      },
    ];

    render(<FileSearchResults />);

    const resultItem = screen.getByTestId("search-result-0");

    // First click selects
    fireEvent.click(resultItem, { ctrlKey: true });
    expect(selectedPaths.value.has("/test.wav")).toBe(true);

    // Second Ctrl+click deselects
    fireEvent.click(resultItem, { ctrlKey: true });
    expect(selectedPaths.value.has("/test.wav")).toBe(false);
  });

  it("should show context menu on right click", () => {
    searchMode.value = true;
    searchQuery.value = "test";
    searchResults.value = [
      {
        item: {
          path: "/test.wav",
          entry: { name: "test.wav", size: 1024, attr: 0, date: 0, time: 0 },
          parentPath: "/",
        },
        score: 0.1,
      },
    ];

    render(<FileSearchResults />);

    const resultItem = screen.getByTestId("search-result-0");
    fireEvent.contextMenu(resultItem);

    // Should select the item and show context menu
    expect(selectedPaths.value.has("/test.wav")).toBe(true);
    // Context menu component should be rendered (we can't easily test its visibility)
  });

  it("should highlight search matches", () => {
    searchMode.value = true;
    searchQuery.value = "test";
    searchResults.value = [
      {
        item: {
          path: "/test.wav",
          entry: { name: "test.wav", size: 1024, attr: 0, date: 0, time: 0 },
          parentPath: "/",
        },
        score: 0.1,
        matches: [
          {
            indices: [[0, 3]],
            key: "entry.name",
            refIndex: 0,
            value: "test.wav",
          },
        ],
      },
    ];

    const { container } = render(<FileSearchResults />);

    // Should have highlighted text - look for the mark elements
    const markElements = container.querySelectorAll("mark");
    expect(markElements.length).toBeGreaterThan(0);
    // The highlighting splits by character, so we get multiple mark elements
    const highlightedText = Array.from(markElements)
      .map((el) => el.textContent)
      .join("");
    expect(highlightedText).toBe("test");
  });

  it("should show 'Reveal in File Browser' option in context menu", () => {
    searchMode.value = true;
    searchQuery.value = "test";
    searchResults.value = [
      {
        item: {
          path: "/test.wav",
          entry: { name: "test.wav", size: 1024, attr: 0, date: 0, time: 0 },
          parentPath: "/",
        },
        score: 0.1,
      },
    ];

    render(<FileSearchResults />);

    const resultItem = screen.getByTestId("search-result-0");
    fireEvent.contextMenu(resultItem);

    // Should show the "Reveal in File Browser" option
    expect(screen.getByText("Reveal in File Browser")).toBeInTheDocument();
  });
});
