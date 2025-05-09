import { subscribeMidiListener as legacySubscribeMidiListener } from "@/lib/webMidi";

/**
 * Subscribe to raw MIDI messages.
 * @param listener Callback for MIDIMessageEvent.
 * @returns Unsubscribe function.
 */
export function subscribeMidiListener(
  listener: (e: MIDIMessageEvent) => void,
): () => void {
  return legacySubscribeMidiListener(listener);
}
