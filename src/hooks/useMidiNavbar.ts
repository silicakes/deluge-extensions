import { useEffect } from "preact/hooks";
import { useSignal, useComputed } from "@preact/signals";
import { midiIn, midiOut, autoEnabled } from "../state";
import {
  initMidi,
  getMidiInputs,
  getMidiOutputs,
  setMidiInput,
  setMidiOutput,
  autoConnectDefaultPorts,
} from "../lib/midi";

export function useMidiNavbar() {
  const inputSignal = midiIn;
  const outputSignal = midiOut;

  // local UI state
  const inputs = useSignal<MIDIInput[]>([]);
  const outputs = useSignal<MIDIOutput[]>([]);
  const online = useSignal<boolean>(navigator.onLine);

  // initialise WebMIDI and populate lists
  useEffect(() => {
    (async () => {
      const access = await initMidi(autoEnabled.value);
      if (!access) return;
      inputs.value = getMidiInputs();
      outputs.value = getMidiOutputs();
      access.onstatechange = () => {
        inputs.value = getMidiInputs();
        outputs.value = getMidiOutputs();
      };
    })();
  }, [autoEnabled.value]);

  // online/offline indicator
  useEffect(() => {
    const handler = () => (online.value = navigator.onLine);
    window.addEventListener("online", handler);
    window.addEventListener("offline", handler);
    return () => {
      window.removeEventListener("online", handler);
      window.removeEventListener("offline", handler);
    };
  }, []);

  // restore previously chosen ports
  useEffect(() => {
    if (!inputs.value.length && !outputs.value.length) return;
    const inId = localStorage.getItem("midiInPortId");
    const outId = localStorage.getItem("midiOutPortId");
    if (inId && !inputSignal.value)
      setMidiInput(inputs.value.find((d) => d.id === inId) || null);
    if (outId && !outputSignal.value)
      setMidiOutput(outputs.value.find((d) => d.id === outId) || null);
  }, [inputs.value.length, outputs.value.length]);

  // persist selected ports
  useEffect(() => {
    localStorage.setItem("midiInPortId", inputSignal.value?.id || "");
  }, [inputSignal.value]);
  useEffect(() => {
    localStorage.setItem("midiOutPortId", outputSignal.value?.id || "");
  }, [outputSignal.value]);

  const ready = useComputed(() => !!outputSignal.value);

  const onInputChange = (e: Event) => {
    const id = (e.target as HTMLSelectElement).value;
    const device = getMidiInputs().find((d) => d.id === id) || null;
    setMidiInput(device);
  };
  const onOutputChange = (e: Event) => {
    const id = (e.target as HTMLSelectElement).value;
    const device = getMidiOutputs().find((d) => d.id === id) || null;
    setMidiOutput(device);
  };
  const onAutoToggle = (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    autoEnabled.value = checked;
    if (checked) {
      autoConnectDefaultPorts();
      inputs.value = getMidiInputs();
      outputs.value = getMidiOutputs();
    }
  };

  return {
    inputSignal,
    outputSignal,
    inputs,
    outputs,
    online,
    ready,
    onInputChange,
    onOutputChange,
    onAutoToggle,
    autoEnabled,
  };
}
