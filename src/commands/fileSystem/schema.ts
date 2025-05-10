import { z } from "zod";

/** Request schema for readFile command. */
export const ReqReadFile = z.object({
  path: z.string().nonempty(),
});

/** Request schema for writeFile command. */
export const ReqWriteFile = z.object({
  path: z.string().nonempty(),
  data: z.instanceof(Uint8Array),
});

/** Response schema for open file operation. */
export const RespOpen = z.object({
  fid: z.number().int().nonnegative(),
  size: z.number().int().nonnegative(),
});

/** Response schema for read chunk operation. */
export const RespReadChunk = z.object({
  data: z.instanceof(Uint8Array),
});

/** Response schema for close file operation. */
export const RespClose = z.object({ ok: z.literal(true) });

/** Request schema for renameFile command. */
export const ReqRenameFile = z.object({
  oldPath: z.string().nonempty(),
  newPath: z.string().nonempty(),
});

/** Response schema for renameFile command. */
export const RespRenameFile = z.object({ ok: z.literal(true) });

/** Request schema for makeDirectory command. */
export const ReqMakeDirectory = z.object({
  path: z.string().nonempty(),
});

/** Response schema for makeDirectory command. */
export const RespMakeDirectory = z.object({ ok: z.boolean() });

/** Request schema for deleteFile command. */
export const ReqDeleteFile = z.object({
  path: z.string().nonempty(),
});

/** Response schema for deleteFile command. */
export const RespDeleteFile = z.object({ ok: z.boolean() });

export type ReqReadFile = z.infer<typeof ReqReadFile>;
export type RespOpen = z.infer<typeof RespOpen>;
export type RespReadChunk = z.infer<typeof RespReadChunk>;
export type RespClose = z.infer<typeof RespClose>;
export type ReqWriteFile = z.infer<typeof ReqWriteFile>;
export type ReqRenameFile = z.infer<typeof ReqRenameFile>;
export type RespRenameFile = z.infer<typeof RespRenameFile>;
export type ReqMakeDirectory = z.infer<typeof ReqMakeDirectory>;
export type RespMakeDirectory = z.infer<typeof RespMakeDirectory>;
export type ReqDeleteFile = z.infer<typeof ReqDeleteFile>;
export type RespDeleteFile = z.infer<typeof RespDeleteFile>;
