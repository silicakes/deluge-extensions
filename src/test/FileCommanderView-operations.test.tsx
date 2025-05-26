import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/preact";
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

// Mock the commands
vi.mock("@/commands", () => ({
  copyFile: vi.fn(),
  moveFile: vi.fn(),
  fsDelete: vi.fn(),
  listDirectoryComplete: vi.fn(),
}));

import {
  copyFile,
  moveFile,
  fsDelete,
  listDirectoryComplete,
} from "@/commands";

const mockCopyFile = vi.mocked(copyFile);
const mockMoveFile = vi.mocked(moveFile);
const mockFsDelete = vi.mocked(fsDelete);
const mockListDirectoryComplete = vi.mocked(listDirectoryComplete);

// Mock the file icons
vi.mock("../lib/fileIcons", () => ({
  iconUrlForEntry: vi.fn().mockReturnValue("/mock-icon.png"),
}));

// Mock FileSearchResults
vi.mock("../components/FileSearchResults", () => ({
  default: () => <div data-testid="search-results">Search Results</div>,
}));

// Mock DirectoryPane
vi.mock("../components/DirectoryPane", () => ({
  default: ({ onActivate }: { onActivate: () => void }) => (
    <div data-testid="directory-pane" onClick={onActivate}>
      Directory Pane
    </div>
  ),
}));

describe("FileCommanderView Operations", () => {
  const mockEntries: FileEntry[] = [
    {
      name: "test.wav",
      size: 1024,
      attr: 0x20, // File
      date: 0x5799,
      time: 0x73c0,
    },
    {
      name: "Documents",
      size: 0,
      attr: 0x10, // Directory
      date: 0x5799,
      time: 0x73c0,
    },
  ];

  beforeEach(() => {
    // Reset all signals
    commanderLeftPath.value = "/";
    commanderRightPath.value = "/KITS";
    commanderActivePane.value = "left";
    searchMode.value = false;
    selectedPaths.value = new Set(["/test.wav"]);
    fileTree.value = {
      "/": mockEntries,
      "/KITS": [],
    };

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock implementations
    mockCopyFile.mockResolvedValue(undefined);
    mockMoveFile.mockResolvedValue(undefined);
    mockFsDelete.mockResolvedValue(undefined);
    mockListDirectoryComplete.mockResolvedValue([]);
  });

  describe("Copy Operation", () => {
    it("copies selected files from left to right pane", async () => {
      render(<FileCommanderView />);

      const copyButton = screen.getByText("Copy →");
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockCopyFile).toHaveBeenCalledWith({
          from: "/test.wav",
          to: "/KITS/test.wav",
        });
        expect(mockListDirectoryComplete).toHaveBeenCalledWith({
          path: "/KITS",
          force: true,
        });
      });

      // Selection should be cleared after successful copy
      expect(selectedPaths.value.size).toBe(0);
    });

    it("copies selected files from right to left pane when right is active", async () => {
      // Add a file to the KITS directory
      const kitsEntries: FileEntry[] = [
        {
          name: "sample.wav",
          size: 2048,
          attr: 0x20, // File
          date: 0x5799,
          time: 0x73c0,
        },
      ];

      fileTree.value = {
        "/": mockEntries,
        "/KITS": kitsEntries,
      };

      commanderActivePane.value = "right";
      selectedPaths.value = new Set(["/KITS/sample.wav"]);

      render(<FileCommanderView />);

      const copyButton = screen.getByText("Copy →");
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockCopyFile).toHaveBeenCalledWith({
          from: "/KITS/sample.wav",
          to: "/sample.wav",
        });
        expect(mockListDirectoryComplete).toHaveBeenCalledWith({
          path: "/",
          force: true,
        });
      });
    });

    it("handles copy errors gracefully", async () => {
      mockCopyFile.mockRejectedValue(new Error("File not found"));
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

      render(<FileCommanderView />);

      const copyButton = screen.getByText("Copy →");
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith("Copy failed: File not found");
      });

      alertSpy.mockRestore();
    });
  });

  describe("Move Operation", () => {
    it("moves selected files from left to right pane", async () => {
      render(<FileCommanderView />);

      const moveButton = screen.getByText("Move →");
      fireEvent.click(moveButton);

      await waitFor(() => {
        expect(mockMoveFile).toHaveBeenCalledWith({
          from: "/test.wav",
          to: "/KITS/test.wav",
        });
        expect(mockListDirectoryComplete).toHaveBeenCalledWith({
          path: "/",
          force: true,
        });
        expect(mockListDirectoryComplete).toHaveBeenCalledWith({
          path: "/KITS",
          force: true,
        });
      });

      // Selection should be cleared after successful move
      expect(selectedPaths.value.size).toBe(0);
    });

    it("handles move errors gracefully", async () => {
      mockMoveFile.mockRejectedValue(new Error("Permission denied"));
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

      render(<FileCommanderView />);

      const moveButton = screen.getByText("Move →");
      fireEvent.click(moveButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith("Move failed: Permission denied");
      });

      alertSpy.mockRestore();
    });
  });

  describe("Delete Operation", () => {
    it("deletes selected files after confirmation", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

      render(<FileCommanderView />);

      const deleteButton = screen.getByText("Delete");
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(confirmSpy).toHaveBeenCalledWith("Delete 1 selected items?");
        expect(mockFsDelete).toHaveBeenCalledWith({ path: "/test.wav" });
        // Should only refresh the directory where the file was deleted from (/)
        expect(mockListDirectoryComplete).toHaveBeenCalledWith({
          path: "/",
          force: true,
        });
      });

      // Should not refresh unrelated directories
      expect(mockListDirectoryComplete).not.toHaveBeenCalledWith({
        path: "/KITS",
        force: true,
      });

      // Selection should be cleared after successful delete
      expect(selectedPaths.value.size).toBe(0);

      confirmSpy.mockRestore();
    });

    it("does not delete files if user cancels confirmation", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

      render(<FileCommanderView />);

      const deleteButton = screen.getByText("Delete");
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(confirmSpy).toHaveBeenCalledWith("Delete 1 selected items?");
      });

      expect(mockFsDelete).not.toHaveBeenCalled();
      expect(selectedPaths.value.size).toBe(1); // Selection should remain

      confirmSpy.mockRestore();
    });

    it("handles delete errors gracefully", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
      mockFsDelete.mockRejectedValue(new Error("File is read-only"));

      render(<FileCommanderView />);

      const deleteButton = screen.getByText("Delete");
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          "Delete failed: File is read-only",
        );
      });

      confirmSpy.mockRestore();
      alertSpy.mockRestore();
    });
  });

  describe("Button States", () => {
    it("disables operation buttons when no files are selected", () => {
      selectedPaths.value = new Set();

      render(<FileCommanderView />);

      const copyButton = screen.getByText("Copy →");
      const moveButton = screen.getByText("Move →");
      const deleteButton = screen.getByText("Delete");

      expect(copyButton).toBeDisabled();
      expect(moveButton).toBeDisabled();
      expect(deleteButton).toBeDisabled();
    });

    it("enables operation buttons when files are selected", () => {
      render(<FileCommanderView />);

      const copyButton = screen.getByText("Copy →");
      const moveButton = screen.getByText("Move →");
      const deleteButton = screen.getByText("Delete");

      expect(copyButton).not.toBeDisabled();
      expect(moveButton).not.toBeDisabled();
      expect(deleteButton).not.toBeDisabled();
    });
  });
});
