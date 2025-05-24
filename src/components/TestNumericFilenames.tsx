import { useSignal } from "@preact/signals";
import { uploadFiles, listDirectoryComplete, writeFile } from "@/commands";
import { midiOut } from "@/state";

export default function TestFilenameIssues() {
  const results = useSignal<string[]>([]);
  const isRunning = useSignal(false);
  const testMode = useSignal<"upload" | "create">("upload");

  const log = (msg: string) => {
    console.log(msg);
    results.value = [...results.value, msg];
  };

  const testUpload = async (filename: string, content: string) => {
    log(`\n--- Testing upload: "${filename}" ---`);

    const file = new File([content], filename, { type: "text/plain" });

    try {
      log(`Creating file object: name="${file.name}", size=${file.size}`);

      // Patch console.log temporarily to capture what's being sent
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (...args) => {
        originalLog(...args);
        logs.push(args.join(" "));
      };

      await uploadFiles({
        files: [file],
        destDir: "/",
        overwrite: true,
      });

      // Restore console.log
      console.log = originalLog;

      // Check what was logged
      const jsonPayloadLog = logs.find((l) => l.includes("JSON payload:"));
      if (jsonPayloadLog) {
        log(`JSON sent: ${jsonPayloadLog}`);
      }

      // Look for the actual SysEx message
      const sysexLog = logs.find((l) => l.includes("SysEx message:"));
      if (sysexLog) {
        // Extract just the hex part after "SysEx message:"
        const hexPart = sysexLog.split("SysEx message:")[1]?.trim();
        if (hexPart) {
          // Look for the JSON part in the hex (after header, before footer)
          const hexBytes = hexPart.split(" ");
          const jsonStartIdx = hexBytes.findIndex((b) => b === "0x7b"); // '{'
          const jsonEndIdx = hexBytes.findIndex((b) => b === "0x7d"); // '}'

          if (jsonStartIdx >= 0 && jsonEndIdx >= 0) {
            const jsonHex = hexBytes.slice(jsonStartIdx, jsonEndIdx + 1);
            const jsonStr = jsonHex
              .map((h) => String.fromCharCode(parseInt(h, 16)))
              .join("");
            log(`Extracted JSON from SysEx: ${jsonStr}`);
          }
        }
      }

      // Also look for the file open command
      const openLog = logs.find((l) =>
        l.includes("[uploadFile] Starting upload:"),
      );
      if (openLog) {
        log(`Upload details: ${openLog}`);
      }

      log(`✅ Upload completed for "${filename}"`);

      // Verify by listing directory
      const entries = await listDirectoryComplete({ path: "/", force: true });
      const uploadedFile = entries.find((e) => e.name === filename);

      if (uploadedFile) {
        log(
          `✅ File found in directory listing: ${JSON.stringify(uploadedFile)}`,
        );
      } else {
        log(`❌ File NOT found in directory listing!`);
        // Check for corrupted entries
        const corruptedEntries = entries.filter((e) => e.attr === 47);
        if (corruptedEntries.length > 0) {
          log(
            `⚠️  Found corrupted entries (attr: 47): ${corruptedEntries.map((e) => e.name).join(", ")}`,
          );
        }
      }
    } catch (err) {
      log(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const testCreate = async (filename: string, content: string) => {
    log(`\n--- Testing create: "${filename}" ---`);

    try {
      const data = new TextEncoder().encode(content);
      log(
        `Creating file via writeFile: path="/${filename}", size=${data.length}`,
      );

      await writeFile({
        path: `/${filename}`,
        data: data,
      });

      log(`✅ Create completed for "${filename}"`);

      // Verify by listing directory
      const entries = await listDirectoryComplete({ path: "/", force: true });
      const createdFile = entries.find((e) => e.name === filename);

      if (createdFile) {
        log(
          `✅ File found in directory listing: ${JSON.stringify(createdFile)}`,
        );
      } else {
        log(`❌ File NOT found in directory listing!`);
        // Check for corrupted entries
        const corruptedEntries = entries.filter((e) => e.attr === 47);
        if (corruptedEntries.length > 0) {
          log(
            `⚠️  Found corrupted entries (attr: 47): ${corruptedEntries.map((e) => e.name).join(", ")}`,
          );
        }
      }
    } catch (err) {
      log(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const runTests = async () => {
    if (!midiOut.value) {
      log("❌ No MIDI device connected");
      return;
    }

    isRunning.value = true;
    results.value = [];

    log(`Starting filename compatibility tests (mode: ${testMode.value})...`);

    // Test various filename patterns - focusing on numbers + spaces
    const testCases = [
      // Control cases
      { name: "normal.txt", desc: "Normal filename (control)" },
      { name: "123.txt", desc: "Just numbers (should work)" },

      // Letters + spaces (might work)
      { name: "BS Bread.xml", desc: "Letters + space + letters" },
      { name: "Test File.txt", desc: "Capitalized words with space" },
      { name: "my song.xml", desc: "Lowercase with space" },

      // Numbers + spaces (likely to fail)
      { name: "00 test.txt", desc: "Numbers + space + text" },
      { name: "123 song.xml", desc: "Numbers + space + text" },
      { name: "1 Track.wav", desc: "Single digit + space" },
      { name: "99 Problems.txt", desc: "Two digits + space" },
      { name: "2024 01 01.txt", desc: "Multiple number groups with spaces" },

      // Mixed patterns
      { name: "Track 01.wav", desc: "Text + space + numbers" },
      { name: "Song1 Remix.xml", desc: "Text+number + space" },
      { name: "1Song Remix.xml", desc: "Number+text + space" },

      // Edge cases
      { name: " leading.txt", desc: "Leading space only" },
      { name: "trailing .txt", desc: "Trailing space only" },
      { name: "no_spaces.txt", desc: "Underscores (should work)" },
      { name: "with-dashes.txt", desc: "Dashes (should work)" },

      // Special characters
      { name: "test\ttab.txt", desc: "Contains tab character" },
      { name: "test\nline.txt", desc: "Contains newline" },
    ];

    for (const test of testCases) {
      if (testMode.value === "upload") {
        await testUpload(test.name, `Test content for: ${test.desc}`);
      } else {
        // Add prefix to avoid conflicts with upload tests
        await testCreate(`c_${test.name}`, `Test content for: ${test.desc}`);
      }
      // Small delay between tests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    log("\n✅ All tests completed!");
    log("\n📋 Summary:");
    log("- Look for patterns in what works vs what fails");
    log("- Pay attention to: numbers+space vs letters+space");
    log("- Check if position of numbers matters");
    log("- Note any corrupted entries (attr: 47) created");

    isRunning.value = false;
  };

  const countRootEntries = async () => {
    if (!midiOut.value) {
      log("❌ No MIDI device connected");
      return;
    }

    isRunning.value = true;
    results.value = [];

    log("=== Counting Root Directory Entries ===\n");

    try {
      const entries = await listDirectoryComplete({ path: "/", force: true });

      // Count different types
      const files = entries.filter(
        (e) => (e.attr & 0x10) === 0 && e.attr !== 47,
      );
      const directories = entries.filter((e) => (e.attr & 0x10) !== 0);
      const corrupted = entries.filter((e) => e.attr === 47);

      log(`Total entries: ${entries.length}`);
      log(`- Regular files: ${files.length}`);
      log(`- Directories: ${directories.length}`);
      log(
        `- Corrupted entries: ${corrupted.length} (${corrupted.map((e) => e.name).join(", ")})`,
      );
      log(`\nFAT32 root directory limit: 512 entries`);
      log(
        `Space used: ${entries.length}/512 (${Math.round((entries.length / 512) * 100)}%)`,
      );
      log(`Free slots: ${512 - entries.length}`);

      if (entries.length >= 500) {
        log("\n⚠️ WARNING: Root directory is nearly full!");
        log("This explains why new files can't be created in root.");
        log("Solution: Use subdirectories instead of root.");
      }

      // List all files to see what's taking up space
      log("\n=== Files in root (first 20) ===");
      files.slice(0, 20).forEach((f) => {
        log(`  ${f.name} (${f.size} bytes)`);
      });
      if (files.length > 20) {
        log(`  ... and ${files.length - 20} more files`);
      }
    } catch (err) {
      log(`❌ Error counting entries: ${err}`);
    }

    isRunning.value = false;
  };

  const runDiagnosticTest = async () => {
    if (!midiOut.value) {
      log("❌ No MIDI device connected");
      return;
    }

    isRunning.value = true;
    results.value = [];

    log("Running diagnostic test to understand the failure pattern...\n");

    // Test 1: Check if the issue is order-dependent
    log("=== Test 1: Order dependency ===");

    // First, test files that failed before
    await testUpload("test_underscores.txt", "Testing underscores");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await testUpload("test-with-dashes.txt", "Testing dashes");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Now test a file with spaces
    await testUpload("test with spaces.txt", "Testing spaces");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test 2: Check if corrupted entries are affecting new uploads
    log("\n=== Test 2: Impact of corrupted entries ===");
    const entries = await listDirectoryComplete({ path: "/", force: true });
    const corruptedEntries = entries.filter((e) => e.attr === 47);
    log(
      `Current corrupted entries: ${corruptedEntries.map((e) => e.name).join(", ")}`,
    );

    // Test 3: Try uploading to a subdirectory instead of root
    log("\n=== Test 3: Upload to subdirectory ===");
    try {
      const songsEntries = await listDirectoryComplete({
        path: "/SONGS",
        force: true,
      });
      log(`/SONGS directory has ${songsEntries.length} files`);

      // Upload a file that previously failed
      const file = new File(["Test content"], "subdir_test.txt", {
        type: "text/plain",
      });
      await uploadFiles({
        files: [file],
        destDir: "/SONGS",
        overwrite: true,
      });

      const updatedSongs = await listDirectoryComplete({
        path: "/SONGS",
        force: true,
      });
      const uploaded = updatedSongs.find((e) => e.name === "subdir_test.txt");
      if (uploaded) {
        log(`✅ File uploaded successfully to /SONGS`);
      } else {
        log(`❌ File not found in /SONGS after upload`);
      }
    } catch (err) {
      log(`❌ Subdirectory test failed: ${err}`);
    }

    // Test 4: Check the exact sequence when things start failing
    log("\n=== Test 4: Failure sequence ===");
    const testSequence = [
      "seq1.txt",
      "seq2.txt",
      "seq_3.txt",
      "seq-4.txt",
      "seq 5.txt",
      "seq6.txt",
    ];

    for (let i = 0; i < testSequence.length; i++) {
      const filename = testSequence[i];
      log(`\nTesting file ${i + 1}/${testSequence.length}: "${filename}"`);

      const beforeEntries = await listDirectoryComplete({
        path: "/",
        force: true,
      });
      const beforeCount = beforeEntries.filter(
        (e) => (e.attr & 0x10) === 0,
      ).length; // Count files only

      await testUpload(filename, `Sequence test ${i + 1}`);

      const afterEntries = await listDirectoryComplete({
        path: "/",
        force: true,
      });
      const afterCount = afterEntries.filter(
        (e) => (e.attr & 0x10) === 0,
      ).length;

      log(`File count before: ${beforeCount}, after: ${afterCount}`);

      if (afterCount === beforeCount) {
        log(`⚠️ File count didn't increase - upload may have failed`);
        // Check if this is where things start failing consistently
        const remainingTests = testSequence.slice(i + 1);
        if (remainingTests.length > 0) {
          log(`Skipping remaining tests: ${remainingTests.join(", ")}`);
        }
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    log("\n✅ Diagnostic test completed!");
    isRunning.value = false;
  };

  const runAdvancedDiagnostic = async () => {
    if (!midiOut.value) {
      log("❌ No MIDI device connected");
      return;
    }

    isRunning.value = true;
    results.value = [];

    log("Running advanced diagnostic to pinpoint the issue...\n");

    // Test 1: Check if specific file position triggers failure
    log("=== Test 1: Finding the failure trigger ===");

    // Get current file list
    const initialEntries = await listDirectoryComplete({
      path: "/",
      force: true,
    });
    const initialFiles = initialEntries.filter(
      (e) => (e.attr & 0x10) === 0 && e.attr !== 47,
    );
    log(`Starting with ${initialFiles.length} files in root`);

    // Try to create files one by one until failure
    let failurePosition = -1;
    for (let i = 1; i <= 10; i++) {
      const testName = `diag_${Date.now()}_${i}.txt`;
      try {
        const file = new File([`Diagnostic test ${i}`], testName, {
          type: "text/plain",
        });
        await uploadFiles({
          files: [file],
          destDir: "/",
          overwrite: true,
        });

        // Check if it was created
        const checkEntries = await listDirectoryComplete({
          path: "/",
          force: true,
        });
        const found = checkEntries.find((e) => e.name === testName);

        if (found) {
          log(
            `✅ File ${i} created successfully at position ${initialFiles.length + i}`,
          );
        } else {
          log(
            `❌ File ${i} failed to create at position ${initialFiles.length + i}`,
          );
          failurePosition = initialFiles.length + i;
          break;
        }
      } catch (err) {
        log(`❌ Error creating file ${i}: ${err}`);
        failurePosition = initialFiles.length + i;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (failurePosition > 0) {
      log(
        `\n⚠️ Failure consistently occurs at position ${failurePosition} in root directory`,
      );
    }

    // Test 2: Check if the corrupted entries are at specific positions
    log("\n=== Test 2: Analyzing corrupted entry positions ===");
    const allEntries = await listDirectoryComplete({ path: "/", force: true });

    // Find positions of corrupted entries
    allEntries.forEach((entry, index) => {
      if (entry.attr === 47) {
        log(`Corrupted entry "${entry.name}" at position ${index + 1}`);
      }
    });

    // Test 3: Try creating a file with a very simple name
    log("\n=== Test 3: Minimal filename test ===");
    const minimalTests = ["a.txt", "1.txt", "test.txt"];

    for (const name of minimalTests) {
      try {
        const file = new File(["minimal"], name, { type: "text/plain" });
        await uploadFiles({
          files: [file],
          destDir: "/",
          overwrite: true,
        });

        const entries = await listDirectoryComplete({ path: "/", force: true });
        const found = entries.find((e) => e.name === name);

        if (found) {
          log(`✅ Minimal filename "${name}" uploaded successfully`);
        } else {
          log(`❌ Even minimal filename "${name}" failed!`);
        }
      } catch (err) {
        log(`❌ Error with minimal filename "${name}": ${err}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Test 4: Check if create (writeFile) behaves differently than upload
    log("\n=== Test 4: Comparing upload vs create ===");
    const testName = `compare_${Date.now()}.txt`;

    // Try upload first
    try {
      const file = new File(["upload test"], testName, { type: "text/plain" });
      await uploadFiles({
        files: [file],
        destDir: "/",
        overwrite: true,
      });

      const entries = await listDirectoryComplete({ path: "/", force: true });
      const found = entries.find((e) => e.name === testName);
      log(found ? `✅ Upload succeeded` : `❌ Upload failed`);
    } catch (err) {
      log(`❌ Upload error: ${err}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Try create
    const createName = `create_${Date.now()}.txt`;
    try {
      await writeFile({
        path: `/${createName}`,
        data: new TextEncoder().encode("create test"),
      });

      const entries = await listDirectoryComplete({ path: "/", force: true });
      const found = entries.find((e) => e.name === createName);
      log(found ? `✅ Create succeeded` : `❌ Create failed`);
    } catch (err) {
      log(`❌ Create error: ${err}`);
    }

    log("\n✅ Advanced diagnostic completed!");
    log("\n💡 Next steps:");
    log("1. If failure is position-based, it might be a FAT table issue");
    log("2. If all root operations fail, consider reformatting the SD card");
    log("3. Use subdirectories as a reliable workaround");

    isRunning.value = false;
  };

  const testSubdirectoryLimit = async () => {
    if (!midiOut.value) {
      log("❌ No MIDI device connected");
      return;
    }

    isRunning.value = true;
    results.value = [];

    log("Testing subdirectory file limits...\n");

    // Test 1: Create many files in /SONGS to see if it has the same limit
    log("=== Test 1: Upload 30 files to /SONGS ===");

    let songsSuccessCount = 0;
    for (let i = 1; i <= 30; i++) {
      const filename = `subtest_${i}.txt`;
      const file = new File([`Test content ${i}`], filename, {
        type: "text/plain",
      });

      try {
        await uploadFiles({
          files: [file],
          destDir: "/SONGS",
          overwrite: true,
        });

        // Verify it was created
        const entries = await listDirectoryComplete({
          path: "/SONGS",
          force: true,
        });
        const found = entries.find((e) => e.name === filename);

        if (found) {
          songsSuccessCount++;
          log(`✅ File ${i} created successfully in /SONGS`);
        } else {
          log(`❌ File ${i} failed at position ${i} in /SONGS`);
          break;
        }
      } catch (err) {
        log(`❌ Error creating file ${i}: ${err}`);
        break;
      }

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    log(
      `\n📊 /SONGS Results: ${songsSuccessCount}/30 files created successfully`,
    );

    // Test 2: Try root again after subdirectory test
    log("\n=== Test 2: Try root directory after subdirectory test ===");

    const testName = `root_after_subdir_${Date.now()}.txt`;
    try {
      const file = new File(["Test after subdir"], testName, {
        type: "text/plain",
      });
      await uploadFiles({
        files: [file],
        destDir: "/",
        overwrite: true,
      });

      const entries = await listDirectoryComplete({ path: "/", force: true });
      const found = entries.find((e) => e.name === testName);

      if (found) {
        log(`✅ Root directory upload WORKS after subdirectory operations!`);
      } else {
        log(
          `❌ Root directory still broken even after subdirectory operations`,
        );
      }
    } catch (err) {
      log(`❌ Root directory error: ${err}`);
    }

    log("\n✅ Subdirectory limit test completed!");
    isRunning.value = false;
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Filename Compatibility Test</h2>

      <div className="mb-4 flex gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Test Mode:</label>
          <select
            value={testMode.value}
            onChange={(e) =>
              (testMode.value = e.currentTarget.value as "upload" | "create")
            }
            className="px-3 py-1 border rounded dark:bg-gray-800"
            disabled={isRunning.value}
          >
            <option value="upload">Upload Files</option>
            <option value="create">Create Files (writeFile)</option>
          </select>
        </div>

        <button
          onClick={runTests}
          disabled={isRunning.value || !midiOut.value}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {isRunning.value ? "Running Tests..." : "Run Tests"}
        </button>

        <button
          onClick={runDiagnosticTest}
          disabled={isRunning.value || !midiOut.value}
          className="px-4 py-2 bg-purple-500 text-white rounded disabled:opacity-50"
        >
          {isRunning.value ? "Running..." : "Run Diagnostic"}
        </button>

        <button
          onClick={countRootEntries}
          disabled={isRunning.value || !midiOut.value}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
        >
          {isRunning.value ? "Counting..." : "Count Root Entries"}
        </button>

        <button
          onClick={runAdvancedDiagnostic}
          disabled={isRunning.value || !midiOut.value}
          className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
        >
          {isRunning.value ? "Running..." : "Advanced Diagnostic"}
        </button>

        <button
          onClick={testSubdirectoryLimit}
          disabled={isRunning.value || !midiOut.value}
          className="px-4 py-2 bg-yellow-500 text-white rounded disabled:opacity-50"
        >
          {isRunning.value ? "Running..." : "Test Subdirectory Limit"}
        </button>

        {!midiOut.value && (
          <p className="text-red-500 mt-2">Connect a MIDI device first</p>
        )}
      </div>

      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded">
        <h3 className="font-bold mb-2">Test Results:</h3>
        <pre className="text-xs whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
          {results.value.length > 0
            ? results.value.join("\n")
            : "No tests run yet"}
        </pre>
      </div>

      <div className="mt-4 p-4 bg-yellow-100 dark:bg-yellow-900 rounded">
        <h3 className="font-bold mb-2">🔧 Implementation Issue Found!</h3>
        <p className="text-sm mb-2">
          <strong>This is NOT a Deluge firmware bug</strong> - the official
          vuefinder works fine!
        </p>
        <h4 className="font-semibold text-sm mt-2">Issue Details:</h4>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>Our implementation fails after ~17-26 files in root</li>
          <li>Once failure occurs, session state may be corrupted</li>
          <li>
            Subdirectories work because they're less likely to hit edge cases
          </li>
        </ul>
        <h4 className="font-semibold text-sm mt-3">
          Root Cause ACTUALLY Found:
        </h4>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>
            <strong>🎯 Message ID Exhaustion:</strong> Sessions have limited
            message IDs (7 cycling IDs)
          </li>
          <li>Each file uses 3+ message IDs (open, write(s), close)</li>
          <li>After ~25-30 operations, all IDs are exhausted</li>
          <li>Subdirs fail even faster (7 files) due to the same limit</li>
          <li>Fix: Auto-renew session every 20 messages to get fresh IDs</li>
        </ul>
        <p className="text-sm mt-2 font-semibold bg-green-100 dark:bg-green-900 p-2 rounded">
          ✅ Critical Fix Applied: Auto-renew sessions every 20 messages!
          <br />
          This prevents message ID exhaustion that was causing failures.
          <br />
          Test now - you should be able to upload many more files!
        </p>
        <p className="text-sm mt-1 italic">
          Note: Tab (\t) and newline (\n) characters always fail (error 9) -
          this is expected.
        </p>
      </div>
    </div>
  );
}
