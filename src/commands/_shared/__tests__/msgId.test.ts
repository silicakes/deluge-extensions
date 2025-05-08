import { describe, it, expect, beforeEach } from "vitest";
import { getNextMsgId, resetMsgId } from "../msgId";

describe("msgId utility", () => {
  beforeEach(() => {
    resetMsgId();
  });

  it("should start at 0 and increment", () => {
    expect(getNextMsgId()).toBe(0);
    expect(getNextMsgId()).toBe(1);
    expect(getNextMsgId()).toBe(2);
  });

  it("should wrap around after reaching MAX_MSG_ID", () => {
    const max = 0x7f;
    for (let i = 0; i < max; i++) {
      getNextMsgId();
    }
    expect(getNextMsgId()).toBe(max);
    expect(getNextMsgId()).toBe(0);
  });
});
