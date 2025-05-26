import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/preact";
import DirectoryPane from "../components/DirectoryPane";
import {
  fileTree,
  selectedPaths,
  previewFile,
  editingFileState,
  FileEntry,
} from "../state";

// Mock the file icons
vi.mock("../lib/fileIcons", () => ({
  iconUrlForEntry: vi.fn().mockReturnValue("/mock-icon.png"),
}));

// Mock the commands
vi.mock("@/commands", () => ({
  listDirectoryComplete: vi.fn(),
}));

import { listDirectoryComplete } from "@/commands";
const mockListDirectory = vi.mocked(listDirectoryComplete);

// Mock FileContextMenu
vi.mock("../components/FileContextMenu", () => ({
  default: () => <div data-testid="context-menu">Context Menu</div>,
}));

describe("DirectoryPane", () => {
  const mockEntries: FileEntry[] = [
    {
      name: "Documents",
      size: 0,
      attr: 0x10, // Directory
      date: 0x5799,
      time: 0x73c0,
    },
    {
      name: "song.wav",
      size: 2048,
      attr: 0x20, // Archive
      date: 0x5799,
      time: 0x73c0,
    },
    {
      name: "notes.txt",
      size: 256,
      attr: 0x20,
      date: 0x5798,
      time: 0x6000,
    },
  ];

  const defaultProps = {
    path: "/",
    side: "left" as const,
    isActive: true,
    onActivate: vi.fn(),
    onPathChange: vi.fn(),
  };

  beforeEach(() => {
    // Reset all signals and mocks
    fileTree.value = { "/": mockEntries };
    selectedPaths.value = new Set();
    previewFile.value = null;
    editingFileState.value = null;
    mockListDirectory.mockClear();
    defaultProps.onActivate.mockClear();
    defaultProps.onPathChange.mockClear();
  });

  it("renders directory contents correctly", () => {
    render(<DirectoryPane {...defaultProps} />);

    // Check that all entries are displayed
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("song.wav")).toBeInTheDocument();
    expect(screen.getByText("notes.txt")).toBeInTheDocument();

    // Check that directory has "/" indicator
    expect(screen.getByText("Documents").parentElement).toHaveTextContent("/");

    // Check that file sizes are displayed
    expect(screen.getByText("2.00 KB")).toBeInTheDocument();
    expect(screen.getByText("256.00 Bytes")).toBeInTheDocument();
  });

  it("shows breadcrumb navigation for root", () => {
    render(<DirectoryPane {...defaultProps} />);

    expect(screen.getByText("Root")).toBeInTheDocument();
  });

  it("shows breadcrumb navigation for nested path", () => {
    const props = { ...defaultProps, path: "/Documents/Projects" };
    render(<DirectoryPane {...props} />);

    expect(screen.getByText("Root")).toBeInTheDocument();
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();
  });

  it("handles file selection correctly", () => {
    render(<DirectoryPane {...defaultProps} />);

    const fileElement = screen.getByText("song.wav").closest("div");
    fireEvent.click(fileElement!);

    expect(selectedPaths.value.has("/song.wav")).toBe(true);
    expect(defaultProps.onActivate).toHaveBeenCalled();
  });

  it("handles multi-selection with Ctrl+click", () => {
    render(<DirectoryPane {...defaultProps} />);

    const file1 = screen.getByText("song.wav").closest("div");
    const file2 = screen.getByText("notes.txt").closest("div");

    // First click selects
    fireEvent.click(file1!);
    expect(selectedPaths.value.has("/song.wav")).toBe(true);

    // Ctrl+click adds to selection
    fireEvent.click(file2!, { ctrlKey: true });
    expect(selectedPaths.value.has("/song.wav")).toBe(true);
    expect(selectedPaths.value.has("/notes.txt")).toBe(true);
  });

  it("navigates to directory on double-click", async () => {
    mockListDirectory.mockResolvedValue([]);

    render(<DirectoryPane {...defaultProps} />);

    const dirElement = screen.getByText("Documents").closest("div");
    fireEvent.dblClick(dirElement!);

    await waitFor(() => {
      expect(mockListDirectory).toHaveBeenCalledWith({ path: "/Documents" });
      expect(defaultProps.onPathChange).toHaveBeenCalledWith("/Documents");
    });
  });

  it("opens audio preview on double-click", () => {
    render(<DirectoryPane {...defaultProps} />);

    const audioFile = screen.getByText("song.wav").closest("div");
    fireEvent.dblClick(audioFile!);

    expect(previewFile.value).toEqual({
      path: "/song.wav",
      type: "audio",
    });
  });

  it("opens text editor on double-click", () => {
    render(<DirectoryPane {...defaultProps} />);

    const textFile = screen.getByText("notes.txt").closest("div");
    fireEvent.dblClick(textFile!);

    expect(editingFileState.value).toEqual({
      path: "/notes.txt",
      initialContent: "",
      currentContent: "",
      dirty: false,
    });
  });

  it("shows context menu on right-click", () => {
    render(<DirectoryPane {...defaultProps} />);

    const fileElement = screen.getByText("song.wav").closest("div");
    fireEvent.contextMenu(fileElement!);

    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
  });

  it("applies active styling when pane is active", () => {
    render(<DirectoryPane {...defaultProps} isActive={true} />);

    const paneElement = screen
      .getByText("Documents")
      .closest("div[class*='bg-blue-50']");
    expect(paneElement).toBeInTheDocument();
  });

  it("does not apply active styling when pane is inactive", () => {
    render(<DirectoryPane {...defaultProps} isActive={false} />);

    const paneElement = screen
      .getByText("Documents")
      .closest("div[class*='bg-blue-50']");
    expect(paneElement).not.toBeInTheDocument();
  });

  it("shows loading state when loading directory", async () => {
    // Start with empty file tree to trigger loading
    fileTree.value = {};
    mockListDirectory.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<DirectoryPane {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  it("shows error state when directory loading fails", async () => {
    fileTree.value = {};
    mockListDirectory.mockRejectedValue(new Error("Network error"));

    render(<DirectoryPane {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });
  });

  it("shows empty directory message when no entries", () => {
    fileTree.value = { "/": [] };
    render(<DirectoryPane {...defaultProps} />);

    expect(screen.getByText("Empty directory")).toBeInTheDocument();
  });

  it("handles breadcrumb navigation", async () => {
    mockListDirectory.mockResolvedValue([]);
    // Start with a nested path that already exists in fileTree to avoid initial load
    fileTree.value = { "/Documents/Projects": [] };
    const props = { ...defaultProps, path: "/Documents/Projects" };
    render(<DirectoryPane {...props} />);

    // Clear any calls from initial render
    mockListDirectory.mockClear();

    const rootBreadcrumb = screen.getByText("Root");
    fireEvent.click(rootBreadcrumb);

    await waitFor(() => {
      expect(mockListDirectory).toHaveBeenCalledWith({ path: "/" });
      expect(defaultProps.onPathChange).toHaveBeenCalledWith("/");
    });
  });

  it("activates pane when clicked", () => {
    render(<DirectoryPane {...defaultProps} isActive={false} />);

    const paneElement = screen.getByText("Root").closest("div");
    fireEvent.click(paneElement!);

    expect(defaultProps.onActivate).toHaveBeenCalled();
  });

  it("applies correct styling for selected items", () => {
    selectedPaths.value = new Set(["/song.wav"]);
    render(<DirectoryPane {...defaultProps} />);

    const selectedElement = screen
      .getByText("song.wav")
      .closest("div[data-path]");
    expect(selectedElement).toHaveClass("bg-blue-100", "dark:bg-blue-900/30");
  });
});
