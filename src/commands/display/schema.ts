import { z } from "zod";

/** Empty request schema for commands with no parameters */
export const ReqEmpty = z.object({});
export type ReqEmpty = z.infer<typeof ReqEmpty>;

/** Response schema for display commands (no content) */
export const RespEmpty = z.object({});
export type RespEmpty = z.infer<typeof RespEmpty>;
