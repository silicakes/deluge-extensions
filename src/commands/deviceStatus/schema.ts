import { z } from "zod";

/** Empty request schema for commands with no parameters */
export const ReqEmpty = z.object({});
export type ReqEmpty = z.infer<typeof ReqEmpty>;

/** Response schema for getVersion (no content) */
export const RespVersion = z.object({});
export type RespVersion = z.infer<typeof RespVersion>;

/** Response schema for getFeatures (no content) */
export const RespFeatures = z.object({});
export type RespFeatures = z.infer<typeof RespFeatures>;
