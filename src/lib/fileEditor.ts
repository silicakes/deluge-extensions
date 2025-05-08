/**
 * Helper functions for text file editing
 * Used by BasicTextEditorModal
 */

import { readFile } from "@/commands";
import { writeFile } from "@/commands";

/**
 * Read a text file from the Deluge
 * @param path Path to the file to read
 * @returns Promise resolving with the file content as string
 */
export async function readTextFile(path: string): Promise<string> {
  try {
    console.log(`[fileEditor] Starting to read text file: ${path}`);

    // Use the existing readFile function which returns an ArrayBuffer
    const buffer = await readFile({ path });

    console.log(
      `[fileEditor] Buffer received, size: ${buffer.byteLength} bytes`,
    );

    // Convert buffer to text
    const decoder = new TextDecoder("utf-8");
    let text;

    try {
      text = decoder.decode(buffer);
      console.log(
        `[fileEditor] Successfully decoded buffer to text, length: ${text.length}`,
      );
    } catch (decodeError) {
      console.error(`[fileEditor] Error decoding buffer:`, decodeError);

      // Try a different approach for large files
      const array = new Uint8Array(buffer);
      let result = "";
      const chunkSize = 16384; // Process in smaller chunks to avoid memory issues

      for (let i = 0; i < array.length; i += chunkSize) {
        const chunk = array.slice(i, i + chunkSize);
        result += decoder.decode(
          chunk,
          i + chunkSize < array.length ? { stream: true } : {},
        );
      }

      text = result;
      console.log(
        `[fileEditor] Decoded using chunked approach, length: ${text.length}`,
      );
    }

    // Basic validation
    if (text === null || text === undefined) {
      throw new Error("Decoded text is null or undefined");
    }

    return text;
  } catch (error) {
    console.error(`[fileEditor] Error reading text file ${path}:`, error);
    throw error;
  }
}

/**
 * Write a text file to the Deluge
 * @param path Path to the file to write
 * @param content Text content to write
 * @returns Promise resolving when write is complete
 */
export async function writeTextFile(
  path: string,
  content: string,
): Promise<void> {
  // Use shared writeFile command for writing binary data
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  try {
    await writeFile({ path, data });
  } catch (error) {
    console.error(`Error writing text file ${path}:`, error);
    throw error;
  }
}
