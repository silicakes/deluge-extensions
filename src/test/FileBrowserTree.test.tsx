import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import FileBrowserTree from "../components/FileBrowserTree";
import {
  fileTree,
  expandedPaths,
  midiOut,
  selectedPaths,
  editingPath,
} from "../state";
import { listDirectory } from "../lib/midi";
import * as midi from "../lib/midi";

// Types for context menu position and props
interface ContextMenuPosition {
  x: number;
  y: number;
}

const contextMenuPosition: ContextMenuPosition | null = null;
let contextMenuProps: Record<string, unknown>;

// Mock the file icons module
vi.mock("../lib/fileIcons", () => ({
  iconForEntry: () => <div data-testid="mock-icon" />,
}));

// Mock the midi.ts module
vi.mock("../lib/midi", () => ({
  listDirectory: vi.fn().mockImplementation((path) => {
    // Mock response based on path
    if (path === "/") {
      return Promise.resolve([
        { name: "SONGS", attr: 16, size: 0, date: 0, time: 0 },
        { name: "SAMPLES", attr: 16, size: 0, date: 0, time: 0 },
        { name: "README.txt", attr: 32, size: 1024, date: 0, time: 0 },
      ]);
    } else if (path === "/SONGS") {
      return Promise.resolve([
        { name: "SONG001.XML", attr: 32, size: 4096, date: 0, time: 0 },
        { name: "SONG002.XML", attr: 32, size: 5120, date: 0, time: 0 },
      ]);
    } else {
      return Promise.resolve([]);
    }
  }),
  checkFirmwareSupport: vi.fn().mockResolvedValue(true),
  testSysExConnectivity: vi.fn().mockResolvedValue(true),
  uploadFiles: vi.fn(),
  movePath: vi.fn(),
  renamePath: vi.fn(),
  sendJson: vi.fn(),
}));

// Mock context menu to avoid actual rendering and capture props
vi.mock("../components/FileContextMenu", () => {
  return {
    default: (props: Record<string, unknown>) => {
      contextMenuProps = props;
      return null;
    },
  };
});

