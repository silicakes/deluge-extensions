import { z } from "zod";

/**
 * Request schema for uploadFile command.
 * @param path Destination path on the Deluge SD card.
 * @param data File contents as Uint8Array.
 */
export const Req = z.object({
  path: z.string().nonempty(),
  data: z.instanceof(Uint8Array),
});

/** Response schema indicating success. */
export const Resp = z.object({ ok: z.literal(true) });

export type Req = z.infer<typeof Req>;
export type Resp = z.infer<typeof Resp>;
