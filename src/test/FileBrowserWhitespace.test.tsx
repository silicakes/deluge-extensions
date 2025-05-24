import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/preact";
import { signal } from "@preact/signals";
import FileBrowserTree from "../components/FileBrowserTree";
import { fileTree, expandedPaths, midiOut } from "../state";
import * as commands from "../commands";

describe("FileBrowserTree - Whitespace in Filenames", () => {
  const mockMidiOutput = {
    send: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    name: "Test MIDI Output",
    manufacturer: "Test",
    version: "1.0",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    fileTree.value = {};
    expandedPaths.value = new Set();
    midiOut.value = mockMidiOutput as unknown as MIDIOutput;
  });

  it("should handle file uploads with whitespace in names", async () => {
    // Mock the initial directory listing
    fileTree.value = {
      "/": [{ name: "SYNTHS", size: 0, date: 0, time: 0, attr: 0x10 }],
      "/SYNTHS": [],
    };
    expandedPaths.value = new Set(["/"]);

    // Mock commands
    const uploadFilesSpy = vi.spyOn(commands, "uploadFiles");
    const listDirectorySpy = vi.spyOn(commands, "listDirectory");

    // After upload, return the same list (simulating file not appearing)
    listDirectorySpy.mockResolvedValueOnce([]);

    uploadFilesSpy.mockImplementation(async ({ files, destDir }) => {
      // Log what we received
      console.log("[TEST] uploadFiles called with:", {
        files: files.map((f) => ({ name: f.name, size: f.size })),
        destDir,
      });

      // Check if any file has whitespace
      const filesWithWhitespace = files.filter((f) => /\s/.test(f.name));
      if (filesWithWhitespace.length > 0) {
        console.log(
          "[TEST] Files with whitespace detected:",
          filesWithWhitespace.map((f) => f.name),
        );
      }

      return Promise.resolve();
    });

    const showWarning = signal(false);
    const showCorruptedWarning = signal(false);
    render(
      <FileBrowserTree
        showWarning={showWarning}
        showCorruptedWarning={showCorruptedWarning}
      />,
    );

    // Find the SYNTHS folder
    const synthsFolder = await screen.findByTestId("file-tree-folder-SYNTHS");
    expect(synthsFolder).toBeInTheDocument();

    // Create test files - one with spaces, one without
    const fileWithSpaces = new File(
      ["test content"],
      "Test File With Spaces.xml",
      {
        type: "text/xml",
      },
    );
    const fileWithoutSpaces = new File(
      ["test content"],
      "TestFileNoSpaces.xml",
      {
        type: "text/xml",
      },
    );

    // Create dataTransfer object
    const dataTransfer = {
      files: [fileWithSpaces, fileWithoutSpaces],
      types: ["Files"],
      getData: () => "",
    };

    // The drop target is the li element itself
    fireEvent.drop(synthsFolder, { dataTransfer });

    // Since spaces are no longer a problem, no warning dialog should appear
    // The upload should proceed directly

    // Wait for upload to be called
    await waitFor(() => {
      expect(uploadFilesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          files: expect.arrayContaining([fileWithSpaces, fileWithoutSpaces]),
          destDir: "/SYNTHS",
        }),
      );
    });

    // Verify the files were passed with their original names
    const callArgs = uploadFilesSpy.mock.calls[0][0];
    expect(callArgs.files.map((f) => f.name)).toContain(
      "Test File With Spaces.xml",
    );
    expect(callArgs.files.map((f) => f.name)).toContain("TestFileNoSpaces.xml");
  });

  it("should correctly log paths for files with spaces", async () => {
    // Set up initial state
    fileTree.value = {
      "/": [{ name: "SYNTHS", size: 0, date: 0, time: 0, attr: 0x10 }],
      "/SYNTHS": [],
    };
    expandedPaths.value = new Set(["/", "/SYNTHS"]);

    // Track logs from uploadFile
    const consoleLogSpy = vi.spyOn(console, "log");

    // Mock the uploadFile command to see what paths are being used
    const uploadFileMock = vi.fn().mockResolvedValue({ ok: true });
    vi.doMock("../commands/fileSystem/uploadFile/uploadFile", () => ({
      uploadFile: uploadFileMock,
    }));

    vi.spyOn(commands, "uploadFiles").mockImplementation(
      async ({ files, destDir }) => {
        // Log the paths that would be sent
        for (const file of files) {
          const path = destDir.endsWith("/")
            ? `${destDir}${file.name}`
            : `${destDir}/${file.name}`;
          console.log("[TEST] Upload path:", path);
        }
        return Promise.resolve();
      },
    );

    vi.spyOn(commands, "listDirectory").mockResolvedValue([]);

    const showWarning = signal(false);
    const showCorruptedWarning = signal(false);
    render(
      <FileBrowserTree
        showWarning={showWarning}
        showCorruptedWarning={showCorruptedWarning}
      />,
    );

    const synthsFolder = await screen.findByTestId("file-tree-folder-SYNTHS");

    // Create a file with spaces
    const testFile = new File(["content"], "1 JP OB Str.xml", {
      type: "text/xml",
    });

    // Create dataTransfer object
    const dataTransfer = {
      files: [testFile],
      types: ["Files"],
      getData: () => "",
    };

    fireEvent.drop(synthsFolder, { dataTransfer });

    // Since spaces are no longer a problem, no warning dialog should appear
    // The upload should proceed directly

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[TEST] Upload path:",
        "/SYNTHS/1 JP OB Str.xml",
      );
    });

    consoleLogSpy.mockRestore();
  });

  it("should show that files with spaces are uploaded but don't appear after refresh", async () => {
    // Set up initial state
    fileTree.value = {
      "/": [{ name: "SYNTHS", size: 0, date: 0, time: 0, attr: 0x10 }],
      "/SYNTHS": [],
    };
    expandedPaths.value = new Set(["/", "/SYNTHS"]);

    // Mock commands
    const uploadFilesSpy = vi.spyOn(commands, "uploadFiles");
    const listDirectoryCompleteSpy = vi.spyOn(
      commands,
      "listDirectoryComplete",
    );

    // First call returns empty, second call after upload still returns empty
    // (simulating the file not appearing)
    listDirectoryCompleteSpy.mockResolvedValueOnce([]);
    listDirectoryCompleteSpy.mockResolvedValueOnce([]);

    // Track if upload was called
    let uploadCalled = false;
    uploadFilesSpy.mockImplementation(async ({ files }) => {
      uploadCalled = true;
      console.log(
        "[TEST] Files being uploaded:",
        files.map((f) => f.name),
      );
      return Promise.resolve();
    });

    const showWarning = signal(false);
    const showCorruptedWarning = signal(false);
    render(
      <FileBrowserTree
        showWarning={showWarning}
        showCorruptedWarning={showCorruptedWarning}
      />,
    );

    const synthsFolder = await screen.findByTestId("file-tree-folder-SYNTHS");

    // Create a file with spaces
    const testFile = new File(["content"], "1 JP OB Str.xml", {
      type: "text/xml",
    });

    // Create dataTransfer object
    const dataTransfer = {
      files: [testFile],
      types: ["Files"],
      getData: () => "",
    };

    fireEvent.drop(synthsFolder, { dataTransfer });

    // Since spaces are no longer a problem, no warning dialog should appear
    // The upload should proceed directly

    await waitFor(() => {
      expect(uploadCalled).toBe(true);
    });

    // Verify that listDirectoryComplete was called after upload
    await waitFor(() => {
      expect(listDirectoryCompleteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/SYNTHS",
          force: true,
        }),
      );
    });

    // The file should have been uploaded but won't appear in the listing
    expect(uploadFilesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [testFile],
        destDir: "/SYNTHS",
      }),
    );
  });

  it("should cancel upload when Cancel Upload is clicked for files with trailing spaces", async () => {
    // Set up initial state
    fileTree.value = {
      "/": [{ name: "SYNTHS", size: 0, date: 0, time: 0, attr: 0x10 }],
      "/SYNTHS": [],
    };
    expandedPaths.value = new Set(["/"]);

    // Mock commands
    const uploadFilesSpy = vi.spyOn(commands, "uploadFiles");
    uploadFilesSpy.mockResolvedValue();

    const showWarning = signal(false);
    const showCorruptedWarning = signal(false);
    render(
      <FileBrowserTree
        showWarning={showWarning}
        showCorruptedWarning={showCorruptedWarning}
      />,
    );

    // Find the SYNTHS folder
    const synthsFolder = await screen.findByTestId("file-tree-folder-SYNTHS");

    // Create a file with trailing spaces (which will trigger a warning)
    const testFile = new File(["content"], "test.txt ", {
      type: "text/plain",
    });

    // Create dataTransfer object
    const dataTransfer = {
      files: [testFile],
      types: ["Files"],
      getData: () => "",
    };

    fireEvent.drop(synthsFolder, { dataTransfer });

    // Wait for the warning dialog to appear
    const cancelButton = await screen.findByText("Cancel Upload");
    expect(cancelButton).toBeInTheDocument();

    // Click Cancel Upload button
    fireEvent.click(cancelButton);

    // Wait a bit to ensure no upload happens
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify upload was NOT called
    expect(uploadFilesSpy).not.toHaveBeenCalled();
  });
});
