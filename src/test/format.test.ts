import { describe, it, expect } from "vitest";
import { formatBytes, formatDate } from "../lib/format";

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

describe("formatDate", () => {
  it("formats a valid FAT date/time correctly", () => {
    // FAT date: 2023-12-25 (year=43+1980=2023, month=12, day=25)
    // Binary: 0101011 1100 11001 = 0x5799
    const fatDate = 0x5799;

    // FAT time: 14:30:00 (hours=14, minutes=30, seconds=0)
    // Binary: 01110 011110 00000 = 0x73C0
    const fatTime = 0x73c0;

    const result = formatDate(fatDate, fatTime);

    // Should contain the date and time components
    expect(result).toContain("23"); // year 2023 -> 23
    expect(result).toContain("12"); // month
    expect(result).toContain("25"); // day
    expect(result).toContain("14"); // hour
    expect(result).toContain("30"); // minute
  });

  it("handles invalid dates gracefully", () => {
    // Invalid date values
    const result = formatDate(0xffff, 0xffff);
    expect(result).toBe("Invalid Date");
  });

  it("handles zero date/time", () => {
    // Zero values should create a valid date (1980-01-01 00:00:00)
    const result = formatDate(0x0021, 0x0000); // 1980-01-01
    expect(result).toContain("80"); // year 1980 -> 80
    expect(result).toContain("01"); // month and day
  });

  it("formats seconds correctly (FAT time has 2-second precision)", () => {
    // FAT time: 12:00:30 (hours=12, minutes=0, seconds=30/2=15)
    // Binary: 01100 000000 01111 = 0x600F
    const fatTime = 0x600f;
    const fatDate = 0x0021; // 1980-01-01

    const result = formatDate(fatDate, fatTime);
    expect(result).toContain("12"); // hour
    expect(result).toContain("00"); // minute
  });
});
