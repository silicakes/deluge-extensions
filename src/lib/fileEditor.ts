/**
 * Helper functions for text file editing
 * Used by BasicTextEditorModal
 */

import { readFile as readFileRaw } from "./midi";
import { pack7 } from "./pack7";
import { sendJson } from "./smsysex";
import { midiOut } from "../state";

/**
 * Read a text file from the Deluge
 * @param path Path to the file to read
 * @returns Promise resolving with the file content as string
 */
export async function readTextFile(path: string): Promise<string> {
  try {
    console.log(`[fileEditor] Starting to read text file: ${path}`);

    // Use the existing readFile function which returns an ArrayBuffer
    const buffer = await readFileRaw(path);

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
  if (!midiOut.value) throw new Error("MIDI Output not connected");

  // Calculate FAT date/time
  const now = new Date();
  const fatDate =
    ((now.getFullYear() - 1980) << 9) |
    ((now.getMonth() + 1) << 5) |
    now.getDate();
  const fatTime =
    (now.getHours() << 11) |
    (now.getMinutes() << 5) |
    Math.floor(now.getSeconds() / 2);

  try {
    // 1. Open file with write flag
    const openCommand = {
      open: {
        path,
        write: 1, // 1 = create or truncate
        date: fatDate,
        time: fatTime,
      },
    };

    // Send open command
    const response = await sendJson(openCommand);

    // Parse response to get file ID
    if (
      !response ||
      !(response["^open"] || response.open) ||
      typeof (response["^open"] || response.open) !== "object" ||
      (response["^open"] || response.open) === null
    ) {
      throw new Error("Invalid response from open command");
    }

    interface OpenObj {
      fid?: number;
      size?: number;
      err?: number;
    }
    const openObj: OpenObj | undefined =
      (response as { open?: OpenObj })?.open ??
      (response as { "^open"?: OpenObj })["^open"];

    if (!openObj) {
      throw new Error("Invalid open response from device");
    }

    // Check for error
    if (openObj.err !== undefined && openObj.err !== 0) {
      throw new Error(`Failed to open file: Error ${openObj.err}`);
    }

    const fileId = openObj.fid ?? 1;

    // 2. Write the content
    // Convert string to Uint8Array
    const data = new TextEncoder().encode(content);
    const chunkSize = 1024; // Max size per write block

    for (let offset = 0; offset < data.length; offset += chunkSize) {
      const chunk = data.slice(offset, offset + chunkSize);

      // Prepare write command as JSON
      const writeCommand = {
        write: {
          fid: fileId,
          addr: offset,
          size: chunk.length,
        },
      };

      // Convert JSON to string and then to bytes
      const writeJsonStr = JSON.stringify(writeCommand);
      const writeJsonBytes = Array.from(new TextEncoder().encode(writeJsonStr));

      // Encode the binary data in 7-bit format
      const encodedChunk = pack7(chunk);

      // Write command: JSON header, 0x00 separator, then 7-bit encoded data
      const writeSysex = [
        0xf0,
        0x7d, // Developer ID
        0x04, // Json command
        0x09, // Message ID (should be session-based in real impl)
        ...writeJsonBytes,
        0x00, // Separator between JSON and binary data
        ...encodedChunk,
        0xf7, // End of SysEx
      ];

      // Send the command
      if (!midiOut.value) throw new Error("MIDI connection lost during write");
      midiOut.value.send(writeSysex);

      // Wait for device to process the data
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // 3. Close the file
    const closeCommand = {
      close: {
        fid: fileId,
      },
    };

    await sendJson(closeCommand);

    console.log(`File ${path} successfully written`);
  } catch (error) {
    console.error(`Error writing text file ${path}:`, error);
    throw error;
  }
}
