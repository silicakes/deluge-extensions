/**
 * Legacy MIDI helper commands shim
 */
export {
  uploadFiles,
  testSysExConnectivity,
  checkFirmwareSupport,
  triggerBrowserDownload,
  cancelFileTransfer,
  cancelAllFileTransfers,
  removeTransferFromList,
  sendCustomSysEx,
  getDebug,
  initMidi,
  startMonitor,
  stopMonitor,
  selectDelugeDevice,
  subscribeMidiListener,
} from "@/lib/midi";
