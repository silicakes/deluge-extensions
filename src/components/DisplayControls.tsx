import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { midiOut } from "../state";
import { Button } from "./Button";
import { captureScreenshot } from "../lib/display";
import { AdvancedDisplayControls } from "./AdvancedDisplayControls";

export function DisplayControls() {
  // Disable controls if no MIDI out
  const disabled = !midiOut.value;

  // Add new signals for fullscreen state to disable size buttons accordingly
  const fullScreenSignal = useSignal<boolean>(!!document.fullscreenElement);

  // Listen to fullscreenchange events to keep signal in sync
  useEffect(() => {
    const handler = () => {
      fullScreenSignal.value = !!document.fullscreenElement;
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Handlers for new controls
  const handleScreenshot = () => captureScreenshot();

  return (
    <div className="flex gap-2">
      <Button onClick={handleScreenshot} disabled={disabled}>
        📸 Screenshot
      </Button>

      <AdvancedDisplayControls />
    </div>
  );
}
