import { effect } from "@preact/signals";
import { autoEnabled, midiOut } from "../state";
// import { autoConnectDefaultPorts } from "./midi";
// import { getDisplay } from "./midi";
import { startPolling, stopPolling } from "./display";
import { autoConnectDefaultPorts, getDisplay } from "./webMidi";

// Save preference
effect(() => {
  localStorage.setItem("dex-auto-enabled", autoEnabled.value.toString());

  // One-time migration: delete legacy keys after migrating
  if (localStorage.getItem("autoConnectEnabled") !== null) {
    localStorage.removeItem("autoConnectEnabled");
  }
  if (localStorage.getItem("dex-auto-display") !== null) {
    localStorage.removeItem("dex-auto-display");
  }
});

// Auto-connect default ports
effect(() => {
  if (autoEnabled.value) autoConnectDefaultPorts();
});

// Auto-display behaviour
effect(() => {
  if (autoEnabled.value && midiOut.value) {
    getDisplay(true);
    startPolling();
  } else {
    stopPolling();
  }
});
