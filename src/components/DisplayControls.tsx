import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import {
  ping,
  getOled,
  get7Seg,
  flipScreen,
  getDisplay,
  startMonitor,
  stopMonitor,
} from "../lib/midi";
import { midiOut, monitorMode, autoEnabled, helpOpen } from "../state";
import { Button } from "./Button";
import {
  captureScreenshot,
  toggleFullScreen,
  increaseCanvasSize,
  decreaseCanvasSize,
  startPolling,
  stopPolling,
} from "../lib/display";

export function DisplayControls() {
  // Local signal for refresh toggle
  const refreshSignal = useSignal(false);

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

  // Handlers for display controls
  const handlePing = () => ping();
  const handleOled = () => getOled();
  const handle7Seg = () => get7Seg();
  const handleFlip = () => flipScreen();

  // Handlers for new controls
  const handleScreenshot = () => captureScreenshot();
  const handleFullScreen = () => toggleFullScreen();
  const handleIncrease = () => increaseCanvasSize();
  const handleDecrease = () => decreaseCanvasSize();

  // Handler for help
  const handleHelp = () => {
    helpOpen.value = !helpOpen.value;
  };

  const toggleRefresh = () => {
    const newValue = !refreshSignal.value;
    refreshSignal.value = newValue;

    // When manually turning off refresh, also turn off auto-enabled
    if (!newValue) {
      autoEnabled.value = false;
    }
  };

  const toggleMonitor = () => {
    monitorMode.value = !monitorMode.value;
  };

  // Effect for refresh polling
  useEffect(() => {
    if (refreshSignal.value) {
      // Request full display on toggle
      getDisplay(true);
      startPolling();
      return () => stopPolling();
    }
  }, [refreshSignal.value]);

  // Effect for monitor mode
  useEffect(() => {
    if (monitorMode.value) {
      startMonitor();
    } else {
      stopMonitor();
    }
  }, [monitorMode.value]);

  return (
    <div className="flex gap-2 flex-wrap">
      <Button onClick={handlePing} disabled={disabled}>
        Ping
      </Button>
      <Button onClick={handleOled} disabled={disabled}>
        Get OLED
      </Button>
      <Button onClick={handle7Seg} disabled={disabled}>
        Get 7-Seg
      </Button>
      <Button onClick={handleFlip} disabled={disabled}>
        Switch display type
      </Button>
      <Button onClick={toggleRefresh} disabled={disabled}>
        {refreshSignal.value ? "Pause" : "Refresh"}
      </Button>
      <Button onClick={toggleMonitor} disabled={disabled}>
        {monitorMode.value ? "Stop Monitoring" : "Monitor"}
      </Button>
      <Button onClick={handleScreenshot} disabled={disabled}>
        📸 Screenshot
      </Button>
      <Button
        onClick={handleHelp}
        aria-label="Keyboard help (?)"
        title="Keyboard help (?)"
        aria-haspopup="dialog"
        aria-pressed={helpOpen.value}
      >
        ?
      </Button>
    </div>
  );
}
