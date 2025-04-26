import { useEffect } from 'preact/hooks';
import { useSignal, useComputed } from '@preact/signals';
import { midiIn, midiOut } from '../state';
import {
  initMidi,
  getMidiInputs,
  getMidiOutputs,
  setMidiInput,
  setMidiOutput,
  autoConnectDefaultPorts,
} from '../lib/midi';

export function MidiDeviceSelector() {
  const inputSignal = midiIn;
  const outputSignal = midiOut;
  const autoSignal = useSignal(localStorage.getItem('autoConnectEnabled') === 'true');
  const inputsSignal = useSignal<MIDIInput[]>([]);
  const outputsSignal = useSignal<MIDIOutput[]>([]);
  const onlineSignal = useSignal<boolean>(navigator.onLine);

  useEffect(() => {
    async function setup() {
      const access = await initMidi(autoSignal.value);
      if (!access) return;
      inputsSignal.value = getMidiInputs();
      outputsSignal.value = getMidiOutputs();
      access.onstatechange = () => {
        inputsSignal.value = getMidiInputs();
        outputsSignal.value = getMidiOutputs();
      };
    }
    setup();
  }, [autoSignal.value]);

  // Persist auto-connect setting
  useEffect(() => {
    localStorage.setItem('autoConnectEnabled', autoSignal.value.toString());
  }, [autoSignal.value]);

  // Set up online/offline listeners once
  useEffect(() => {
    const handler = () => {
      onlineSignal.value = navigator.onLine;
    };
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    return () => {
      window.removeEventListener('online', handler);
      window.removeEventListener('offline', handler);
    };
  }, []);

  // Restore previously selected ports from localStorage (if present)
  useEffect(() => {
    if (!inputsSignal.value.length && !outputsSignal.value.length) return; // lists not ready yet
    const storedInId = localStorage.getItem('midiInPortId');
    const storedOutId = localStorage.getItem('midiOutPortId');
    if (storedInId) {
      const inDev = inputsSignal.value.find((d) => d.id === storedInId) || null;
      setMidiInput(inDev);
    }
    if (storedOutId) {
      const outDev = outputsSignal.value.find((d) => d.id === storedOutId) || null;
      setMidiOutput(outDev);
    }
    // We only need to attempt restore once when lists populate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputsSignal.value.length, outputsSignal.value.length]);

  // Persist selected ports when they change
  useEffect(() => {
    localStorage.setItem('midiInPortId', inputSignal.value?.id || '');
  }, [inputSignal.value]);
  useEffect(() => {
    localStorage.setItem('midiOutPortId', outputSignal.value?.id || '');
  }, [outputSignal.value]);

  // Status text computed from signals
  const statusText = useComputed(() => {
    if (!onlineSignal.value) return 'Offline 🌐✖';
    return outputSignal.value ? 'Connected ✅' : 'No MIDI ❌';
  });

  const handleInputChange = (e: Event) => {
    const id = (e.target as HTMLSelectElement).value;
    const device = getMidiInputs().find((d) => d.id === id) || null;
    setMidiInput(device);
  };

  const handleOutputChange = (e: Event) => {
    const id = (e.target as HTMLSelectElement).value;
    const device = getMidiOutputs().find((d) => d.id === id) || null;
    setMidiOutput(device);
  };

  const handleAutoToggle = (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    autoSignal.value = checked;
    if (checked) {
      autoConnectDefaultPorts();
      inputsSignal.value = getMidiInputs();
      outputsSignal.value = getMidiOutputs();
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 bg-[var(--color-bg-offset)] rounded-lg border border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold">Status:</span>
        <span className={`text-sm rounded-full px-2 py-1 ${onlineSignal.value ? (outputSignal.value ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white') : 'bg-red-600 text-white'}`}>{statusText.value}</span>
      </div>
      <div>
        <label htmlFor="midi-input-select" className="mr-2 font-medium">MIDI Input:</label>
        <select
          id="midi-input-select"
          className="border border-[var(--color-border)] rounded px-2 py-1 w-full bg-[var(--color-bg)] text-[var(--color-text)]"
          value={inputSignal.value?.id || ''}
          onChange={handleInputChange}
          aria-label="MIDI input device"
        >
          <option value="">None</option>
          {inputsSignal.value.map((device) => (
            <option key={device.id} value={device.id}>{device.name || device.id}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="midi-output-select" className="mr-2 font-medium">MIDI Output:</label>
        <select
          id="midi-output-select"
          className="border border-[var(--color-border)] rounded px-2 py-1 w-full bg-[var(--color-bg)] text-[var(--color-text)]"
          value={outputSignal.value?.id || ''}
          onChange={handleOutputChange}
          aria-label="MIDI output device"
        >
          <option value="">None</option>
          {outputsSignal.value.map((device) => (
            <option key={device.id} value={device.id}>{device.name || device.id}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center">
        <input
          id="midi-auto-connect"
          type="checkbox"
          checked={autoSignal.value}
          onChange={handleAutoToggle}
          className="mr-2"
          aria-label="Auto connect to Deluge Port 3"
        />
        <label htmlFor="midi-auto-connect" className="font-medium">Auto-connect Deluge Port 3</label>
      </div>
    </div>
  );
}
