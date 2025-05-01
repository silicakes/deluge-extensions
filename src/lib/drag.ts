/**
 * Helper functions for drag and drop operations
 */

/**
 * Check if the drag event contains external files
 * Used to determine if drop targets should accept the drag
 */
export function isExternalFileDrag(e: DragEvent): boolean {
  return e.dataTransfer?.types.includes("Files") || false;
}

/**
 * Check if the drag event contains internal Deluge paths
 * Used for internal file/folder moves
 */
export function isInternalDrag(e: DragEvent): boolean {
  return e.dataTransfer?.types.includes("application/deluge-path") || false;
}
