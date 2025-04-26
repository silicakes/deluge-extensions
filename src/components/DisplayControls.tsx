import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import {
  ping,
  getOled,
  get7Seg,
  flipScreen,
  getDebug,
  getDisplay,
  startMonitor,
  stopMonitor,
} from '../lib/midi';
import { midiOut, monitorMode, autoDisplay } from '../state';
import { Button } from './Button';
import {
  captureScreenshot,
  copyCanvasToBase64,
  toggleFullScreen,
  increaseCanvasSize,
  decreaseCanvasSize,
  startPolling,
  stopPolling,
} from '../lib/display';

export function DisplayControls() {
  // Local signal for refresh toggle
  const refreshSignal = useSignal(false);

  // Disable controls if no MIDI out or offline
  const disabled = !midiOut.value || !navigator.onLine;

  // Add new signals for fullscreen state to disable size buttons accordingly
  const fullScreenSignal = useSignal<boolean>(!!document.fullscreenElement);

  // Listen to fullscreenchange events to keep signal in sync
  useEffect(() => {
    const handler = () => {
      fullScreenSignal.value = !!document.fullscreenElement;
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Handlers for display controls
  const handlePing = () => ping();
  const handleOled = () => getOled();
  const handle7Seg = () => get7Seg();
  const handleFlip = () => flipScreen();
  const handleDebug = () => getDebug();

  // Handlers for new controls
  const handleScreenshot = () => captureScreenshot();
  const handleCopy = () => copyCanvasToBase64();
  const handleFullScreen = () => toggleFullScreen();
  const handleIncrease = () => increaseCanvasSize();
  const handleDecrease = () => decreaseCanvasSize();

  const toggleRefresh = () => {
    const newValue = !refreshSignal.value;
    refreshSignal.value = newValue;
    
    // When manually turning off refresh, also turn off auto-display
    if (!newValue) {
      autoDisplay.value = false;
    }
  };
  
  const toggleAutoDisplay = () => {
    autoDisplay.value = !autoDisplay.value;
    
    // When turning off auto-display, also turn off refresh if it's running
    if (!autoDisplay.value && refreshSignal.value) {
      refreshSignal.value = false;
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
      <Button onClick={handlePing} disabled={disabled}>Ping</Button>
      <Button onClick={handleOled} disabled={disabled}>Get OLED</Button>
      <Button onClick={handle7Seg} disabled={disabled}>Get 7-Seg</Button>
      <Button onClick={handleFlip} disabled={disabled}>Flip Screen</Button>
      <Button onClick={handleDebug} disabled={disabled}>Get Debug</Button>
      <Button onClick={toggleRefresh} disabled={disabled}>
        {refreshSignal.value ? 'Pause' : 'Refresh'}
      </Button>
      <div className="flex items-center ml-1 mr-1" title="Auto-display when device connects">
        <input
          type="checkbox"
          id="autoDisplayToggle"
          checked={autoDisplay.value}
          onChange={toggleAutoDisplay}
          disabled={disabled}
          className="mr-1"
        />
        <label htmlFor="autoDisplayToggle" className={disabled ? 'text-gray-500' : ''}>
          Auto Display
        </label>
      </div>
      <Button onClick={toggleMonitor} disabled={disabled}>
        {monitorMode.value ? 'Stop Monitoring' : 'Monitor'}
      </Button>
      <Button onClick={handleScreenshot} disabled={disabled}>📸 Screenshot</Button>
      <Button onClick={handleCopy} disabled={disabled}>📋 Copy Base64</Button>
      <Button onClick={handleFullScreen} disabled={disabled}>
        {fullScreenSignal.value ? 'Exit Full' : 'Full Screen'}
      </Button>
      <Button onClick={handleIncrease} disabled={disabled || fullScreenSignal.value}>＋ Size</Button>
      <Button onClick={handleDecrease} disabled={disabled || fullScreenSignal.value}>－ Size</Button>
    </div>
  );
}
