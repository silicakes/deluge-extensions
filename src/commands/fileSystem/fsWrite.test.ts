import { describe, it, expect, vi, afterEach } from "vitest";
import * as midi from "@/lib/midi";
import { writeFile } from "./fsWrite";

vi.mock("@/lib/midi", () => ({ uploadFiles: vi.fn() }));

describe("writeFile command", () => {
  afterEach(() => vi.clearAllMocks());

  it("calls uploadFiles with a File instance and correct directory", async () => {
    const data = new Uint8Array([1, 2, 3]);
    vi.mocked(midi.uploadFiles).mockResolvedValue(undefined);

    await writeFile({ path: "/dir/file.bin", data });

    const calls = vi.mocked(midi.uploadFiles).mock.calls;
    expect(calls).toHaveLength(1);
    const [files, dir] = calls[0];
    expect(dir).toBe("/dir");
    expect(files).toHaveLength(1);
    const file = files[0];
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("file.bin");
  });
});