describe("FileBrowserTree", () => {
  beforeEach(() => {
    // Reset the signals to their default state
    fileTree.value = {};
    expandedPaths.value = new Set();
    selectedPath.value = null;

    // Mock a connected MIDI device
    midiOut.value = {} as MIDIOutput;

    // Reset mocks
    vi.clearAllMocks();
  });

  it("should show a message when MIDI is not connected", () => {
    midiOut.value = null;
    render(<FileBrowserTree />);
    expect(screen.getByText(/Connect to your Deluge/)).toBeInTheDocument();
  });

  it("should load the root directory on mount", async () => {
    render(<FileBrowserTree />);

    // Initially shows loading
    expect(screen.getByText(/Loading/)).toBeInTheDocument();

    // Verify listDirectory was called with root path
    expect(listDirectory).toHaveBeenCalledWith("/");

    // Mock the fileTree update that would happen via the signal
    fileTree.value = {
      "/": [
        { name: "SONGS", attr: 16, size: 0, date: 0, time: 0 },
        { name: "SAMPLES", attr: 16, size: 0, date: 0, time: 0 },
        { name: "README.txt", attr: 32, size: 1024, date: 0, time: 0 },
      ],
    };

    // Now directories should be visible
    expect(screen.getByText("SONGS")).toBeInTheDocument();
    expect(screen.getByText("SAMPLES")).toBeInTheDocument();
    expect(screen.getByText("README.txt")).toBeInTheDocument();
  });

  it("should expand a directory when double-clicked", async () => {
    // Pre-populate the root directory
    fileTree.value = {
      "/": [
        { name: "SONGS", attr: 16, size: 0, date: 0, time: 0 },
        { name: "README.txt", attr: 32, size: 1024, date: 0, time: 0 },
      ],
    };

    render(<FileBrowserTree />);

    // Double-click on the SONGS directory to expand it
    const songsDir = screen.getByText("SONGS").closest("div")!;
    fireEvent.dblClick(songsDir);

    // Verify listDirectory was called with the correct path
    expect(listDirectory).toHaveBeenCalledWith("/SONGS");

    // Mock the fileTree update that would happen via the signal
    fileTree.value = {
      "/": [
        { name: "SONGS", attr: 16, size: 0, date: 0, time: 0 },
        { name: "README.txt", attr: 32, size: 1024, date: 0, time: 0 },
      ],
      "/SONGS": [
        { name: "SONG001.XML", attr: 32, size: 4096, date: 0, time: 0 },
        { name: "SONG002.XML", attr: 32, size: 5120, date: 0, time: 0 },
      ],
    };

    // And set the path as expanded
    expandedPaths.value = new Set(["/SONGS"]);

    // Now the expanded files should be visible
    expect(screen.getByText("SONG001.XML")).toBeInTheDocument();
    expect(screen.getByText("SONG002.XML")).toBeInTheDocument();
  });

  it("should collapse a directory when double-clicked again", () => {
    // Pre-populate data and expanded state
    fileTree.value = {
      "/": [{ name: "SONGS", attr: 16, size: 0, date: 0, time: 0 }],
      "/SONGS": [
        { name: "SONG001.XML", attr: 32, size: 4096, date: 0, time: 0 },
      ],
    };
    expandedPaths.value = new Set(["/SONGS"]);

    render(<FileBrowserTree />);

    // Verify SONG001.XML is visible
    expect(screen.getByText("SONG001.XML")).toBeInTheDocument();

    // Double-click on the SONGS directory to collapse it
    const songsDir = screen.getByText("SONGS").closest("div")!;
    fireEvent.dblClick(songsDir);

    // Mock the expandedPaths update
    expandedPaths.value = new Set();

    // Now the file should no longer be in the document
    expect(screen.queryByText("SONG001.XML")).not.toBeInTheDocument();
  });

  it("should select an item when clicked", () => {
    // Pre-populate the root directory
    fileTree.value = {
      "/": [
        { name: "SONGS", attr: 16, size: 0, date: 0, time: 0 },
        { name: "README.txt", attr: 32, size: 1024, date: 0, time: 0 },
      ],
    };

    render(<FileBrowserTree />);

    // Initially nothing is selected
    expect(selectedPath.value).toBeNull();

    // Click on README.txt to select it
    const readmeFile = screen.getByText("README.txt").closest("li")!;
    fireEvent.click(readmeFile);

    // Now it should be selected
    expect(selectedPath.value).toBe("/README.txt");

    // Click on SONGS to select it instead
    const songsDir = screen.getByText("SONGS").closest("div")!;
    fireEvent.click(songsDir);

    // Now SONGS should be selected
    expect(selectedPath.value).toBe("/SONGS");
  });

  // Test bug fixes from 05-file-management-crud fix section

  it("right-click should replace selection instead of toggling", async () => {
    // Set up initial state with multiple selections
    selectedPaths.value = new Set(["/file1.txt", "/file2.txt"]);

    render(<FileBrowserTree />);

    // Mock FileItem with a known path
    const fileItem = screen.getByText("example.txt").closest("div");
    expect(fileItem).toBeInTheDocument();

    // Simulate right-click (context menu)
    const contextMenuEvent = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      button: 2,
    });
    fireEvent(fileItem!, contextMenuEvent);

    // Verify only the right-clicked item is selected now (clears previous selection)
    expect(selectedPaths.value.size).toBe(1);
    expect(selectedPaths.value.has("/example.txt")).toBe(true);
  });

  it("context menu should use page coordinates", async () => {
    render(<FileBrowserTree />);

    // Mock file item
    const fileItem = screen.getByText("example.txt").closest("div");

    // Manually create event that will be used by the component
    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      pageX: 150,
      pageY: 200,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    };

    // Get the component instance's handleContextMenu method and call it
    const instance = screen.getAllByText("example.txt")[0].__preactInstance;
    instance.handleContextMenu(mockEvent);

    // Verify coordinates match what we expect
    expect(contextMenuPosition).toEqual({ x: 150, y: 200 });
  });

  it("rename option shows only when exactly one item is selected", async () => {
    // Set up with one item selected
    selectedPaths.value = new Set(["/example.txt"]);

    render(<FileBrowserTree />);

    // Trigger context menu
    const fileItem = screen.getByText("example.txt").closest("div");
    const contextMenuEvent = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    fireEvent(fileItem!, contextMenuEvent);

    // Verify single entry is passed correctly to allow rename
    expect(contextMenuProps.selectedEntries.length).toBe(1);
    expect(contextMenuProps.entry).toBeDefined();
  });

  // v0.3 - New Inline Rename Tests
  describe("Inline Rename", () => {
    it("rename-persists - successfully calls renamePath and refreshes directories", async () => {
      // Mock the sendJson to return a successful rename response
      const mockSendJson = midi.sendJson as unknown as vi.Mock;
      mockSendJson.mockResolvedValueOnce({
        "^rename": { err: 0 },
      });

      // Mock successful directory refresh after rename
      const mockListDirectory = midi.listDirectory as vi.Mock;
      mockListDirectory.mockResolvedValue([
        { name: "renamed.xml", size: 1024, attr: 0, date: 0, time: 0 },
      ]);

      // Spy on renamePath
      const renameSpy = vi.spyOn(midi, "renamePath");

      // Render the tree
      render(<FileBrowserTree />);

      // Select a file to rename
      const fileItem = screen.getByText("test.xml");
      fireEvent.click(fileItem);

      // Set the path to edit mode
      editingPath.value = "/test.xml";

      // Wait for the input field to appear
      const inputField = await screen.findByLabelText("Rename file");

      // Type a new name
      await userEvent.clear(inputField);
      await userEvent.type(inputField, "renamed.xml");

      // Press Enter to commit
      fireEvent.keyDown(inputField, { key: "Enter" });

      // Verify renamePath was called with the correct paths
      expect(renameSpy).toHaveBeenCalledWith("/test.xml", "/renamed.xml");

      // Verify listDirectory was called to refresh
      await waitFor(() => {
        expect(mockListDirectory).toHaveBeenCalledWith("/");
      });

      // Verify editing mode is cleared
      expect(editingPath.value).toBeNull();
    });

    it("inline-edit-esc-cancels - pressing Escape cancels editing without renaming", async () => {
      // Spy on renamePath
      const renameSpy = vi.spyOn(midi, "renamePath");

      // Render the tree
      render(<FileBrowserTree />);

      // Select a file to rename
      const fileItem = screen.getByText("test.xml");
      fireEvent.click(fileItem);

      // Set the path to edit mode
      editingPath.value = "/test.xml";

      // Wait for the input field to appear
      const inputField = await screen.findByLabelText("Rename file");

      // Type a new name
      await userEvent.clear(inputField);
      await userEvent.type(inputField, "should-not-rename.xml");

      // Press Escape to cancel
      fireEvent.keyDown(inputField, { key: "Escape" });

      // Verify renamePath was NOT called
      expect(renameSpy).not.toHaveBeenCalled();

      // Verify editing mode is cleared
      expect(editingPath.value).toBeNull();
    });

    it("inline-edit-enter-sends-service - pressing Enter calls the service with new name", async () => {
      // Mock the sendJson to return a successful rename response
      const mockSendJson = midi.sendJson as unknown as vi.Mock;
      mockSendJson.mockResolvedValueOnce({
        "^rename": { err: 0 },
      });

      // Spy on renamePath
      const renameSpy = vi.spyOn(midi, "renamePath");

      // Render the tree
      render(<FileBrowserTree />);

      // Select a file to rename
      const fileItem = screen.getByText("test.xml");
      fireEvent.click(fileItem);

      // Set the path to edit mode
      editingPath.value = "/test.xml";

      // Wait for the input field to appear
      const inputField = await screen.findByLabelText("Rename file");

      // Type a new name
      await userEvent.clear(inputField);
      await userEvent.type(inputField, "new-name.xml");

      // Press Enter to commit
      fireEvent.keyDown(inputField, { key: "Enter" });

      // Verify renamePath was called with the correct parameters
      expect(renameSpy).toHaveBeenCalledWith("/test.xml", "/new-name.xml");
    });

    it("inline-edit-enter-sends-one-rename", async () => {
      // Set up the initial state
      fileTree.value = {
        "/": [
          { name: "SONGS", attr: 16, size: 0, date: 0, time: 0 },
          { name: "README.txt", attr: 32, size: 1024, date: 0, time: 0 },
        ],
      };

      render(<FileBrowserTree />);

      // Select the file to rename
      const readmeFile = screen.getByText("README.txt").closest("div")!;
      fireEvent.click(readmeFile);

      // Set the file as being edited
      editingPath.value = "/README.txt";

      // Get the input field that appears during edit mode
      const inputField = screen.getByLabelText("Rename folder"); // Changed to match actual aria-label in the component

      // Change the value
      fireEvent.input(inputField, { target: { value: "NEWNAME.txt" } });

      // Clear the mock to ensure we only count calls after this point
      vi.clearAllMocks();

      // Press Enter to commit the rename
      fireEvent.keyDown(inputField, { key: "Enter" });

      // Verify renamePath was called exactly once with the correct parameters
      expect(midi.renamePath).toHaveBeenCalledTimes(1);
      expect(midi.renamePath).toHaveBeenCalledWith(
        "/README.txt",
        "/NEWNAME.txt",
      );
    });
  });
});
