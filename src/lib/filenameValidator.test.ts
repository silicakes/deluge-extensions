import { describe, it, expect } from "vitest";
import {
  validateFilename,
  sanitizeFilename,
  getErrorMessage,
  DelugeFileError,
} from "./filenameValidator";

describe("filenameValidator", () => {
  describe("validateFilename", () => {
    it("should accept valid filenames", () => {
      const result = validateFilename("valid_file.txt");
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitized).toBe("valid_file.txt");
    });

    it("should reject control characters", () => {
      const result = validateFilename("test\tfile.txt");
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Illegal characters found");
      expect(result.sanitized).toBe("test_file.txt");
    });

    it("should reject newline characters", () => {
      const result = validateFilename("test\nfile.txt");
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.sanitized).toBe("test_file.txt");
    });

    it("should handle reserved names", () => {
      const result = validateFilename("CON.txt");
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Reserved filename: CON");
      expect(result.sanitized).toBe("_CON.txt");
    });

    it("should handle reserved names case-insensitively", () => {
      const result = validateFilename("con.txt");
      expect(result.isValid).toBe(false);
      expect(result.sanitized).toBe("_con.txt");
    });

    it("should accept filenames with spaces without warnings", () => {
      const result = validateFilename("my file.txt");
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.sanitized).toBe("my file.txt");
    });

    it("should handle trailing dots and spaces", () => {
      const result = validateFilename("test.txt. ");
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain(
        "Trailing dots or spaces will be removed",
      );
      expect(result.sanitized).toBe("test.txt");
    });

    it("should truncate long names", () => {
      const longName = "a".repeat(300) + ".txt";
      const result = validateFilename(longName);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Filename too long");
      expect(
        new TextEncoder().encode(result.sanitized).length,
      ).toBeLessThanOrEqual(255);
    });

    it("should handle illegal FAT32 characters", () => {
      const result = validateFilename('test<>:"/\\|?*.txt');
      expect(result.isValid).toBe(false);
      expect(result.sanitized).toBe("test_________.txt");
    });

    it("should handle multiple issues", () => {
      const result = validateFilename("CON<test>.txt ");
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should preserve valid Unicode characters", () => {
      const result = validateFilename("тест_файл_🎵.txt");
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe("тест_файл_🎵.txt");
    });
  });

  describe("sanitizeFilename", () => {
    it("should return sanitized filename directly", () => {
      expect(sanitizeFilename("test<file>.txt")).toBe("test_file_.txt");
      expect(sanitizeFilename("CON.txt")).toBe("_CON.txt");
      expect(sanitizeFilename("valid.txt")).toBe("valid.txt");
    });
  });

  describe("getErrorMessage", () => {
    it("should return correct error messages", () => {
      expect(getErrorMessage(DelugeFileError.INVALID_FILENAME)).toBe(
        "Invalid filename - contains illegal characters",
      );
      expect(getErrorMessage(DelugeFileError.FILE_NOT_FOUND)).toBe(
        "File not found",
      );
      expect(getErrorMessage(DelugeFileError.SUCCESS)).toBe("Success");
      expect(getErrorMessage(999)).toBe("Unknown error code: 999");
    });
  });
});
