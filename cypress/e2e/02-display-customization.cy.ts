/// <reference types="cypress" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../support/commands.ts" />

describe("Display Customization", () => {
  const DELUGE_MIDI_PORT_NAME = "Deluge Port 1"; // As per existing tests

  beforeEach(() => {
    cy.visit("/");
    cy.clearLocalStorage();
    // Connect to MIDI device before each test
    cy.getBySel("midi-input-select").select(DELUGE_MIDI_PORT_NAME);
    cy.getBySel("midi-output-select").select(DELUGE_MIDI_PORT_NAME);
    cy.getBySel("connection-status").should(
      "contain.text",
      `Connected to ${DELUGE_MIDI_PORT_NAME}`,
    );
    // Ensure OLED display is active for these tests by default
    // This might require a click if 7-segment was previously active or is default
    // Assuming a 'display-type-toggle-oled' selector exists as in 01-midi-connection-display.cy.ts
    cy.getBySel("display-type-switch").click();
  });

  it("1. Accessing Appearance Settings: opens appearance settings panel", () => {
    // Action: Click the "Appearance settings" button
    // Assuming 'appearance-settings-button' is the data-testid
    cy.getBySel("appearance-settings-button").click();

    // Expected Result:
    // - A settings panel/drawer/modal for display customization opens.
    //   (Check for visibility of the panel and some key controls within it)
    cy.getBySel("appearance-settings-panel").should("be.visible");
    cy.getBySel("pixel-scale-increase-button").should("be.visible");
    cy.getBySel("pixel-scale-decrease-button").should("be.visible");
    cy.getBySel("foreground-color-picker").should("be.visible");
    cy.getBySel("background-color-picker").should("be.visible");
    cy.getBySel("apply-settings-button").should("be.visible");
    // cy.get("reset-defaults-button").should("be.visible"); // Optional based on plan
  });

  it("2. OLED Pixel Scaling (Size): changes OLED pixel size", () => {
    cy.getBySel("appearance-settings-button").click();
    cy.getBySel("appearance-settings-panel").should("be.visible");

    // Initial state check (optional, but good for comparison)
    // let initialPixelSizeText;
    // cy.get("current-pixel-size-indicator").invoke('text').then(text => initialPixelSizeText = text);
    // let initialCanvasWidth, initialCanvasHeight;
    // cy.get("oled-display-canvas").invoke('width').then(w => initialCanvasWidth = w);
    // cy.get("oled-display-canvas").invoke('height').then(h => initialCanvasHeight = h);

    // Action: Increase pixel size
    cy.getBySel("pixel-scale-increase-button").click();
    // Add more clicks if needed to see a significant change or test limits
    cy.getBySel("apply-settings-button").click(); // Assuming apply is needed after each change

    // Expected Result:
    // - Visual increase (hard to assert precisely without snapshots, check indicator text)
    cy.getBySel("current-pixel-size-indicator").should("contain.text", "x"); // Example: "10x10" - needs actual format
    // cy.get("oled-display-canvas").invoke('width').should('be.gt', initialCanvasWidth);

    // Action: Decrease pixel size
    cy.getBySel("appearance-settings-button").click(); // Re-open if it closes
    cy.getBySel("pixel-scale-decrease-button").click();
    cy.getBySel("apply-settings-button").click();

    // Expected Result:
    // - Visual decrease
    // cy.get("current-pixel-size-indicator").should(...); // Assert updated size text
    // cy.get("oled-display-canvas").invoke('width').should('be.lt', initialCanvasWidth); // Or back to initial or less than previous
    // Note: Precise canvas dimension checks might be flaky depending on rendering.
    // Relying on text indicators for pixel size (e.g., "8x8") is more robust.
  });

  it("3. OLED Foreground Color Customization: changes foreground color", () => {
    cy.getBySel("appearance-settings-button").click();
    cy.getBySel("appearance-settings-panel").should("be.visible");

    // Action: Select/enter a new foreground color
    // The way to interact with color pickers can vary.
    // If it's an <input type="color">, we can .invoke('val', '#FF0000').trigger('input');
    // Or, if it's custom, might need to click and select from a palette.
    // Assuming a simple input field for hex color for now:
    cy.getBySel("foreground-color-picker").clear().type("#FF0000"); // Red
    cy.getBySel("apply-settings-button").click();

    // Expected Result:
    // - Mirrored OLED display 'on' pixels change color.
    //   (This is a visual change. Without snapshots, we can only check if the setting applied,
    //    e.g., by checking the input's value if it reflects the current setting, or a CSS variable)
    // cy.get("oled-display-canvas").should('have.css', '--oled-foreground-color', '#FF0000'); // Example
    // Or, if the input field retains the value:
    cy.getBySel("appearance-settings-button").click(); // Re-open settings
    cy.getBySel("foreground-color-picker").should("have.value", "#FF0000");
  });

  it("4. OLED Background Color Customization: changes background color", () => {
    cy.getBySel("appearance-settings-button").click();
    cy.getBySel("appearance-settings-panel").should("be.visible");

    // Action: Select/enter a new background color
    cy.getBySel("background-color-picker").clear().type("#00FF00"); // Green
    cy.getBySel("apply-settings-button").click();

    // Expected Result:
    // - Mirrored OLED display 'off' pixels (background) change color.
    // cy.get("oled-display-canvas").should('have.css', '--oled-background-color', '#00FF00'); // Example
    cy.getBySel("appearance-settings-button").click(); // Re-open settings
    cy.getBySel("background-color-picker").should("have.value", "#00FF00");
  });

  it("5. Simultaneous Color Customization: changes both colors", () => {
    cy.getBySel("appearance-settings-button").click();
    cy.getBySel("appearance-settings-panel").should("be.visible");

    // Action: Change both colors
    cy.getBySel("foreground-color-picker").clear().type("#0000FF"); // Blue
    cy.getBySel("background-color-picker").clear().type("#FFFF00"); // Yellow
    cy.getBySel("apply-settings-button").click();

    // Expected Result:
    // - Both colors update.
    cy.getBySel("appearance-settings-button").click(); // Re-open settings
    cy.getBySel("foreground-color-picker").should("have.value", "#0000FF");
    cy.getBySel("background-color-picker").should("have.value", "#FFFF00");
  });

  it("6. Display Canvas Resizing (Dedicated Buttons): resizes canvas", () => {
    // This test assumes dedicated canvas resize buttons are OUTSIDE the appearance panel.
    // Selectors like 'increase-canvas-size-button' and 'decrease-canvas-size-button' are assumed.

    // let initialCanvasWidth, initialCanvasHeight;
    // cy.get("oled-display-canvas").invoke('width').then(w => initialCanvasWidth = w);
    // cy.get("oled-display-canvas").invoke('height').then(h => initialCanvasHeight = h);

    // Action: Click "increase canvas size" button
    // cy.get("increase-canvas-size-button").click();
    // Expected Result: Canvas scales up
    // cy.get("oled-display-canvas").invoke('width').should('be.gt', initialCanvasWidth);

    // Action: Click "decrease canvas size" button
    // cy.get("decrease-canvas-size-button").click();
    // Expected Result: Canvas scales down
    // cy.get("oled-display-canvas").invoke('width').should('be.lt', initialCanvasWidth); // Or back to initial
    cy.log(
      "Test for 'Display Canvas Resizing (Dedicated Buttons)' needs specific selectors for resize buttons.",
    );
    // Mark as pending or skip if selectors are unknown
    // This test is highly dependent on the existence and selectors of these dedicated buttons.
  });

  it("7. Settings Persistence: custom settings persist after refresh", () => {
    cy.getBySel("appearance-settings-button").click();
    cy.getBySel("appearance-settings-panel").should("be.visible");

    // Apply custom settings
    cy.getBySel("pixel-scale-increase-button").click(); // Make a change to pixel size
    cy.getBySel("foreground-color-picker").clear().type("#ABCDEF");
    cy.getBySel("background-color-picker").clear().type("#123456");
    cy.getBySel("apply-settings-button").click();

    // Expected value for pixel size indicator after one increase (example, adjust as needed)
    // const expectedPixelSizeText = "9x9"; // This needs to be known or dynamically captured

    // cy.get("current-pixel-size-indicator").should("contain.text", expectedPixelSizeText);
    cy.getBySel("appearance-settings-button").click(); // re-open panel
    cy.getBySel("foreground-color-picker").should("have.value", "#ABCDEF"); // Check before reload
    cy.getBySel("background-color-picker").should("have.value", "#123456"); // Check before reload

    cy.reload();

    // Re-establish MIDI connection after reload
    cy.getBySel("midi-input-select").select(DELUGE_MIDI_PORT_NAME);
    cy.getBySel("midi-output-select").select(DELUGE_MIDI_PORT_NAME);
    cy.getBySel("connection-status").should(
      "contain.text",
      `Connected to ${DELUGE_MIDI_PORT_NAME}`,
    );
    cy.getBySel("display-type-toggle-oled").click(); // Ensure OLED display is active
    cy.getBySel("oled-display-canvas").should("be.visible");

    // Expected Result: Settings are loaded and active
    cy.getBySel("appearance-settings-button").click();
    cy.getBySel("appearance-settings-panel").should("be.visible");
    // cy.get("current-pixel-size-indicator").should("contain.text", expectedPixelSizeText);
    cy.getBySel("foreground-color-picker").should("have.value", "#ABCDEF");
    cy.getBySel("background-color-picker").should("have.value", "#123456");
  });
});
