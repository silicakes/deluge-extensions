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

/** Request schema for fsDelete command. */
export const ReqFsDelete = z.object({
  path: z.string().nonempty(),
});

/** Response schema for fsDelete command. */
export const RespFsDelete = z.object({ ok: z.boolean() });

/** Request schema for copyFile command. */
export const ReqCopyFile = z.object({
  from: z.string().nonempty(),
  to: z.string().nonempty(),
});

/** Response schema for copyFile command. */
export const RespCopyFile = z.object({ ok: z.boolean() });

/** Request schema for moveFile command. */
export const ReqMoveFile = z.object({
  from: z.string().nonempty(),
  to: z.string().nonempty(),
});

/** Response schema for moveFile command. */
export const RespMoveFile = z.object({ ok: z.boolean() });

/** Request schema for listDirectory command. */
export const ReqListDirectory = z.object({
  path: z.string().nonempty(),
  offset: z.number().int().nonnegative().optional(),
  lines: z.number().int().nonnegative().optional(),
  force: z.boolean().optional(),
});

/** Response schema for listDirectory command. */
export const RespListDirectory = z.object({
  list: z.array(
    z.object({
      name: z.string(),
      size: z.number().int().nonnegative(),
      date: z.number().int().nonnegative(),
      time: z.number().int().nonnegative(),
      attr: z.number().int().nonnegative(),
    }),
  ),
  err: z.literal(0),
});

export type ReqReadFile = z.infer<typeof ReqReadFile>;
export type RespOpen = z.infer<typeof RespOpen>;
export type RespReadChunk = z.infer<typeof RespReadChunk>;
export type RespClose = z.infer<typeof RespClose>;
export type ReqWriteFile = z.infer<typeof ReqWriteFile>;
export type ReqRenameFile = z.infer<typeof ReqRenameFile>;
export type RespRenameFile = z.infer<typeof RespRenameFile>;
export type ReqMakeDirectory = z.infer<typeof ReqMakeDirectory>;
export type RespMakeDirectory = z.infer<typeof RespMakeDirectory>;
export type ReqFsDelete = z.infer<typeof ReqFsDelete>;
export type RespFsDelete = z.infer<typeof RespFsDelete>;
export type ReqCopyFile = z.infer<typeof ReqCopyFile>;
export type RespCopyFile = z.infer<typeof RespCopyFile>;
export type ReqMoveFile = z.infer<typeof ReqMoveFile>;
export type RespMoveFile = z.infer<typeof RespMoveFile>;
export type ReqListDirectory = z.infer<typeof ReqListDirectory>;
export type RespListDirectory = z.infer<typeof RespListDirectory>;
