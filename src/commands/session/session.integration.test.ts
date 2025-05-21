import { vi, describe, it, expect, beforeEach } from "vitest";
import * as transport from "../_shared/transport";
import { builder } from "../_shared/builder";
import { openSession, ping, closeSession } from "./session";

describe("session integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should open, ping, and close session in sequence", async () => {
    const sessionData = { sid: 4, midMin: 33, midMax: 39 };
    const sendSpy = vi
      .spyOn(transport, "sendSysex")
      .mockResolvedValueOnce({ json: { "^session": sessionData } })
      .mockResolvedValueOnce({ json: { "^ping": {} } })
      .mockResolvedValueOnce({ json: { ok: true } });

    // Open session
    const resp = await openSession({ tag: "Test" });
    expect(resp).toEqual(sessionData);

    // Ping and close session
    await ping();
    await closeSession();

    // Ensure transport calls sequence and payloads
    expect(sendSpy).toHaveBeenCalledTimes(3);
    expect(sendSpy).toHaveBeenNthCalledWith(
      1,
      builder.jsonOnly({ session: { tag: "Test" } }),
    );
    expect(sendSpy).toHaveBeenNthCalledWith(2, builder.jsonOnly({ ping: {} }));
    expect(sendSpy).toHaveBeenNthCalledWith(
      3,
      builder.jsonOnly({ closeSession: {} }),
    );
  });
});
