import { encode7Bit, decode7Bit } from "../pack";
import { describe, it, expect } from "vitest";

describe("encode7Bit", () => {
  it("encodes data into 7-bit segments", () => {
    const data = new Uint8Array([
      0x00, 0x7f, 0x80, 0xff, 0x55, 0xaa, 0x01, 0x02,
    ]);
    const encoded = encode7Bit(data);
    expect(encoded).toMatchSnapshot();
  });
});

describe("decode7Bit", () => {
  it("decodes encoded data back to original", () => {
    const original = new Uint8Array([
      0x00, 0x7f, 0x80, 0xff, 0x55, 0xaa, 0x01, 0x02,
    ]);
    const encoded = encode7Bit(original);
    const decoded = decode7Bit(encoded);
    expect(decoded).toEqual(original);
  });
});
