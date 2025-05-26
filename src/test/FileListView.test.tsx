import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import FileListView from "../components/FileListView";
import {
  fileTree,
  selectedPaths,
  searchMode,
  searchResults,
  listSortColumn,
  listSortDirection,
  FileEntry,
} from "../state";

// Mock the file icons
vi.mock("../lib/fileIcons", () => ({
  iconUrlForEntry: vi.fn().mockReturnValue("/mock-icon.png"),
}));

// Mock the commands
vi.mock("@/commands", () => ({
  listDirectoryComplete: vi.fn().mockResolvedValue([]),
}));

// Mock the HighlightedText component
vi.mock("../components/HighlightedText", () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));

// Mock FileContextMenu
vi.mock("../components/FileContextMenu", () => ({
  default: () => <div data-testid="context-menu">Context Menu</div>,
}));

describe("FileListView", () => {
  const mockEntries: FileEntry[] = [
    {
      name: "folder1",
      size: 0,
      attr: 0x10, // Directory
      date: 0x5799, // 2023-12-25
      time: 0x73c0, // 14:30:00
    },
    {
      name: "test.wav",
      size: 1024,
      attr: 0x20, // Archive
      date: 0x5799,
      time: 0x73c0,
    },
    {
      name: "readme.txt",
      size: 512,
      attr: 0x20,
      date: 0x5798, // 2023-12-24
      time: 0x6000, // 12:00:00
    },
  ];

  beforeEach(() => {
    // Reset all signals
    fileTree.value = { "/": mockEntries };
    selectedPaths.value = new Set();
    searchMode.value = false;
    searchResults.value = [];
    listSortColumn.value = "name";
    listSortDirection.value = "asc";
  });

  it("renders file list with correct columns", () => {
    render(<FileListView path="/" />);

    // Check column headers
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Size")).toBeInTheDocument();
    expect(screen.getByText("Modified")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();

    // Check file entries
    expect(screen.getByText("folder1")).toBeInTheDocument();
    expect(screen.getByText("test.wav")).toBeInTheDocument();
    expect(screen.getByText("readme.txt")).toBeInTheDocument();
  });

  it("displays correct file types and sizes", () => {
    render(<FileListView path="/" />);

    // Check that folder shows "Folder" type and "—" size in the correct columns
    expect(screen.getByText("Folder")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();

    // Files should show extension and formatted size
    expect(screen.getByText("WAV")).toBeInTheDocument();
    expect(screen.getByText("1.00 KB")).toBeInTheDocument();

    expect(screen.getByText("TXT")).toBeInTheDocument();
    expect(screen.getByText("512.00 Bytes")).toBeInTheDocument();
  });

  it("handles file selection correctly", () => {
    render(<FileListView path="/" />);

    const fileRow = screen.getByText("test.wav").closest("div");
    fireEvent.click(fileRow!);

    expect(selectedPaths.value.has("/test.wav")).toBe(true);
  });

  it("handles multi-selection with Ctrl+click", () => {
    render(<FileListView path="/" />);

    const file1Row = screen.getByText("test.wav").closest("div");
    const file2Row = screen.getByText("readme.txt").closest("div");

    // First click selects
    fireEvent.click(file1Row!);
    expect(selectedPaths.value.has("/test.wav")).toBe(true);

    // Ctrl+click adds to selection
    fireEvent.click(file2Row!, { ctrlKey: true });
    expect(selectedPaths.value.has("/test.wav")).toBe(true);
    expect(selectedPaths.value.has("/readme.txt")).toBe(true);
  });

  it("sorts by column when header is clicked", () => {
    render(<FileListView path="/" />);

    const sizeHeader = screen.getByText("Size");
    fireEvent.click(sizeHeader);

    expect(listSortColumn.value).toBe("size");
    expect(listSortDirection.value).toBe("asc");

    // Click again to reverse sort
    fireEvent.click(sizeHeader);
    expect(listSortDirection.value).toBe("desc");
  });

  it("shows sort indicators in column headers", () => {
    listSortColumn.value = "name";
    listSortDirection.value = "asc";

    render(<FileListView path="/" />);

    const nameHeader = screen.getByText("Name");
    expect(nameHeader.parentElement).toHaveTextContent("↑");
  });

  it("disables sorting during search mode", () => {
    searchMode.value = true;
    render(<FileListView path="/" />);

    const sizeHeader = screen.getByText("Size");
    fireEvent.click(sizeHeader);

    // Sort column should not change during search
    expect(listSortColumn.value).toBe("name");

    // Should show relevance indicator
    expect(screen.getByText("(by relevance)")).toBeInTheDocument();
  });

  it("displays search results when in search mode", () => {
    searchMode.value = true;
    searchResults.value = [
      {
        item: {
          path: "/test.wav",
          entry: mockEntries[1],
          parentPath: "/",
        },
        score: 0.8,
        matches: [{ indices: [[0, 4]] }],
      },
    ];

    render(<FileListView path="/" />);

    // Should show search result
    expect(screen.getByText("test.wav")).toBeInTheDocument();
    // Should not show other files
    expect(screen.queryByText("folder1")).not.toBeInTheDocument();
    expect(screen.queryByText("readme.txt")).not.toBeInTheDocument();
  });

  it("shows context menu on right click", () => {
    render(<FileListView path="/" />);

    const fileRow = screen.getByText("test.wav").closest("div");
    fireEvent.contextMenu(fileRow!);

    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
  });

  it("formats dates correctly", () => {
    render(<FileListView path="/" />);

    // Should show formatted dates in Modified column
    const rows = screen.getAllByText(/\d{2}\/\d{2}\/\d{2}/);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("handles double-click on directories", () => {
    render(<FileListView path="/" />);

    const folderRow = screen.getByText("folder1").closest("div");
    fireEvent.dblClick(folderRow!);

    // Just verify the double-click doesn't cause errors
    // The actual directory loading is tested in integration tests
    expect(folderRow).toBeInTheDocument();
  });

  it("applies correct styling for selected items", () => {
    selectedPaths.value = new Set(["/test.wav"]);
    render(<FileListView path="/" />);

    // Find the row element (not just the text element)
    const selectedRow = screen.getByText("test.wav").closest("[data-path]");
    expect(selectedRow).toHaveClass("bg-blue-50", "dark:bg-blue-900/30");
  });

  it("shows directory indicator for folders", () => {
    render(<FileListView path="/" />);

    // Check that the folder name has a "/" indicator
    const folderNameCell = screen.getByText("folder1").parentElement;
    expect(folderNameCell).toHaveTextContent("/");
  });
});
