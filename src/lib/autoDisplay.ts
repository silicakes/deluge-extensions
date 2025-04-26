import { effect } from '@preact/signals';
import { autoDisplay, midiOut } from '../state';
import { getDisplay } from './midi';
import { startPolling, stopPolling } from './display';

// Save autoDisplay preference when it changes
effect(() => {
  localStorage.setItem('dex-auto-display', autoDisplay.value.toString());
});

// Effect that manages display polling based on device connectivity and preferences
effect(() => {
  if (autoDisplay.value && navigator.onLine && midiOut.value) {
    // Immediate paint with force=true
    getDisplay(true);
    // Start continuous polling
    startPolling();
  } else {
    // Stop polling when conditions aren't met
    stopPolling();
  }
}); 