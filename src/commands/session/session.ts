import { executeCommand } from "../_shared/executor";
import { builder } from "../_shared/builder";
import { parser } from "../_shared/parser";
import { SmsCommand } from "../_shared/types";
import {
  ReqPing,
  RespPing,
  ReqOpenSession,
  RespOpenSession,
  ReqCloseSession,
  RespCloseSession,
} from "./schema";

/**
 * Sends a SysEx ping to the Deluge device.
 */
export async function ping(): Promise<void> {
  await executeCommand<ReqPing, RespPing>({
    cmdId: SmsCommand.JSON,
    request: {},
    build: () => builder.jsonOnly({ ping: {} }),
    parse: parser.json<RespPing>("^ping"),
  });
}

/**
 * Opens a session with the Deluge device.
 */
export async function openSession(
  opts: ReqOpenSession = {},
): Promise<RespOpenSession> {
  const response = await executeCommand<ReqOpenSession, RespOpenSession>({
    cmdId: SmsCommand.JSON,
    request: opts,
    build: () => builder.jsonOnly({ session: { tag: opts.tag } }),
    parse: parser.json<RespOpenSession>("^session"),
  });
  return response;
}

/**
 * Closes the current session.
 */
export async function closeSession(): Promise<void> {
  await executeCommand<ReqCloseSession, RespCloseSession>({
    cmdId: SmsCommand.JSON,
    request: {},
    build: () => builder.jsonOnly({ closeSession: {} }),
    parse: (raw): RespCloseSession => parser.expectOk(raw) as RespCloseSession,
  });
}
