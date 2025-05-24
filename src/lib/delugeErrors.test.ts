import { describe, it, expect } from "vitest";
import {
  DelugeErrorCode,
  DelugeFileSystemError,
  fatErrorToText,
} from "./delugeErrors";
import { handleDelugeResponse, isSuccessCode } from "./errorHandler";
import { withRetry } from "./retryHandler";
import { getUserFriendlyError } from "./userErrorMessages";

describe("Error handling", () => {
  describe("fatErrorToText", () => {
    it("should convert error codes to text correctly", () => {
      expect(fatErrorToText(0)).toBe("OK");
      expect(fatErrorToText(1)).toBe("Disk error");
      expect(fatErrorToText(4)).toBe("File not found");
      expect(fatErrorToText(9)).toBe("Directory is not empty");
      expect(fatErrorToText(18)).toBe("Invalid parameter");
      expect(fatErrorToText(99)).toBe("Unknown error 99");
    });
  });

  describe("DelugeFileSystemError", () => {
    it("should create error with proper message", () => {
      const error = new DelugeFileSystemError(
        DelugeErrorCode.FILE_NOT_FOUND,
        "open",
        { path: "/test.txt" },
      );
      expect(error.message).toBe(
        'open failed: File not found ({"path":"/test.txt"})',
      );
      expect(error.code).toBe(DelugeErrorCode.FILE_NOT_FOUND);
      expect(error.command).toBe("open");
      expect(error.context).toEqual({ path: "/test.txt" });
    });
  });

  describe("handleDelugeResponse", () => {
    it("should pass through successful responses", () => {
      const response = { err: 0, data: "test" };
      const result = handleDelugeResponse(response, "test");
      expect(result).toBe(response);
    });

    it("should throw on error codes", () => {
      const response = { err: 4 };
      expect(() => handleDelugeResponse(response, "open")).toThrow(
        DelugeFileSystemError,
      );
    });

    it("should allow custom success codes", () => {
      const response = { err: 4 };
      expect(() =>
        handleDelugeResponse(response, "delete", {}, [0, 4]),
      ).not.toThrow();
    });

    it("should pass through responses without err field", () => {
      const response = { data: "test", err: undefined };
      const result = handleDelugeResponse(response, "test");
      expect(result).toBe(response);
    });
  });

  describe("isSuccessCode", () => {
    it("should handle special cases", () => {
      expect(isSuccessCode(0, "open")).toBe(true);
      expect(isSuccessCode(4, "open")).toBe(false);
      expect(isSuccessCode(0, "delete")).toBe(true);
      expect(isSuccessCode(4, "delete")).toBe(true); // Special case
    });
  });

  describe("withRetry", () => {
    it("should retry on transient errors", async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new DelugeFileSystemError(
            DelugeErrorCode.OUT_OF_MEMORY,
            "read",
          );
        }
        return "success";
      };

      const result = await withRetry(operation);
      expect(result).toBe("success");
      expect(attempts).toBe(3);
    });

    it("should not retry on non-retryable errors", async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new DelugeFileSystemError(DelugeErrorCode.FILE_NOT_FOUND, "open");
      };

      await expect(withRetry(operation)).rejects.toThrow(DelugeFileSystemError);
      expect(attempts).toBe(1);
    });

    it("should respect max attempts", async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new DelugeFileSystemError(DelugeErrorCode.DISK_ERROR, "write");
      };

      await expect(withRetry(operation, { maxAttempts: 2 })).rejects.toThrow(
        DelugeFileSystemError,
      );
      expect(attempts).toBe(2);
    });
  });

  describe("getUserFriendlyError", () => {
    it("should provide friendly messages for Deluge errors", () => {
      const error = new DelugeFileSystemError(
        DelugeErrorCode.OUT_OF_MEMORY,
        "write",
      );
      expect(getUserFriendlyError(error)).toBe(
        "The SD card is full. Please delete some files to free up space.",
      );
    });

    it("should handle MIDI errors", () => {
      const error = new Error("MIDI output not selected");
      expect(getUserFriendlyError(error)).toBe(
        "Please connect your Deluge first.",
      );
    });

    it("should handle unknown errors", () => {
      expect(getUserFriendlyError("Something went wrong")).toBe(
        "An unexpected error occurred. Please try again.",
      );
    });

    it("should handle invalid filename errors", () => {
      const error = new DelugeFileSystemError(
        DelugeErrorCode.INVALID_PATH,
        "create",
        { path: "test\tfile.txt" },
      );
      expect(getUserFriendlyError(error)).toBe(
        "The filename contains invalid characters. Please use only letters, numbers, and basic punctuation.",
      );
    });
  });
});
