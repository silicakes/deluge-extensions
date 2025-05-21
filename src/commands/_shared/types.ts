/**
 * Command IDs for Deluge SysEx operations.
 */
export enum SmsCommand {
  /** JSON-only commands */
  JSON = 0,
  /** Composite JSON + Binary commands */
  JSON_BINARY = 1,
  // Extend as needed for other command types
}
