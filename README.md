# ![DEx Logo](https://github.com/user-attachments/assets/f10ef2df-f569-49a0-a20c-0716f2e33579)

# DEx: Deluge EXtensions ✨

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Web MIDI API](https://img.shields.io/badge/Web_MIDI_API-Compatible-green)](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) [![Platform](https://img.shields.io/badge/Platform-Web/Mobile-blue)](https://github.com/mikey/delugeclient) [![Synthstrom Deluge](https://img.shields.io/badge/Synthstrom-Deluge-orange)](https://synthstrom.com/product/deluge/) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com) [![Made with JavaScript](https://img.shields.io/badge/Made_with-JavaScript-F7DF1E?logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript) [![Live Demo](https://img.shields.io/badge/Live_Demo-Available-ff69b4)](https://dex.silicak.es)

Unlock the full potential of your Synthstrom Deluge with **DEx**! This web-based powerhouse connects directly to your Deluge via USB MIDI, offering a crystal-clear view of its displays and a suite of tools for monitoring, debugging, and advanced control. 🚀

**See your Deluge like never before!** Whether you're performing live, teaching, or just exploring, DEx mirrors the Deluge's displays directly in your browser - on desktop or mobile devices!

## ✨ [Try the Live Demo at dex.silicak.es!](https://dex.silicak.es) ✨

No installation needed - just visit [dex.silicak.es](https://dex.silicak.es) in a WebMIDI-compatible browser and connect your Deluge!

### Web Demo
https://github.com/user-attachments/assets/590b5b20-30ba-4cc3-8fdb-a0af7f2b97a2

### Mobile (Android) Demo

https://github.com/user-attachments/assets/be507463-47b3-4adc-a98c-2b184429e9fa


## Key Features 🌟

*   **👀 Dual Display Mirroring**: View *both* the OLED and the classic 7-Segment displays in real-time. Perfect for seeing intricate details or getting a quick overview.
*   **📱 Fullscreen Mode**: Enter a distraction-free fullscreen view that works beautifully on both desktop and mobile devices! Perfect for performances or when projecting your Deluge's display to an audience.
*   **🎨 Customizable OLED View**: Tailor the OLED display to your liking! Adjust pixel scaling (size) and choose custom foreground/background colors. Settings are saved automatically!
*   **↔️ Resizable Display**: Instantly resize the mirrored display canvas with dedicated buttons for the perfect fit on your screen.
*   **⚙️ Advanced Settings Drawer**: Access technical controls like display customization, manual refresh triggers, ping tests, and decoding tests.
*   **🕵️‍♂️ UI Monitor Mode**: Track *every* pixel change on the Deluge display. Great for understanding UI behavior or debugging complex patches.
*   **🐛 Live Debug Output**: See internal debug messages directly from your Deluge, complete with timestamps. Activate 'Auto Debug' to poll for messages automatically.
*   **ℹ️ Device Information**: Quickly query your Deluge for its firmware version and the status of community features.
*   **🔌 Auto-Connect**: Remembers your MIDI device and connects automatically on load (toggleable).
*   **✉️ Custom SysEx Commands**: Send *any* SysEx command directly to your Deluge. Includes clickable examples for common commands!
*   **✅ Ping Test**: Quickly check the connection status to your Deluge.
*   **📸 Screenshot**: Capture the current display as a PNG image; click the camera button or press 's' to save.
*   **📋 Copy Base64**: Instantly copy the current OLED display as a gzipped, base64-encoded string (in a markdown directive) for easy sharing or embedding. Use the copy icon or press 'c'.

## Getting Started 🚀

### Prerequisites

*   A modern web browser with **WebMIDI support** (like Chrome, Edge, or Opera).
*   Your Synthstrom Deluge connected to your computer or mobile device via **USB**.
*   For mobile use: An Android device with USB OTG support or iOS device (with appropriate adapters).

### Setup

1.  🔌 Connect your Deluge to your computer or mobile device via USB.
2.  📂 Open [dex.silicak.es](https://dex.silicak.es) in a compatible web browser.
3.  🔐 When prompted by the browser, **Allow** MIDI access.
4.  🖱️ Select your Deluge from the MIDI **input** and **output** dropdown menus.
    *   ✨ **Pro Tip:** If a device named `Deluge Port 3` is found, DEx will try to select it automatically if 'Connect Automatically' is checked!

## How to Use 🎛️

### Main Controls

*   **Start Display Refresh**: Begins polling the Deluge for display updates (OLED or 7-Segment).
*   **Switch Display Type**: Toggles the view between the OLED and 7-Segment displays.
*   **Get Debug Messages**: Manually requests the latest debug info from the Deluge.
*   **Monitor UI Changes**: Toggles the UI monitoring mode on/off.
*   **Full Screen**: Enters a distraction-free fullscreen mode that optimizes the display for your current device and screen size. Press 'ESC' or tap the button again to exit.
*   **📸 Screenshot**: Download a snapshot of the current canvas as a PNG by clicking the camera icon or pressing 's'.
*   **📋 Copy Base64**: Copy the current OLED display as a gzipped, base64-encoded string (in a markdown directive) by clicking the copy icon or pressing 'c'.
*   **⚙️ (Gear Icon)**: Opens the Advanced Settings Drawer.

### Advanced Settings Drawer

*   **OLED Display Settings**: Customize pixel size and colors. Click 'Apply Settings' to see changes and save them.
*   **Display Controls**: Manually trigger OLED/7-Segment updates, run a Ping test, or test internal decoding functions.
*   **Deluge Info**: Get Firmware Version and Features Status.
*   **Custom SysEx**: Input field and 'Send' button for arbitrary commands. Clickable examples provided!
*   **Copy Base64**: Use the copy icon or press 'c' to copy the current OLED display as a gzipped, base64-encoded string in a markdown directive (e.g., `::screen[...]{alt="Canvas Image"}`).
*   **Debug Output**: Shows incoming debug messages, version info, etc. Features 'Clear' and 'Auto Debug' buttons.

### Mobile Usage Tips

**  iOS currently doesn't support webMIDI in its common browsers (Safri, Chrome etc..).
Although there are some browsers that were patched support it, I can't recomment any since I don't use iPhone. **

*   For the best experience on mobile devices, use the **Full Screen** button to maximize the display.
*   On Android, you may need a USB OTG (On-The-Go) adapter to connect your Deluge.
    Although for me, it works with a regular USB-C to USB-B cable.
*  
*   Rotate your device to landscape orientation for an optimal viewing experience.
*   Press 'f' on external keyboards or tap the Full Screen button again to exit fullscreen mode.

## Technical Tidbits 🤓

DEx leverages the **WebMIDI API** to communicate with the Deluge using MIDI System Exclusive (SysEx) messages. It sends commands to request information and receives data back, including display states and debug messages.

*   **Display Rendering**: The OLED display (128×48 pixels) data is received in a compressed 7-to-8 bit RLE format. DEx unpacks this efficiently and renders it onto an HTML `<canvas>` element. Delta updates are used for smoother refreshes.
*   **Copy Base64**: The OLED buffer can be copied as a gzipped, base64-encoded string (not a PNG) for sharing or embedding. The output is a markdown directive like `::screen[BASE64]{alt="Canvas Image"}`.
*   **Responsive Design**: The fullscreen mode uses adaptive scaling to provide optimal visibility on displays of all sizes, from mobile phones to large projector screens.
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
