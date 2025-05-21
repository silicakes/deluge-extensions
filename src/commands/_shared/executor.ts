/**
 * Executor for SysEx commands: builds payload, sends via transport, and parses response.
 */
// Remove static transport import to allow dynamic mocking
// transport will be imported dynamically inside executeCommand

/**
 * Options for executing a SysEx command.
 */
export interface ExecuteCommandOpts<Req, Res> {
  /** Identifier for the command type (JSON-only vs JSON+Binary). */
  cmdId: number;
  /** Original request payload object. */
  request: Req;
  /** Function to build the SysEx payload. */
  build: () => unknown;
  /** Function to parse the raw SysEx response. */
  parse: (raw: unknown) => Res;
}

/**
 * Sends a SysEx command payload and parses the response.
 * @param opts - Options for building, sending, and parsing the command.
 * @returns Parsed response object.
 */
export async function executeCommand<Req extends object, Res extends object>(
  opts: ExecuteCommandOpts<Req, Res>,
): Promise<Res> {
  const { build, parse } = opts;
  const payload = build();
  // Dynamically import transport to pick up any mocked implementations
  const transportModule = await import("@/commands/_shared/transport");
  const raw = await transportModule.sendSysex(payload);
  return parse(raw);
}
