import { describe, it, expect } from "vitest";
import { pack_8bit_to_7bit, unpack_7bit_from_8bit } from "./sysexPacking";

describe("7-bit packing", () => {
  it("should pack and unpack correctly", () => {
    const testData = new Uint8Array([0xff, 0x00, 0x7f, 0x80, 0xaa, 0x55, 0x01]);
    const packed = pack_8bit_to_7bit(testData);
    const unpacked = unpack_7bit_from_8bit(packed, testData.length);
    expect(unpacked).toEqual(testData);
  });

  it("should handle empty data", () => {
    const empty = new Uint8Array(0);
    const packed = pack_8bit_to_7bit(empty);
    expect(packed.length).toBe(0);
  });

  it("should match vuefinder format", () => {
    // Test with known vuefinder examples
    const data = new Uint8Array([0x80, 0x7f, 0x00, 0xff]);
    const packed = pack_8bit_to_7bit(data);
    // First byte should have MSBs: 0b1001 (0x09)
    expect(packed[0]).toBe(0x09);
    expect(packed[1]).toBe(0x00); // 0x80 & 0x7F
    expect(packed[2]).toBe(0x7f); // 0x7F & 0x7F
    expect(packed[3]).toBe(0x00); // 0x00 & 0x7F
    expect(packed[4]).toBe(0x7f); // 0xFF & 0x7F
  });

  it("should handle single byte", () => {
    const single = new Uint8Array([0x80]);
    const packed = pack_8bit_to_7bit(single);
    expect(packed.length).toBe(2); // 1 MSB byte + 1 data byte
    expect(packed[0]).toBe(0x01); // MSB set for first byte
    expect(packed[1]).toBe(0x00); // 0x80 & 0x7F

    const unpacked = unpack_7bit_from_8bit(packed, 1);
    expect(unpacked).toEqual(single);
  });

  it("should handle exact 7-byte chunks", () => {
    const data = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
    const packed = pack_8bit_to_7bit(data);
    expect(packed.length).toBe(8); // 1 MSB byte + 7 data bytes
    expect(packed[0]).toBe(0x00); // No MSBs set
    expect(Array.from(packed.slice(1))).toEqual([
      0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
    ]);

    const unpacked = unpack_7bit_from_8bit(packed, 7);
    expect(unpacked).toEqual(data);
  });

  it("should handle partial chunks", () => {
    const data = new Uint8Array([
      0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09,
    ]);
    const packed = pack_8bit_to_7bit(data);
    expect(packed.length).toBe(11); // 1 MSB + 7 data + 1 MSB + 2 data

    const unpacked = unpack_7bit_from_8bit(packed, 9);
    expect(unpacked).toEqual(data);
  });

  it("should handle all zeros", () => {
    const zeros = new Uint8Array(10);
    const packed = pack_8bit_to_7bit(zeros);
    const unpacked = unpack_7bit_from_8bit(packed, 10);
    expect(unpacked).toEqual(zeros);
  });

  it("should handle all ones (0xFF)", () => {
    const ones = new Uint8Array(10).fill(0xff);
    const packed = pack_8bit_to_7bit(ones);
    const unpacked = unpack_7bit_from_8bit(packed, 10);
    expect(unpacked).toEqual(ones);
  });

  it("should handle random data", () => {
    const randomData = new Uint8Array(100);
    for (let i = 0; i < randomData.length; i++) {
      randomData[i] = Math.floor(Math.random() * 256);
    }
    const packed = pack_8bit_to_7bit(randomData);
    const unpacked = unpack_7bit_from_8bit(packed, randomData.length);
    expect(unpacked).toEqual(randomData);
  });

  it("should handle large data efficiently", () => {
    const largeData = new Uint8Array(10000);
    for (let i = 0; i < largeData.length; i++) {
      largeData[i] = i % 256;
    }

    const startTime = Date.now();
    const packed = pack_8bit_to_7bit(largeData);
    const packTime = Date.now() - startTime;

    const unpackStart = Date.now();
    const unpacked = unpack_7bit_from_8bit(packed, largeData.length);
    const unpackTime = Date.now() - unpackStart;

    expect(unpacked).toEqual(largeData);
    // Performance check - should be fast
    expect(packTime).toBeLessThan(100); // Less than 100ms for 10KB
    expect(unpackTime).toBeLessThan(100);
  });

  it("should unpack without size hint", () => {
    const data = new Uint8Array([0x80, 0x7f, 0x00, 0xff, 0xaa, 0x55]);
    const packed = pack_8bit_to_7bit(data);
    const unpacked = unpack_7bit_from_8bit(packed);
    expect(unpacked).toEqual(data);
  });

  it("should correctly encode MSB pattern", () => {
    // Test specific MSB patterns
    const data = new Uint8Array([
      0x80, // MSB set
      0x00, // MSB not set
      0x80, // MSB set
      0x00, // MSB not set
      0x80, // MSB set
      0x00, // MSB not set
      0x80, // MSB set
    ]);
    const packed = pack_8bit_to_7bit(data);
    // MSB byte should be 0b01010101 = 0x55
    expect(packed[0]).toBe(0x55);
    // All data bytes should have MSB cleared
    for (let i = 1; i < 8; i++) {
      expect(packed[i]).toBe(0x00);
    }
  });

  it("should handle boundary conditions correctly", () => {
    // Test with exactly 14 bytes (two full 7-byte groups)
    const data = new Uint8Array(14);
    for (let i = 0; i < 14; i++) {
      data[i] = i | 0x80; // All have MSB set
    }
    const packed = pack_8bit_to_7bit(data);
    expect(packed.length).toBe(16); // 2 groups: (1+7) + (1+7)
    expect(packed[0]).toBe(0x7f); // First 7 bytes all have MSB
    expect(packed[8]).toBe(0x7f); // Second 7 bytes all have MSB

    const unpacked = unpack_7bit_from_8bit(packed, 14);
    expect(unpacked).toEqual(data);
  });

  it("should match the old pack.ts implementation output", () => {
    // Test data from the old pack.test.ts
    const data = new Uint8Array([
      0x00, 0x7f, 0x80, 0xff, 0x55, 0xaa, 0x01, 0x02,
    ]);
    const packed = pack_8bit_to_7bit(data);

    // Expected output from the snapshot
    const expected = new Uint8Array([44, 0, 127, 0, 127, 85, 42, 1, 0, 2]);

    expect(packed).toEqual(expected);
  });
});
