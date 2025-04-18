# DEx: Deluge Extensions

A web-based client application for interfacing with the Synthstrom Deluge synthesizer/sequencer through MIDI. This application allows you to view the OLED display and 7-segment displays from the Deluge, debug and monitor the device, and send custom SysEx commands.

## Features

- **Display Mirroring**: Shows both OLED and 7-segment displays from the Deluge
- **Real-time Updates**: Refreshes the display to mirror what's happening on the device
- **Monitor Mode**: Track UI changes on the Deluge display
- **Debug Output**: View internal debug messages from the Deluge
- **Feature & Version Info**: Query the device for firmware version and community features
- **Custom SysEx**: Send arbitrary SysEx commands to the Deluge

## Getting Started

### Prerequisites

- A web browser with WebMIDI support (Chrome, Edge, Opera)
- Synthstrom Deluge connected via USB

### Setup

1. Connect your Deluge to your computer via USB
2. Open `app.html` in a compatible browser
3. When prompted, allow MIDI access
4. Select your Deluge from the MIDI input and output dropdown menus
   - The app will auto-select devices named "Deluge MIDI 3" if available

## Usage

### Display Controls

- **Start Display Refresh**: Begin polling the Deluge for display updates
- **Switch Display Type**: Toggle between OLED and 7-segment displays
- **Get OLED/Get 7-Segment**: Manually request a display update
- **Ping Test**: Test communication with the Deluge

### UI Monitoring

- **Monitor UI Changes**: Track pixel changes on the display and log them
- **Auto Debug**: Automatically request debug messages at regular intervals

### Information & Debugging

- **Get Firmware Version**: Displays the current firmware running on your Deluge
- **Get Features Status**: Shows which community features are enabled
- **Get Debug Messages**: Manually request debug information
- **Clear**: Clear the debug output window

### Custom Commands

Use the custom SysEx input to send arbitrary commands to the Deluge. Common examples are provided for quick access.

## Technical Details

The application communicates with the Deluge using MIDI System Exclusive (SysEx) messages. It uses the WebMIDI API to send commands and receive responses.

### Display Rendering

- OLED display is 128×48 pixels, organized in 6 blocks of 128 bytes
- Display data is received in a compressed format (7-to-8 bit RLE encoding)
- The client unpacks this data and renders it on an HTML canvas

### SysEx Command Format

All commands follow the format: `F0 7D [command] [parameters] F7`

Common commands:
- `F0 7D 00 F7`: Ping test
- `F0 7D 02 00 01 F7`: Request OLED display
- `F0 7D 02 01 00 F7`: Request 7-segment display
- `F0 7D 03 00 01 F7`: Request debug messages
- `F0 7D 03 01 01 F7`: Request features status
- `F0 7D 03 02 01 F7`: Request firmware version

## Customization

The display scaling can be adjusted by modifying the `px_height` and `px_width` variables in the `drawOleddata` function in `app.js`.

## License

This is an unofficial tool and is not affiliated with Synthstrom Audible.

## Acknowledgments

- Developed for the Synthstrom Deluge community
- Uses RLE unpacking algorithm to decode display data
- Inspired by [bfredl/delugeclient](https://github.com/bfredl/delugeclient) GitHub repository 
