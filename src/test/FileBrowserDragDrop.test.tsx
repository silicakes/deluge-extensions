import { render, screen, fireEvent } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FileBrowserSidebar from "../components/FileBrowserSidebar";
import {
  fileTree,
  selectedPaths,
  fileTransferInProgress,
  expandedPaths,
  FileEntry,
} from "../state";
import FileBrowserTree from "../components/FileBrowserTree";
import * as commands from "@/commands";

// Mock the lazy loading
vi.mock("preact/compat", async () => {
  const actual = await vi.importActual("preact/compat");
  return {
    ...(actual as object),
    lazy: (factory: () => Promise<{ default: unknown }>) => {
      try {
        const component = factory();
        return () => component;
      } catch (err) {
        console.error(err);
        return () => null;
      }
    },
  };
});

// No mocking of legacy midi module needed; commands module is used instead

describe("FileBrowser Drag & Drop / Upload / Download", () => {
  beforeEach(() => {
    // Reset signals
    fileTree.value = {
      "/": [
        { name: "folder1", size: 0, attr: 0x10, date: 0, time: 0 },
        { name: "file1.txt", size: 100, attr: 0, date: 0, time: 0 },
      ],
      "/folder1": [
        { name: "subfolder", size: 0, attr: 0x10, date: 0, time: 0 },
        { name: "file2.txt", size: 200, attr: 0, date: 0, time: 0 },
      ],
    };
    expandedPaths.value = new Set(["/"]);
    selectedPaths.value = new Set();
    fileTransferInProgress.value = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should show download button when a file is selected", async () => {
    render(<FileBrowserSidebar />);

    // No download button initially
    expect(screen.queryByLabelText("Download selected file")).toBeNull();

    // Select a file
    selectedPaths.value = new Set(["/file1.txt"]);

    // Now download button should appear
    expect(
      await screen.findByLabelText("Download selected file"),
    ).toBeInTheDocument();
  });

  it("should call readFile and triggerBrowserDownload when download button is clicked", async () => {
    // Setup mocks
    const readFileMock = vi.spyOn(commands, "readFile");
    const downloadMock = vi.spyOn(commands, "triggerBrowserDownload");

    // Mock the readFile to return a resolved promise
    readFileMock.mockResolvedValue(new ArrayBuffer(10));

    // Select a file
    selectedPaths.value = new Set(["/file1.txt"]);

    // Render
    render(<FileBrowserSidebar />);

    // Find and click download button
    const downloadButton = await screen.findByLabelText(
      "Download selected file",
    );
    fireEvent.click(downloadButton);

    // Wait for promises to resolve
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Verify correct functions were called
    expect(readFileMock).toHaveBeenCalledWith({ path: "/file1.txt" });
    expect(downloadMock).toHaveBeenCalled();
  });

  it("should show drop overlay when files are dragged over", () => {
    render(<FileBrowserSidebar />);

    // No overlay initially
    expect(screen.queryByText("Drop to upload")).toBeNull();

    // Create a DragEvent with files
    const dataTransfer = {
      types: ["Files"],
      files: [new File(["test content"], "test.txt")],
    };

    // Simulate drag over
    fireEvent.dragOver(screen.getByRole("complementary"), { dataTransfer });

    // Overlay should appear
    expect(screen.getByText("Drop to upload")).toBeInTheDocument();
  });

  it("should call uploadFiles when files are dropped", () => {
    // Setup mock
    const uploadMock = vi.spyOn(commands, "uploadFiles");

    // Render
    render(<FileBrowserSidebar />);

    // Create a file for the drop
    const testFile = new File(["test content"], "test.txt", {
      type: "text/plain",
    });
    const dataTransfer = {
      types: ["Files"],
      files: [testFile],
    };

    // Simulate drop
    fireEvent.drop(screen.getByRole("complementary"), { dataTransfer });

    // Verify uploadFiles was called with correct params
    expect(uploadMock).toHaveBeenCalledWith({
      files: [testFile],
      destDir: "/",
    });
  });

  it("should allow dropping files onto a folder's children area", () => {
    // Mock fileTree and expandedPaths
    const fileTreeMock: Record<string, FileEntry[]> = {
      "/": [
        {
          name: "folder1",
          attr: 0x10, // Directory flag
          size: 0,
          date: 0,
          time: 0,
        },
      ],
      "/folder1": [
        {
          name: "subfolder",
          attr: 0x10,
          size: 0,
          date: 0,
          time: 0,
        },
      ],
    };

    // Mock the state and uploadFiles function
    vi.spyOn(commands, "uploadFiles").mockResolvedValue();

    // Set up fileTree and expandedPaths signals
    fileTree.value = fileTreeMock;
    expandedPaths.value = new Set(["/folder1"]);

    render(<FileBrowserTree />);

    // Create a test file for the drop event
    const testFile = new File(["test content"], "test.txt", {
      type: "text/plain",
    });
    const dataTransfer = {
      types: ["Files"],
      files: [testFile],
    };

    // Find the folder's children container (the ul element inside the expanded folder)
    const folderLi = screen.getByText("folder1").closest("li");
    expect(folderLi).not.toBeNull();

    // Find the ul element containing the folder's children
    const childrenUl = folderLi?.querySelector("ul");
    expect(childrenUl).not.toBeNull();

    // Simulate drop on the children area
    if (childrenUl) {
      fireEvent.drop(childrenUl, { dataTransfer });

      // Verify uploadFiles was called with correct params
      expect(commands.uploadFiles).toHaveBeenCalledWith({
        files: [testFile],
        destDir: "/folder1",
      });
    }
  });

  it("should still allow dropping files onto the folder row itself", () => {
    // Mock fileTree
    const fileTreeMock: Record<string, FileEntry[]> = {
      "/": [
        {
          name: "folder1",
          attr: 0x10, // Directory flag
          size: 0,
          date: 0,
          time: 0,
        },
      ],
    };

    // Mock the state and uploadFiles function
    vi.spyOn(commands, "uploadFiles").mockResolvedValue();

    // Set up fileTree signal
    fileTree.value = fileTreeMock;

    render(<FileBrowserTree />);

    // Create a test file for the drop event
    const testFile = new File(["test content"], "test.txt", {
      type: "text/plain",
    });
    const dataTransfer = {
      types: ["Files"],
      files: [testFile],
    };

    // Find the folder's row element
    const folderLi = screen.getByText("folder1").closest("li");
    expect(folderLi).not.toBeNull();

    // Simulate drop on the folder li itself
    if (folderLi) {
      fireEvent.drop(folderLi, { dataTransfer });

      // Verify uploadFiles was called with correct params
      expect(commands.uploadFiles).toHaveBeenCalledWith({
        files: [testFile],
        destDir: "/folder1",
      });
    }
  });

  // In a real-world scenario, we would test drag between folders as well
  // but that's more complex to simulate in JSDOM
});
