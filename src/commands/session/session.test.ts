import { vi, describe, it, expect, beforeEach } from "vitest";
import * as transport from "../_shared/transport";
import { builder } from "../_shared/builder";
import { ping, openSession, closeSession } from "./session";

describe("session commands", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ping sends correct JSON-only ping command", async () => {
    const sendSpy = vi
      .spyOn(transport, "sendSysex")
      .mockResolvedValue({ json: { "^ping": {} } });
    await ping();
    expect(sendSpy).toHaveBeenCalledWith(builder.jsonOnly({ ping: {} }));
  });

  it("openSession sends correct JSON-only session command and parses response", async () => {
    const sessionData = { sid: 1, midMin: 0x41, midMax: 0x4f };
    vi.spyOn(transport, "sendSysex").mockResolvedValueOnce({
      json: { "^session": sessionData },
    });
    const resp = await openSession({ tag: "DEx" });
    expect(resp).toEqual(sessionData);
  });

  it("closeSession sends correct JSON-only closeSession command", async () => {
    const sendSpy = vi
      .spyOn(transport, "sendSysex")
      .mockResolvedValueOnce({ json: { ok: true } });
    await closeSession();
    expect(sendSpy).toHaveBeenCalledWith(
      builder.jsonOnly({ closeSession: {} }),
    );
  });
});
