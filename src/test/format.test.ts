import { describe, it, expect } from "vitest";
import { formatBytes } from "../lib/format";

describe("formatBytes", () => {
  it("formats zero bytes correctly", () => {
    expect(formatBytes(0)).toBe("0 Bytes");
  });

  it("formats bytes correctly", () => {
    expect(formatBytes(100)).toBe("100.00 Bytes");
  });

  it("formats kilobytes correctly", () => {
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(1536)).toBe("1.50 KB");
  });

  it("formats megabytes correctly", () => {
    expect(formatBytes(1048576)).toBe("1.00 MB");
    expect(formatBytes(2097152)).toBe("2.00 MB");
  });

  it("formats gigabytes correctly", () => {
    expect(formatBytes(1073741824)).toBe("1.00 GB");
  });

  it("respects decimal places parameter", () => {
    expect(formatBytes(1234, 0)).toBe("1 KB");
    expect(formatBytes(1234, 1)).toBe("1.2 KB");
    expect(formatBytes(1234, 3)).toBe("1.205 KB");
  });
});
