# ![DEx Logo](https://github.com/user-attachments/assets/f10ef2df-f569-49a0-a20c-0716f2e33579)

# DEx: Deluge EXtensions ✨

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Web MIDI API](https://img.shields.io/badge/Web_MIDI_API-Compatible-green)](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) [![Platform](https://img.shields.io/badge/Platform-Web-blue)](https://github.com/mikey/delugeclient) [![Synthstrom Deluge](https://img.shields.io/badge/Synthstrom-Deluge-orange)](https://synthstrom.com/product/deluge/) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com) [![Made with JavaScript](https://img.shields.io/badge/Made_with-JavaScript-F7DF1E?logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

Unlock the full potential of your Synthstrom Deluge with **DEx**! This web-based powerhouse connects directly to your Deluge via USB MIDI, offering a crystal-clear view of its displays and a suite of tools for monitoring, debugging, and advanced control. 🚀

**See your Deluge like never before!** Whether you're performing live, teaching, or just exploring, DEx mirrors the Deluge's displays directly in your browser.

https://github.com/user-attachments/assets/6e1f52ca-bdc9-4cdf-aa05-323fd8b2d7a9

## Key Features 🌟

*   **👀 Dual Display Mirroring**: View *both* the OLED and the classic 7-Segment displays in real-time. Perfect for seeing intricate details or getting a quick overview.
*   **🎨 Customizable OLED View**: Tailor the OLED display to your liking! Adjust pixel scaling (size) and choose custom foreground/background colors. Settings are saved automatically!
*   **↔️ Resizable Display**: Instantly resize the mirrored display canvas with dedicated buttons for the perfect fit on your screen.
*   **⚙️ Advanced Settings Drawer**: Access technical controls like display customization, manual refresh triggers, ping tests, and decoding tests.
*   **🕵️‍♂️ UI Monitor Mode**: Track *every* pixel change on the Deluge display. Great for understanding UI behavior or debugging complex patches.
*   **🐛 Live Debug Output**: See internal debug messages directly from your Deluge, complete with timestamps. Activate 'Auto Debug' to poll for messages automatically.
*   **ℹ️ Device Information**: Quickly query your Deluge for its firmware version and the status of community features.
*   **🔌 Auto-Connect**: Remembers your MIDI device and connects automatically on load (toggleable).
*   **✉️ Custom SysEx Commands**: Send *any* SysEx command directly to your Deluge. Includes clickable examples for common commands!
*   **✅ Ping Test**: Quickly check the connection status to your Deluge.

## Getting Started 🚀

### Prerequisites

*   A modern web browser with **WebMIDI support** (like Chrome, Edge, or Opera).
*   Your Synthstrom Deluge connected to your computer via **USB**.

### Setup

1.  🔌 Connect your Deluge to your computer via USB.
2.  📂 Open the `index.html` file from this project in a compatible web browser.
3.  🔐 When prompted by the browser, **Allow** MIDI access.
4.  🖱️ Select your Deluge from the MIDI **input** and **output** dropdown menus.
    *   ✨ **Pro Tip:** If a device named `Deluge Port 3` is found, DEx will try to select it automatically if 'Connect Automatically' is checked!

## How to Use 🎛️

### Main Controls

*   **Start Display Refresh**: Begins polling the Deluge for display updates (OLED or 7-Segment).
*   **Switch Display Type**: Toggles the view between the OLED and 7-Segment displays.
*   **Get Debug Messages**: Manually requests the latest debug info from the Deluge.
*   **Monitor UI Changes**: Toggles the UI monitoring mode on/off.
*   **⚙️ (Gear Icon)**: Opens the Advanced Settings Drawer.

### Advanced Settings Drawer

*   **OLED Display Settings**: Customize pixel size and colors. Click 'Apply Settings' to see changes and save them.
*   **Display Controls**: Manually trigger OLED/7-Segment updates, run a Ping test, or test internal decoding functions.
*   **Deluge Info**: Get Firmware Version and Features Status.
*   **Custom SysEx**: Input field and 'Send' button for arbitrary commands. Clickable examples provided!
*   **Debug Output**: Shows incoming debug messages, version info, etc. Features 'Clear' and 'Auto Debug' buttons.

## Technical Tidbits 🤓

DEx leverages the **WebMIDI API** to communicate with the Deluge using MIDI System Exclusive (SysEx) messages. It sends commands to request information and receives data back, including display states and debug messages.

*   **Display Rendering**: The OLED display (128×48 pixels) data is received in a compressed 7-to-8 bit RLE format. DEx unpacks this efficiently and renders it onto an HTML `<canvas>` element. Delta updates are used for smoother refreshes.
*   **SysEx Format**: Deluge commands generally follow the format `F0 7D [command] [parameters] F7`.
    *   Ping: `F0 7D 00 F7`
    *   Request OLED: `F0 7D 02 00 01 F7`
    *   Request 7-Segment: `F0 7D 02 01 00 F7`
    *   Request Debug: `F0 7D 03 00 01 F7`
    *   Request Features: `F0 7D 03 01 01 F7`
    *   Request Version: `F0 7D 03 02 01 F7`

## Contributing 🤝

Pull Requests are welcome! If you have ideas for improvements or find bugs, feel free to open an issue or submit a PR.

## License 📜

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**Disclaimer**: This is an unofficial tool and is not affiliated with Synthstrom Audible.

## Acknowledgments 🙏

*   Built for the amazing Synthstrom Deluge community.
*   Inspired by the original [bfredl/delugeclient](https://github.com/bfredl/delugeclient).
*   Uses an RLE unpacking algorithm adapted for Deluge display data.

Happy Deluging! 🎉
