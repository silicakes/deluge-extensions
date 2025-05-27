import { describe, it, expect } from "vitest";
import {
  truncateFilename,
  truncateFileName,
  formatFilenameForDisplay,
  formatFilenameForIconGrid,
  formatFileNameMultiLine,
  truncateWithoutExtension,
} from "../lib/filenameDisplay";

describe("filenameDisplay", () => {
  describe("truncateFileName", () => {
    it("should return short filenames unchanged", () => {
      expect(truncateFileName("test.wav", 20)).toBe("test.wav");
      expect(truncateFileName("short.mp3", 20)).toBe("short.mp3");
    });

    it("should preserve file extensions with middle ellipsis", () => {
      const longFilename =
        "this_is_a_very_long_filename_that_needs_truncation.wav";
      const result = truncateFileName(longFilename, 30);

      expect(result).toContain(".wav");
      expect(result).toContain("...");
      expect(result.length).toBeLessThanOrEqual(30);
      // Should have text before and after ellipsis
      const parts = result.split("...");
      expect(parts.length).toBe(2);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1]).toContain(".wav");
    });

    it("should handle files without extensions", () => {
      const noExtension = "this_is_a_very_long_filename_without_extension";
      const result = truncateFileName(noExtension, 30);

      expect(result).toContain("...");
      expect(result.length).toBeLessThanOrEqual(30);
      // Should have text before and after ellipsis
      const parts = result.split("...");
      expect(parts.length).toBe(2);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThan(0);
    });

    it("should handle files with very long extensions", () => {
      const longExt = "filename.verylongextensionname";
      const result = truncateFileName(longExt, 20);

      // Should truncate at the end when extension is too long
      expect(result).toContain("...");
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it("should handle edge cases", () => {
      expect(truncateFileName("", 20)).toBe("");
      expect(truncateFileName("a.b", 20)).toBe("a.b");
      expect(truncateFileName(".hidden", 20)).toBe(".hidden");
    });

    it("should work with the deluge filename example", () => {
      const filename = "deluge-v1.3.0-dev-478ad90d-dirty.bin";
      const result = truncateFileName(filename, 32);

      expect(result).toContain(".bin");
      expect(result).toContain("...");
      expect(result.length).toBeLessThanOrEqual(32);
      expect(result).toBe("deluge-v1.3.0...8ad90d-dirty.bin");
    });
  });

  describe("truncateWithoutExtension", () => {
    it("should truncate files without extensions", () => {
      const filename = "this_is_a_very_long_filename_without_extension";
      const result = truncateWithoutExtension(filename, 20);

      expect(result).toContain("...");
      expect(result.length).toBeLessThanOrEqual(20);
    });
  });

  describe("formatFileNameMultiLine", () => {
    it("should split short filenames into lines without truncation", () => {
      const filename = "short.txt";
      const lines = formatFileNameMultiLine(filename, 15, 2);

      expect(lines).toEqual(["short.txt"]);
    });

    it("should truncate and split long filenames", () => {
      const filename = "this_is_a_very_long_filename_that_needs_truncation.wav";
      const lines = formatFileNameMultiLine(filename, 15, 2);

      expect(lines.length).toBeLessThanOrEqual(2);
      const combined = lines.join("");
      expect(combined).toContain(".wav");
      expect(combined).toContain("...");
    });
  });

  describe("formatFilenameForDisplay", () => {
    it("should return display name and truncation status", () => {
      const short = formatFilenameForDisplay("test.wav");
      expect(short.displayName).toBe("test.wav");
      expect(short.wasTruncated).toBe(false);

      // Test with a filename that's longer than 60 characters to trigger truncation
      const veryLong = formatFilenameForDisplay(
        "this_is_an_extremely_long_filename_that_definitely_exceeds_sixty_characters_and_should_be_truncated.wav",
      );
      expect(veryLong.displayName).toContain(".wav");
      expect(veryLong.displayName).toContain("...");
      expect(veryLong.wasTruncated).toBe(true);
      expect(veryLong.displayName.length).toBeLessThanOrEqual(60);

      // Test with a filename that's under 60 characters (should not be truncated)
      const mediumLength = formatFilenameForDisplay(
        "this_is_a_very_long_filename_that_needs_truncation.wav",
      );
      expect(mediumLength.displayName).toBe(
        "this_is_a_very_long_filename_that_needs_truncation.wav",
      );
      expect(mediumLength.wasTruncated).toBe(false);
    });
  });

  describe("formatFilenameForIconGrid", () => {
    it("should allow longer filenames before truncation", () => {
      const short = formatFilenameForIconGrid("test.wav");
      expect(short.displayName).toBe("test.wav");
      expect(short.wasTruncated).toBe(false);

      // Test with a filename under 80 characters (should not be truncated)
      const mediumLength = formatFilenameForIconGrid(
        "this_is_a_very_long_filename_that_needs_truncation_but_is_under_eighty_chars.wav",
      );
      expect(mediumLength.wasTruncated).toBe(false);

      // Test with a filename over 80 characters (should be truncated)
      const veryLong = formatFilenameForIconGrid(
        "this_is_an_extremely_long_filename_that_definitely_exceeds_eighty_characters_and_should_be_truncated_for_display.wav",
      );
      expect(veryLong.displayName).toContain(".wav");
      expect(veryLong.displayName).toContain("...");
      expect(veryLong.wasTruncated).toBe(true);
      expect(veryLong.displayName.length).toBeLessThanOrEqual(80);
    });
  });

  describe("legacy truncateFilename function", () => {
    it("should work for backward compatibility", () => {
      const filename = "deluge-v1.3.0-dev-478ad90d-dirty.bin";
      const result = truncateFilename(filename, 32);

      expect(result).toContain(".bin");
      expect(result).toContain("...");
      expect(result.length).toBeLessThanOrEqual(32);
    });
  });
});
