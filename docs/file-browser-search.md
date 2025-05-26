# File Browser Search

The DEx file browser now includes powerful search functionality to help you quickly find files in large collections.

## Features

### Fuzzy Search

- **Smart matching**: Finds files even with typos or partial names
- **Real-time results**: Search results appear as you type
- **Deep search**: Automatically loads directories to find files anywhere on your SD card
- **Path context**: Shows the full directory path for each result
- **File type icons**: Visual indicators for different file types

### Search Interface

- **Search bar**: Located at the top of the file browser
- **Keyboard shortcut**: Press `Ctrl+F` (or `Cmd+F` on Mac) to focus the search
- **Clear button**: Click the X button or press `Escape` to clear search
- **Loading indicator**: Spinning icon shows when directories are being loaded
- **Result count**: Shows how many files match your search

## How to Use

### Basic Search

1. Open the file browser by clicking the folder icon
2. Start typing in the search box at the top
3. Results will appear instantly, replacing the tree view
4. **Click on any result to select it immediately** - no need to navigate first!

### Direct Interaction

Search results support immediate interaction:

- **Single click**: Select the file/folder (stays in search mode)
- **Ctrl/Cmd + click**: Toggle selection (multi-select support)
- **Double-click**:
  - Files: Open preview (audio) or editor (text)
  - Folders: Navigate to folder in tree view
- **Right-click**: Show context menu with all file operations
  - **Reveal in File Browser**: Navigate to file's location in tree view (classic behavior)
  - All standard operations: rename, delete, preview, etc.
- **Download button**: Direct download without leaving search

### Keyboard Shortcuts

- `Ctrl+F` / `Cmd+F`: Focus the search input
- `Escape`: Clear search and return to tree view
- Standard file browser shortcuts work on selected search results:
  - `Delete`: Delete selected files
  - `F2`: Rename selected file
  - `Ctrl+A`: Select all visible search results

### Search Tips

- **Partial names**: Search for "kick" to find "kick_drum.wav"
- **File extensions**: Search for "wav" to find all audio files
- **Directory names**: Search for "samples" to find files in sample folders
- **Typo tolerance**: "kik" will still find "kick" files
- **Path search**: Search for "samples/kick" to find files in specific directories

## Examples

### Finding Audio Files

```
Search: "wav"
Results: All .wav files across all directories
```

### Finding Specific Samples

```
Search: "kick"
Results: kick.wav, kick_drum.wav, 808_kick.wav, etc.
```

### Finding Files in Directories

```
Search: "samples/snare"
Results: Files containing "snare" in the samples directory
```

### Handling Typos

```
Search: "snar" (typo for "snare")
Results: snare.wav, snare_hit.wav, etc.
```

## Technical Details

### Performance

- **Debounced search**: 150ms delay to avoid excessive searching while typing
- **Smart result limiting**: Maximum 20 high-quality results to avoid overwhelming users
- **Intelligent scoring**: Prioritizes exact matches, prefix matches, and word boundaries
- **Quality filtering**: Filters out poor matches (score > 0.6) automatically
- **Indexed search**: File tree is indexed for fast searching
- **Progressive loading**: Directories are loaded in batches to avoid overwhelming the system
- **Smart caching**: Once loaded, directories remain cached for faster subsequent searches

### Search Algorithm

- Uses Fuse.js for fuzzy string matching with enhanced scoring
- Searches primarily file names (80% weight) with path context (20% weight)
- **Intelligent prioritization**:
  - Exact matches get highest priority
  - Prefix matches (files starting with your query) get high priority
  - Word boundary matches (e.g., "kick" in "808_kick.wav") get medium priority
  - Mid-word matches get lower priority
- Case-insensitive matching
- Requires minimum 2-character matches for precision

### Integration

- **Seamless switching**: Toggle between search and tree view
- **Navigation**: Click results to expand directories and select files
- **State preservation**: Selected files remain selected when exiting search
- **Real-time updates**: Search index updates when files are added/removed

## Troubleshooting

### Search Not Working

- Ensure the file browser is open and connected to your Deluge
- Try refreshing the file tree if recently added files don't appear

### No Results Found

- Check for typos in your search query
- Try searching for partial file names
- Ensure the files exist in the current file tree

### Performance Issues

- Large file collections (>1000 files) may have slight delays
- Search is optimized but very large trees may need time to index

## Workflow Benefits

The improved search interaction eliminates the traditional "search → navigate → interact" workflow:

### Before

1. Search for "kick_drum.wav"
2. Click result to navigate to file location in tree
3. Find the file again in the tree view
4. Right-click to download or perform actions

### After

1. Search for "kick_drum.wav"
2. **Directly interact**: Click download button, right-click for menu, or double-click to preview
3. **Stay in search mode** to continue working with other results
4. **Optional**: Use "Reveal in File Browser" from context menu if you need the classic navigation

This saves clicks and maintains your search context, making it much faster to work with multiple files. The classic "navigate to location" behavior is still available when needed.

## Future Enhancements

Planned improvements include:

- Advanced filters (file type, size, date)
- Search history and saved searches
- Regular expression support
- Search within specific directories only
- Bulk operations on search results
