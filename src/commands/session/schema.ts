import { z } from "zod";

export const ReqPing = z.object({});
export const RespPing = z.object({});

export const ReqOpenSession = z.object({
  tag: z.string().optional(),
});
export const RespOpenSession = z.object({
  sid: z.number().int().nonnegative(),
  midMin: z.number().int().nonnegative(),
  midMax: z.number().int().nonnegative(),
});

export const ReqCloseSession = z.object({});
export const RespCloseSession = z.object({
  ok: z.literal(true),
});

export type ReqPing = z.infer<typeof ReqPing>;
export type RespPing = z.infer<typeof RespPing>;
export type ReqOpenSession = z.infer<typeof ReqOpenSession>;
export type RespOpenSession = z.infer<typeof RespOpenSession>;
export type ReqCloseSession = z.infer<typeof ReqCloseSession>;
export type RespCloseSession = z.infer<typeof RespCloseSession>;
