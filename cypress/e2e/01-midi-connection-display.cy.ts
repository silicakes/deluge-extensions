/// <reference types="cypress" />
/// <reference path="../support/commands.ts" />

describe("MIDI Connection and Basic Display", () => {
  const DELUGE_MIDI_PORT_NAME = "Deluge Port 1"; // As per user update

  beforeEach(() => {
    // Visit the application. MIDI access should be available based on browser/environment config.
    cy.visit("/");
    cy.clearLocalStorage();
  });

  it("1. Initial Load and MIDI Device Selection: handles initial load and MIDI device visibility", () => {
    cy.getBySel("midi-input-select").should("be.visible");
    cy.getBySel("midi-output-select").should("be.visible");
  });

  it("2. Manual MIDI Device Selection: allows manual selection and indicates connection", () => {
    // Attempt to select the Deluge ports.
    // This will fail if the device is not present or named differently.
    cy.getBySel("midi-input-select").select(DELUGE_MIDI_PORT_NAME);
    cy.getBySel("midi-output-select").select(DELUGE_MIDI_PORT_NAME);

    // Check for visual indication of successful connection in DEx's UI
    // The exact data-testid and text will depend on the application's implementation.

    cy.wait(1000);

    cy.getBySel("main-display").toMatchImageSnapshot({
      imageConfig: {
        threshold: 0.001,
      },
    });
    // Test plan: "The 'Auto (Connect + Display)' checkbox should reflect the connection status..."
    cy.getBySel("auto-connect-toggle").should("be.checked"); // or other appropriate assertion
  });

  it("3. Auto-Connect Functionality: auto-connects on refresh if enabled", () => {
    // First, ensure "Auto-connect toggle" is checked.
    // cy.getBySel("auto-connect-toggle").check();

    // Manually connect once to allow the app to "remember" the choice for auto-connect.
    cy.getBySel("midi-input-select").select(DELUGE_MIDI_PORT_NAME);
    cy.getBySel("midi-output-select").select(DELUGE_MIDI_PORT_NAME);
    // Wait for connection to establish and be potentially saved by the app

    cy.reload(); // Refresh the page

    // After reload, DEx should attempt to auto-connect to the "remembered" device.
    // Wait for MIDI selects to be visible again after reload
    cy.getBySel("midi-input-select").should("be.visible");
    cy.getBySel("midi-output-select").should("be.visible");

    cy.wait(1000);
    cy.getBySel("main-display").toMatchImageSnapshot({
      imageConfig: {
        threshold: 0.001,
      },
    });
  });

  it("4. OLED Display Mirroring: mirrors OLED display changes", () => {
    // Connect to MIDI devices
    cy.getBySel("midi-input-select").select(DELUGE_MIDI_PORT_NAME);
    cy.getBySel("midi-output-select").select(DELUGE_MIDI_PORT_NAME);

    // Ensure "Toggle display type" is set to "OLED"
    cy.getBySel("display-type-switch").click(); // Assuming specific element for OLED

    cy.wait(1000);
    cy.getBySel("main-display").toMatchImageSnapshot({
      imageConfig: {
        threshold: 0.001,
      },
    });
  });

  it("5. 7-Segment Display Mirroring: mirrors 7-segment display changes", () => {
    cy.getBySel("midi-input-select").select(DELUGE_MIDI_PORT_NAME);
    cy.getBySel("midi-output-select").select(DELUGE_MIDI_PORT_NAME);

    // Set "Toggle display type" to "7SEG"
    cy.getBySel("display-type-switch").click(); // Assuming specific element for 7SEG
    cy.wait(1000);
    cy.getBySel("main-display").toMatchImageSnapshot({
      imageConfig: {
        threshold: 0.001,
      },
    });
  });
});
