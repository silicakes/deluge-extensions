/**
 * Message ID generator with wrap-around for MIDI SysEx commands.
 */

let counter = 0;
const MAX_MSG_ID = 0x7f;

/**
 * Get the next message ID, wraps around after reaching MAX_MSG_ID.
 * @returns Next message ID (0 to MAX_MSG_ID).
 */
export function getNextMsgId(): number {
  const id = counter;
  counter = (counter + 1) % (MAX_MSG_ID + 1);
  return id;
}

/**
 * Reset message ID counter to zero.
 * For testing purposes.
 */
export function resetMsgId(): void {
  counter = 0;
}
