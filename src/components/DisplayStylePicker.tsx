/**
 * @deprecated This file is being replaced by PixelSizeControls and DisplayColorDrawer
 * Only the keyboard shortcut functions are still in use temporarily.
 */

import { displaySettings } from "../state";

/**
 * @deprecated - Use the same function from lib/display.ts instead
 */
export const increaseCanvasSize = () => {
  const { pixelWidth, pixelHeight, resizeStep, minSize, maxSize } =
    displaySettings.value;
  displaySettings.value = {
    ...displaySettings.value,
    pixelWidth: Math.max(minSize, Math.min(maxSize, pixelWidth + resizeStep)),
    pixelHeight: Math.max(minSize, Math.min(maxSize, pixelHeight + resizeStep)),
  };
};

/**
 * @deprecated - Use the same function from lib/display.ts instead
 */
export const decreaseCanvasSize = () => {
  const { pixelWidth, pixelHeight, resizeStep, minSize, maxSize } =
    displaySettings.value;
  displaySettings.value = {
    ...displaySettings.value,
    pixelWidth: Math.max(minSize, Math.min(maxSize, pixelWidth - resizeStep)),
    pixelHeight: Math.max(minSize, Math.min(maxSize, pixelHeight - resizeStep)),
  };
};
