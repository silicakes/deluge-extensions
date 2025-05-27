import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/preact";
import { fileTree, selectedPaths, searchMode, searchResults } from "../state";
import FileIconGrid from "../components/FileIconGrid";

// Mock the commands
vi.mock("@/commands", () => ({
  listDirectoryComplete: vi.fn().mockResolvedValue([]),
}));

// Mock the file icons
vi.mock("../lib/fileIcons", () => ({
  iconUrlForEntry: vi.fn().mockReturnValue("/mock-icon.png"),
}));

// Mock the file type utilities
vi.mock("../lib/fileType", () => ({
  isDirectory: vi.fn().mockReturnValue(false),
  isAudio: vi.fn().mockReturnValue(false),
  isText: vi.fn().mockReturnValue(false),
}));

// Mock the file selection utility
vi.mock("../lib/fileSelection", () => ({
  handleFileSelect: vi.fn(),
}));

// Mock the context menu component
vi.mock("../components/FileContextMenu", () => ({
  default: () => <div data-testid="context-menu">Context Menu</div>,
}));

// Mock the highlighted text component
vi.mock("../components/HighlightedText", () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));

describe("FileIconGrid", () => {
  beforeEach(() => {
    // Reset state before each test
    fileTree.value = {};
    selectedPaths.value = new Set();
    searchMode.value = false;
    searchResults.value = [];
  });

  it("should render files in grid format", () => {
    fileTree.value = {
      "/": [
        { name: "test.wav", size: 1024, attr: 0, date: 0, time: 0 },
        { name: "sample.wav", size: 2048, attr: 0, date: 0, time: 0 },
      ],
    };

    render(<FileIconGrid />);

    expect(screen.getByTestId("icon-grid")).toBeInTheDocument();
    expect(screen.getByText("test.wav")).toBeInTheDocument();
    expect(screen.getByText("sample.wav")).toBeInTheDocument();
  });

  it("should display search results when in search mode", () => {
    searchMode.value = true;
    searchResults.value = [
      {
        item: {
          path: "/test.wav",
          entry: { name: "test.wav", size: 1024, attr: 0, date: 0, time: 0 },
          parentPath: "/",
        },
        score: 0.5,
        matches: [],
      },
    ];

    render(<FileIconGrid />);

    expect(screen.getByText("test.wav")).toBeInTheDocument();
  });

  it("should highlight selected files", () => {
    fileTree.value = {
      "/": [{ name: "test.wav", size: 1024, attr: 0, date: 0, time: 0 }],
    };
    selectedPaths.value = new Set(["/test.wav"]);

    render(<FileIconGrid />);

    // Find the file item container (the div with data-path attribute)
    const fileElement = screen.getByText("test.wav").closest("[data-path]");
    expect(fileElement).toHaveClass("bg-blue-100");
  });

  it("should apply responsive grid classes", () => {
    render(<FileIconGrid />);

    const grid = screen.getByTestId("icon-grid");
    expect(grid).toHaveClass("grid-cols-3");
    expect(grid).toHaveClass("sm:grid-cols-4");
    expect(grid).toHaveClass("lg:grid-cols-5");
  });
});
