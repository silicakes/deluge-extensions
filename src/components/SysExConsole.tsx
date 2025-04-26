import { useState, useRef, useEffect, useLayoutEffect } from 'preact/hooks';
import { sendCustomSysEx, getDebug } from '../lib/midi';
import { copyCanvasToBase64 } from '../lib/display';
import { clearDebug, useDebugLog } from '../lib/debug';

export const SysExConsole = () => {
  // State
  const [isOpen, setIsOpen] = useState(false);
  const [sysExInput, setSysExInput] = useState("0xF0 0x7d 0x03 0x00 0x01 0xF7");
  const [autoDebug, setAutoDebug] = useState(false);
  const debugLogRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const debugLog = useDebugLog();
  
  // Auto debug polling effect
  useEffect(() => {
    let interval: number | null = null;
    
    if (autoDebug) {
      interval = window.setInterval(() => {
        getDebug();
      }, 1000);
    }
    
    return () => {
      if (interval !== null) {
        clearInterval(interval);
      }
    };
  }, [autoDebug]);
  
  // Scroll to bottom of log when content changes
  useLayoutEffect(() => {
    if (debugLogRef.current) {
      debugLogRef.current.scrollTop = debugLogRef.current.scrollHeight;
    }
  }, [debugLog.value]);
  
  // Close drawer when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node) && isOpen) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  // Handlers
  const toggleDrawer = () => setIsOpen(prev => !prev);
  
  const handleSendCustomSysEx = () => {
    const result = sendCustomSysEx(sysExInput);
    if (result) {
      // The message will be processed and displayed in the debug log
    }
  };
  
  const handleToggleAutoDebug = () => {
    setAutoDebug(prev => !prev);
  };
  
  const handleCopyBase64 = () => {
    copyCanvasToBase64();
  };
  
  const handleClearDebug = () => {
    clearDebug();
  };
  
  return (
    <>
      {/* Settings button */}
      <button 
        onClick={toggleDrawer}
        className="fixed left-4 top-4 z-50 p-2 rounded-full bg-gray-800 text-white shadow-lg"
        aria-label="Toggle SysEx Console"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" />
        </svg>
      </button>
      
      {/* Drawer */}
      <div 
        ref={drawerRef}
        className={`fixed left-0 bottom-0 w-96 max-w-full bg-gray-800 text-white shadow-lg z-40 transition-transform duration-300 ${isOpen ? 'translate-y-0' : 'translate-y-full'} h-96 flex flex-col`}
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700">
          <h2 className="text-lg font-semibold">SysEx Console</h2>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white"
            aria-label="Close SysEx Console"
          >
            &times;
          </button>
        </div>
        
        {/* Debug Log */}
        <div 
          ref={debugLogRef}
          className="flex-1 p-2 overflow-y-auto font-mono text-sm bg-gray-900 whitespace-pre-wrap"
        >
          {debugLog.value.map((msg: string, index: number) => (
            <div key={index} className="mb-1">{msg}</div>
          ))}
        </div>
        
        {/* Controls */}
        <div className="p-2 flex items-center gap-2 border-t border-gray-700">
          <button 
            onClick={handleClearDebug}
            className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-sm"
            aria-label="Clear debug log"
          >
            Clear
          </button>
          
          <button 
            onClick={handleToggleAutoDebug}
            className={`px-3 py-1 rounded text-sm ${autoDebug ? 'bg-green-700 hover:bg-green-600' : 'bg-blue-700 hover:bg-blue-600'}`}
            aria-label={autoDebug ? 'Stop auto-debug' : 'Start auto-debug'}
          >
            {autoDebug ? 'Stop Auto' : 'Auto'}
          </button>
          
          <span className="ml-2 text-sm">
            Status: {autoDebug ? 'ON' : 'OFF'}
          </span>
          
          <button 
            onClick={handleCopyBase64}
            className="ml-auto px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded text-sm"
            aria-label="Copy Base64 of OLED buffer"
          >
            Copy Base64
          </button>
        </div>
        
        {/* Custom SysEx Input */}
        <div className="p-2 flex gap-2 border-t border-gray-700">
          <input
            type="text"
            value={sysExInput}
            onChange={(e) => setSysExInput((e.target as HTMLInputElement).value)}
            className="flex-1 px-3 py-2 bg-gray-700 rounded text-sm font-mono"
            placeholder="0xF0 ... 0xF7"
            aria-label="Custom SysEx input"
          />
          
          <button 
            onClick={handleSendCustomSysEx}
            className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded"
            aria-label="Send custom SysEx command"
          >
            Send
          </button>
        </div>
      </div>
    </>
  );
};
