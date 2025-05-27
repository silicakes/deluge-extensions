import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/preact";
import BasicTextEditorModal from "./BasicTextEditorModal";
import { editingFileState } from "../state";
import { readTextFile, writeTextFile } from "../lib/fileEditor";

// Mock the file editor functions
vi.mock("../lib/fileEditor", () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

const mockReadTextFile = vi.mocked(readTextFile);
const mockWriteTextFile = vi.mocked(writeTextFile);

describe("BasicTextEditorModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editingFileState.value = null;
  });

  afterEach(() => {
    editingFileState.value = null;
  });

  it("should not render when editingFileState is null", () => {
    render(<BasicTextEditorModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should preserve line breaks when editing content", async () => {
    const testContent = "Line 1\nLine 2\nLine 3";
    mockReadTextFile.mockResolvedValue(testContent);
    mockWriteTextFile.mockResolvedValue(undefined);

    // Initialize editing state
    editingFileState.value = {
      path: "/test.txt",
      initialContent: "",
      currentContent: "",
      dirty: false,
    };

    render(<BasicTextEditorModal />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    });

    // Wait for content to be loaded
    await waitFor(() => {
      expect(editingFileState.value?.currentContent).toBe(testContent);
    });

    const editor = document.querySelector(
      '[contenteditable="true"]',
    ) as HTMLElement;

    // Simulate typing additional content
    const newContent = testContent + "\nLine 4";

    // Mock the innerText property
    Object.defineProperty(editor, "innerText", {
      get: () => newContent,
      set: vi.fn(),
      configurable: true,
    });

    // Trigger input event
    fireEvent.input(editor);

    // Check that the state is updated with line breaks preserved
    expect(editingFileState.value?.currentContent).toBe(newContent);
    expect(editingFileState.value?.dirty).toBe(true);

    // Save the file
    const saveButton = screen.getByText("Save");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockWriteTextFile).toHaveBeenCalledWith("/test.txt", newContent);
    });
  });

  it("should handle empty content correctly", async () => {
    const testContent = "";
    mockReadTextFile.mockResolvedValue(testContent);
    mockWriteTextFile.mockResolvedValue(undefined);

    // Initialize editing state
    editingFileState.value = {
      path: "/empty.txt",
      initialContent: "",
      currentContent: "",
      dirty: false,
    };

    render(<BasicTextEditorModal />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    });

    const editor = document.querySelector(
      '[contenteditable="true"]',
    ) as HTMLElement;

    // Add some content
    const newContent = "Some new content";

    // Mock the innerText property
    Object.defineProperty(editor, "innerText", {
      get: () => newContent,
      set: vi.fn(),
      configurable: true,
    });

    // Trigger input event
    fireEvent.input(editor);

    // Check that the state is updated
    expect(editingFileState.value?.currentContent).toBe(newContent);
    expect(editingFileState.value?.dirty).toBe(true);

    // Save the file
    const saveButton = screen.getByText("Save");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockWriteTextFile).toHaveBeenCalledWith("/empty.txt", newContent);
    });
  });
});
