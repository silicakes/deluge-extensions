import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeTextFile, readTextFile } from "./fileEditor";
import { writeFile, readFile } from "@/commands";

// Mock the commands
vi.mock("@/commands", () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
}));

const mockWriteFile = vi.mocked(writeFile);
const mockReadFile = vi.mocked(readFile);

describe("fileEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("writeTextFile", () => {
    it("should encode text content correctly", async () => {
      const testContent = "Hello, World!\nThis is a test file.";
      const testPath = "/test.txt";

      mockWriteFile.mockResolvedValue(undefined);

      await writeTextFile(testPath, testContent);

      expect(mockWriteFile).toHaveBeenCalledWith({
        path: testPath,
        data: expect.any(Uint8Array),
      });

      // Verify the encoded data matches the original content
      const call = mockWriteFile.mock.calls[0][0];
      const encodedData = call.data;
      const decoder = new TextDecoder();
      const decodedContent = decoder.decode(encodedData);

      expect(decodedContent).toBe(testContent);
    });

    it("should handle empty content", async () => {
      const testContent = "";
      const testPath = "/empty.txt";

      mockWriteFile.mockResolvedValue(undefined);

      await writeTextFile(testPath, testContent);

      expect(mockWriteFile).toHaveBeenCalledWith({
        path: testPath,
        data: expect.any(Uint8Array),
      });

      const call = mockWriteFile.mock.calls[0][0];
      const encodedData = call.data;
      expect(encodedData.length).toBe(0);
    });

    it("should handle unicode content", async () => {
      const testContent = "Hello 🌍! Unicode test: αβγ δεζ";
      const testPath = "/unicode.txt";

      mockWriteFile.mockResolvedValue(undefined);

      await writeTextFile(testPath, testContent);

      expect(mockWriteFile).toHaveBeenCalledWith({
        path: testPath,
        data: expect.any(Uint8Array),
      });

      const call = mockWriteFile.mock.calls[0][0];
      const encodedData = call.data;
      const decoder = new TextDecoder();
      const decodedContent = decoder.decode(encodedData);

      expect(decodedContent).toBe(testContent);
    });

    it("should propagate writeFile errors", async () => {
      const testContent = "Test content";
      const testPath = "/test.txt";
      const error = new Error("Write failed");

      mockWriteFile.mockRejectedValue(error);

      await expect(writeTextFile(testPath, testContent)).rejects.toThrow(
        "Write failed",
      );
    });
  });

  describe("readTextFile", () => {
    it("should decode buffer content correctly", async () => {
      const testContent = "Hello, World!\nThis is a test file.";
      const encoder = new TextEncoder();
      const buffer = encoder.encode(testContent).buffer;

      mockReadFile.mockResolvedValue(buffer);

      const result = await readTextFile("/test.txt");

      expect(result).toBe(testContent);
    });

    it("should handle empty files", async () => {
      const buffer = new ArrayBuffer(0);

      mockReadFile.mockResolvedValue(buffer);

      const result = await readTextFile("/empty.txt");

      expect(result).toBe("");
    });

    it("should handle unicode content", async () => {
      const testContent = "Hello 🌍! Unicode test: αβγ δεζ";
      const encoder = new TextEncoder();
      const buffer = encoder.encode(testContent).buffer;

      mockReadFile.mockResolvedValue(buffer);

      const result = await readTextFile("/unicode.txt");

      expect(result).toBe(testContent);
    });

    it("should use chunked decoding for large files", async () => {
      // Create a large content that would trigger chunked decoding
      const testContent = "A".repeat(50000); // 50KB of 'A's
      const encoder = new TextEncoder();
      const buffer = encoder.encode(testContent).buffer;

      mockReadFile.mockResolvedValue(buffer);

      // Mock TextDecoder.decode to throw on first call to trigger chunked approach
      const originalDecode = TextDecoder.prototype.decode;
      let callCount = 0;
      vi.spyOn(TextDecoder.prototype, "decode").mockImplementation(function (
        this: TextDecoder,
        ...args
      ) {
        callCount++;
        if (callCount === 1) {
          throw new Error("Simulated decode error");
        }
        return originalDecode.apply(this, args);
      });

      const result = await readTextFile("/large.txt");

      expect(result).toBe(testContent);

      // Restore original method
      vi.restoreAllMocks();
    });
  });
});
