import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeTextFile, readTextFile } from "../lib/fileEditor";

// Mock the underlying commands
vi.mock("@/commands", () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
}));

import { writeFile, readFile } from "@/commands";

const mockWriteFile = vi.mocked(writeFile);
const mockReadFile = vi.mocked(readFile);

describe("fileEditor integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should preserve content with line breaks through write/read cycle", async () => {
    const originalContent = "Line 1\nLine 2\nLine 3\n\nEmpty line above";

    // Mock writeFile to capture the data
    let capturedData: Uint8Array | null = null;
    mockWriteFile.mockImplementation(async ({ data }) => {
      capturedData = data;
    });

    // Write the content
    await writeTextFile("/test.txt", originalContent);

    // Verify writeFile was called
    expect(mockWriteFile).toHaveBeenCalledWith({
      path: "/test.txt",
      data: expect.any(Uint8Array),
    });

    // Mock readFile to return the captured data
    mockReadFile.mockImplementation(async () => {
      if (!capturedData) throw new Error("No data captured");
      return capturedData.buffer;
    });

    // Read the content back
    const readContent = await readTextFile("/test.txt");

    // Verify the content is preserved exactly
    expect(readContent).toBe(originalContent);
  });

  it("should handle empty content correctly", async () => {
    const originalContent = "";

    // Mock writeFile to capture the data
    let capturedData: Uint8Array | null = null;
    mockWriteFile.mockImplementation(async ({ data }) => {
      capturedData = data;
    });

    // Write the empty content
    await writeTextFile("/empty.txt", originalContent);

    // Verify writeFile was called with empty data
    expect(mockWriteFile).toHaveBeenCalledWith({
      path: "/empty.txt",
      data: expect.any(Uint8Array),
    });

    // Verify the captured data is empty
    expect(capturedData).toBeTruthy();
    expect(capturedData!.length).toBe(0);

    // Mock readFile to return the captured data
    mockReadFile.mockImplementation(async () => {
      if (!capturedData) throw new Error("No data captured");
      return capturedData.buffer;
    });

    // Read the content back
    const readContent = await readTextFile("/empty.txt");

    // Verify the content is still empty
    expect(readContent).toBe(originalContent);
  });

  it("should handle content with special characters", async () => {
    const originalContent =
      "Hello 🌍!\nSpecial chars: αβγ δεζ\nTabs:\tand spaces   ";

    // Mock writeFile to capture the data
    let capturedData: Uint8Array | null = null;
    mockWriteFile.mockImplementation(async ({ data }) => {
      capturedData = data;
    });

    // Write the content
    await writeTextFile("/special.txt", originalContent);

    // Mock readFile to return the captured data
    mockReadFile.mockImplementation(async () => {
      if (!capturedData) throw new Error("No data captured");
      return capturedData.buffer;
    });

    // Read the content back
    const readContent = await readTextFile("/special.txt");

    // Verify the content is preserved exactly
    expect(readContent).toBe(originalContent);
  });

  it("should demonstrate the difference between textContent and innerText behavior", () => {
    // Create a test div to demonstrate the difference
    const testDiv = document.createElement("div");
    testDiv.innerHTML = "Line 1<br>Line 2<br><br>Line 4";
    document.body.appendChild(testDiv);

    // textContent strips formatting and doesn't preserve line breaks from <br>
    const textContentResult = testDiv.textContent || "";

    // innerText preserves line breaks from <br> tags
    const innerTextResult = testDiv.innerText || "";

    // Clean up
    document.body.removeChild(testDiv);

    // textContent should be: "Line 1Line 2Line 4" (no line breaks)
    expect(textContentResult).toBe("Line 1Line 2Line 4");

    // innerText should be: "Line 1\nLine 2\n\nLine 4" (with line breaks)
    expect(innerTextResult).toBe("Line 1\nLine 2\n\nLine 4");

    console.log("textContent result:", JSON.stringify(textContentResult));
    console.log("innerText result:", JSON.stringify(innerTextResult));
  });
});
