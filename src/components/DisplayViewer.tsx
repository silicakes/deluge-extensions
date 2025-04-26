import { useEffect, useRef } from 'preact/hooks';
import { registerCanvas, drawOled, drawOledDelta, draw7Seg, resizeCanvas } from '../lib/display';
import { subscribeMidiListener } from '@/lib/midi';
import { displaySettings } from '../state';

/**
 * DisplayViewer – renders the Deluge OLED / 7-segment output onto a canvas.
 * At this stage it simply registers the canvas with display.ts helpers and
 * clears it on every incoming display packet. Detailed drawing logic will be
 * implemented inside the helpers later.
 */
export function DisplayViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Register the canvas with display helpers on mount
  useEffect(() => {
    if (canvasRef.current) {
      registerCanvas(canvasRef.current);
    }
  }, []);

  // Resize canvas when display settings change
  useEffect(() => {
    if (canvasRef.current) {
      resizeCanvas(canvasRef.current);
    }
  }, [displaySettings.value]);

  // Subscribe to raw MIDI messages so we can feed display helpers later
  useEffect(() => {
    const unsubscribe = subscribeMidiListener((e) => {
      const view = canvasRef.current;
      if (!view) return;

      const data = e.data as Uint8Array;
      if (data.length < 5 || data[0] !== 0xf0 || data[1] !== 0x7d) {
        return; // not our packet
      }

      // OLED full frame
      if (data[2] === 0x02 && data[3] === 0x40 && data[4] === 1) {
        drawOled(view, data);
      }
      // OLED delta
      else if (data[2] === 0x02 && data[3] === 0x40 && data[4] === 2) {
        drawOledDelta(view, data);
      }
      // 7-seg packet
      else if (data[2] === 0x02 && data[3] === 0x41 && data[4] === 0) {
        const dots = data[6];
        const digitsRaw = Array.from(data.subarray(7, 11));
        draw7Seg(view, digitsRaw, dots);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <div className="border mx-auto inline-block p-0">
      <canvas ref={canvasRef} />
    </div>
  );
} 