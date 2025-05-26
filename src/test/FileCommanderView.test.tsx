import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import FileCommanderView from "../components/FileCommanderView";
import {
  commanderLeftPath,
  commanderRightPath,
  commanderActivePane,
  searchMode,
  selectedPaths,
  fileTree,
  FileEntry,
} from "../state";

// Mock the file icons
vi.mock("../lib/fileIcons", () => ({
  iconUrlForEntry: vi.fn().mockReturnValue("/mock-icon.png"),
}));

// Mock the commands
vi.mock("@/commands", () => ({
  listDirectoryComplete: vi.fn().mockResolvedValue([]),
  renameFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock FileContextMenu
vi.mock("../components/FileContextMenu", () => ({
  default: () => <div data-testid="context-menu">Context Menu</div>,
}));

// Mock FileSearchResults
vi.mock("../components/FileSearchResults", () => ({
  default: () => <div data-testid="search-results">Search Results</div>,
}));

describe("FileCommanderView", () => {
  const mockEntries: FileEntry[] = [
    {
      name: "Documents",
      size: 0,
      attr: 0x10, // Directory
      date: 0x5799,
      time: 0x73c0,
    },
    {
      name: "Music",
      size: 0,
      attr: 0x10, // Directory
      date: 0x5799,
      time: 0x73c0,
    },
    {
      name: "test.wav",
      size: 1024,
      attr: 0x20, // Archive
      date: 0x5799,
      time: 0x73c0,
    },
  ];

  beforeEach(() => {
    // Reset all signals
    commanderLeftPath.value = "/";
    commanderRightPath.value = "/";
    commanderActivePane.value = "left";
    searchMode.value = false;
    selectedPaths.value = new Set();
    fileTree.value = { "/": mockEntries };
  });

  it("renders dual panes with toolbar", () => {
    render(<FileCommanderView />);

    // Check toolbar buttons
    expect(screen.getByText("Copy →")).toBeInTheDocument();
    expect(screen.getByText("Move →")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();

    // Check that both panes are rendered (should see breadcrumbs)
    const rootBreadcrumbs = screen.getAllByText("Root");
    expect(rootBreadcrumbs).toHaveLength(2); // One for each pane
  });

  it("shows search results when in search mode", () => {
    searchMode.value = true;
    render(<FileCommanderView />);

    expect(screen.getByTestId("search-results")).toBeInTheDocument();
    // Check for the header text specifically
    expect(screen.getAllByText("Search Results")).toHaveLength(2); // One in header, one in mock component
  });

  it("disables operation buttons when no files selected", () => {
    render(<FileCommanderView />);

    const copyButton = screen.getByText("Copy →");
    const moveButton = screen.getByText("Move →");
    const deleteButton = screen.getByText("Delete");

    expect(copyButton).toBeDisabled();
    expect(moveButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();
  });

  it("enables operation buttons when files are selected", () => {
    selectedPaths.value = new Set(["/test.wav"]);
    render(<FileCommanderView />);

    const copyButton = screen.getByText("Copy →");
    const moveButton = screen.getByText("Move →");
    const deleteButton = screen.getByText("Delete");

    expect(copyButton).not.toBeDisabled();
    expect(moveButton).not.toBeDisabled();
    expect(deleteButton).not.toBeDisabled();
  });

  it("shows selection count in toolbar", () => {
    selectedPaths.value = new Set(["/test.wav", "/Documents"]);
    render(<FileCommanderView />);

    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });

  it("switches active pane when pane is clicked", () => {
    render(<FileCommanderView />);

    // Initially left pane should be active
    expect(commanderActivePane.value).toBe("left");

    // Find the right pane and click it
    const rightPaneElements = screen.getAllByText("Root");
    const rightPane = rightPaneElements[1].closest("div");
    fireEvent.click(rightPane!);

    expect(commanderActivePane.value).toBe("right");
  });

  it("handles different paths in each pane", () => {
    commanderLeftPath.value = "/";
    commanderRightPath.value = "/Documents";
    fileTree.value = {
      "/": mockEntries,
      "/Documents": [
        {
          name: "file1.txt",
          size: 100,
          attr: 0x20,
          date: 0x5799,
          time: 0x73c0,
        },
      ],
    };

    render(<FileCommanderView />);

    // Left pane should show root contents
    expect(screen.getAllByText("Documents")).toHaveLength(2); // One in left pane, one in right breadcrumb
    expect(screen.getByText("Music")).toBeInTheDocument();
    expect(screen.getByText("test.wav")).toBeInTheDocument();

    // Right pane should show Documents contents
    expect(screen.getByText("file1.txt")).toBeInTheDocument();
  });

  it("applies correct styling to active pane", () => {
    commanderActivePane.value = "left";
    render(<FileCommanderView />);

    // Find pane containers
    const paneContainers = screen
      .getAllByText("Root")
      .map((el) => el.closest("div[class*='bg-blue-50']"));

    // Left pane should have active styling, right pane should not
    expect(paneContainers[0]).toBeInTheDocument(); // Left pane active
    expect(paneContainers[1]).toBeNull(); // Right pane not active
  });
});
