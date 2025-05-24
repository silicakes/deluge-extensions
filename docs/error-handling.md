# Deluge Error Handling Guide

## Overview

The Deluge Client uses a comprehensive error handling system based on FatFS error codes returned by the Deluge device. This guide explains how to use the error handling system in your code.

## Error Codes

The Deluge returns numeric error codes in the `err` field of responses. These are based on the FatFS library:

| Code | Name                | Description                      | Recovery                        |
| ---- | ------------------- | -------------------------------- | ------------------------------- |
| 0    | SUCCESS             | Operation completed successfully | N/A                             |
| 1    | DISK_ERROR          | SD card error                    | Check card insertion/corruption |
| 2    | INTERNAL_ERROR      | Internal error                   | Retry or restart Deluge         |
| 3    | DRIVE_NOT_READY     | SD card not ready                | Ensure proper insertion         |
| 4    | FILE_NOT_FOUND      | File doesn't exist               | Check path                      |
| 5    | PATH_NOT_FOUND      | Directory doesn't exist          | Check path                      |
| 6    | INVALID_PATH        | Invalid path name                | Fix path syntax                 |
| 7    | ACCESS_DENIED       | Access denied                    | File may be in use              |
| 8    | FILE_EXISTS         | File already exists              | Use different name              |
| 9    | DIRECTORY_NOT_EMPTY | Directory has contents           | Delete contents first           |
| 10   | INVALID_OBJECT      | Invalid file/directory           | Item may be corrupted           |
| 11   | WRITE_PROTECTED     | SD card is locked                | Check lock switch               |
| 12   | INVALID_DRIVE       | Invalid drive                    | Check path                      |
| 13   | NO_FILESYSTEM       | No filesystem found              | Format SD card                  |
| 14   | FORMAT_ABORTED      | Format was aborted               | Retry format                    |
| 15   | NO_MORE_FILES       | End of directory                 | N/A                             |
| 16   | OUT_OF_MEMORY       | SD card full                     | Delete files                    |
| 17   | TOO_MANY_OPEN_FILES | Too many open files              | Close some files                |
| 18   | INVALID_PARAMETER   | Invalid parameter                | Fix parameters                  |

## Using the Error Handler

### Basic Usage

Always use the error handler for commands that return an error code:

```typescript
import { handleDelugeResponse } from "@/lib/errorHandler";

const response = await executeCommand(...);
handleDelugeResponse(response, 'commandName', { path: '/file.txt' });
```

### Custom Success Codes

Some commands treat certain error codes as success. For example, delete operations consider "file not found" as success:

```typescript
handleDelugeResponse(
  response,
  "delete",
  { path: itemPath },
  [0, 4], // Both 0 and 4 are considered success
);
```

### Error Context

Always provide context to help with debugging:

```typescript
handleDelugeResponse(response, "open", {
  path: filePath,
  mode: "read",
  size: expectedSize,
});
```

## Retry Logic

For operations that might fail transiently, use the retry handler:

```typescript
import { withRetry } from "@/lib/retryHandler";

// Basic retry with defaults (3 attempts, exponential backoff)
const result = await withRetry(() => uploadFile(params));

// Custom retry configuration
const result = await withRetry(() => readFile(params), {
  maxAttempts: 5,
  delayMs: 200,
  backoffMultiplier: 1.5,
  retryableErrors: [DelugeErrorCode.OUT_OF_MEMORY, DelugeErrorCode.DISK_ERROR],
});
```

Default retryable errors:

- `OUT_OF_MEMORY` - Temporary memory issues
- `DISK_ERROR` - Transient SD card errors
- `INTERNAL_ERROR` - Temporary internal errors

## User-Friendly Error Messages

The system automatically converts technical errors to user-friendly messages:

```typescript
import { getUserFriendlyError } from "@/lib/userErrorMessages";

try {
  await someOperation();
} catch (error) {
  const message = getUserFriendlyError(error);
  // Display message to user
}
```

## Error Display Component

Use the `ErrorAlert` component to display errors with proper styling:

```tsx
import { ErrorAlert } from "@/components/ErrorAlert";

<ErrorAlert
  error={error}
  onDismiss={() => setError(null)}
  actions={[
    {
      label: "Retry",
      onClick: handleRetry,
    },
  ]}
/>;
```

## Best Practices

1. **Always handle errors** - Never ignore the `err` field in responses
2. **Provide context** - Include relevant information (paths, operations, etc.)
3. **Use appropriate success codes** - Some operations have special success codes
4. **Consider retry logic** - For operations that might fail transiently
5. **Show user-friendly messages** - Don't expose technical details to users
6. **Clean up on error** - Always close files/handles in error cases

## Example: File Operations with Error Handling

```typescript
import { handleDelugeResponse } from "@/lib/errorHandler";
import { withRetry } from "@/lib/retryHandler";

export async function safeReadFile(path: string): Promise<ArrayBuffer> {
  return withRetry(async () => {
    // Open file
    const openResp = await executeCommand(...);
    const { fid, size } = handleDelugeResponse(openResp, 'open', { path });

    try {
      // Read file
      const data = await readFileData(fid, size);

      // Close file
      const closeResp = await executeCommand(...);
      handleDelugeResponse(closeResp, 'close', { fid });

      return data;
    } catch (error) {
      // Always try to close on error
      try {
        await executeCommand({ close: { fid } });
      } catch (closeError) {
        console.error('Failed to close file:', closeError);
      }
      throw error;
    }
  });
}
```

## Testing Error Handling

When writing tests, verify error handling:

```typescript
it("should handle file not found error", async () => {
  const response = { err: 4 };

  expect(() => handleDelugeResponse(response, "open")).toThrow(
    DelugeFileSystemError,
  );
});

it("should retry on transient errors", async () => {
  let attempts = 0;
  const operation = async () => {
    attempts++;
    if (attempts < 3) {
      throw new DelugeFileSystemError(DelugeErrorCode.DISK_ERROR, "read");
    }
    return "success";
  };

  const result = await withRetry(operation);
  expect(result).toBe("success");
  expect(attempts).toBe(3);
});
```
