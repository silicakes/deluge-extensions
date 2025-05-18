/// <reference types="cypress" />

enum Selectors {
  MIDI_INPUT_SELECT = "midi-input-select",
  MIDI_OUTPUT_SELECT = "midi-output-select",
  FILE_BROWSER_TOGGLE = "file-browser-toggle-button",
  FILE_BROWSER_PANEL = "file-browser-panel",
  FILE_TREE = "file-tree",
  NEW_FOLDER_BUTTON = "new-folder-button",
  RENAME_BUTTON = "rename-button",
  DELETE_BUTTON = "delete-button",
  CONFIRM_DELETE_BUTTON = "confirm-delete-button",
  UPLOAD_INPUT = "upload-file-input",
  TRANSFER_PROGRESS_BAR = "transfer-progress-bar",
  TRANSFER_QUEUE = "transfer-queue",
}

describe("04 - File Browser Functionality", () => {
  const DELUGE_MIDI_PORT_NAME = "Deluge Port 1";

  beforeEach(() => {
    cy.visit("/");
    cy.clearLocalStorage();
    cy.getBySel(Selectors.MIDI_INPUT_SELECT).select(DELUGE_MIDI_PORT_NAME);
    cy.getBySel(Selectors.MIDI_OUTPUT_SELECT).select(DELUGE_MIDI_PORT_NAME);
    cy.wait(1000);
  });

  it("04-001: Accessing the File Browser", () => {
    cy.getBySel(Selectors.FILE_BROWSER_TOGGLE).click();
    cy.getBySel(Selectors.FILE_BROWSER_PANEL).should("be.visible");
    cy.getBySel(Selectors.FILE_TREE).should("be.visible");
  });

  it("04-002: Directory Navigation (Lazy Loading)", () => {
    cy.getBySel(Selectors.FILE_BROWSER_TOGGLE).click();
    cy.get('[data-testid^="file-tree-folder-"]').first().as("folder");
    cy.get("@folder").find(".toggle-icon").click();
    cy.wait(500);
    cy.get("@folder").parent().find("ul").should("exist");
  });

  it("04-003: File/Folder Selection", () => {
    cy.getBySel(Selectors.FILE_BROWSER_TOGGLE).click();
    cy.get('[data-testid^="file-tree-item-"]')
      .first()
      .click()
      .should("have.attr", "aria-selected", "true");
    cy.get('[data-testid^="file-tree-folder-"]')
      .first()
      .click()
      .should("have.attr", "aria-selected", "true");
  });

  // it("04-004: Keyboard Navigation (Basic)", () => {
  //   cy.getBySel(Selectors.FILE_BROWSER_TOGGLE).click();
  //   cy.get('[data-testid^="file-tree-item-"]').first().click();
  //   cy.focused().type("{downarrow}");
  //   cy.focused().should("have.attr", "aria-selected", "true");
  //   cy.focused().type("{uparrow}");
  //   cy.focused().should("have.attr", "aria-selected", "true");
  //   cy.focused().type("{rightarrow}");
  //   cy.focused().should("have.attr", "data-expanded", "true");
  //   cy.focused().type("{leftarrow}");
  //   cy.focused().should("have.attr", "data-expanded", "false");
  // });

  it("04-005: Create New Folder", () => {
    cy.getBySel(Selectors.FILE_BROWSER_TOGGLE).click();
    cy.wait(500);
    // Ensure TestFolder123 does not already exist
    cy.get("body").then(($body) => {
      if ($body.find("[data-testid=file-tree-folder-TestFolder123]").length) {
        cy.getBySel("file-tree-folder-TestFolder123").click().type("{del}");
        cy.getBySel(Selectors.CONFIRM_DELETE_BUTTON).click();
        cy.wait(1000);
      }
    });
    // Create the new folder
    cy.getBySel(Selectors.NEW_FOLDER_BUTTON).click();
    cy.get('input[placeholder="Enter folder name"]').type("TestFolder123");
    cy.contains("button", "Create").click();
    cy.wait(2000);
    cy.get('[data-testid="file-tree-folder-TestFolder123"]').should("exist");
    // Clean up: delete TestFolder123
    cy.get('[data-testid="file-tree-folder-TestFolder123"]')
      .click()
      .type("{del}");
    cy.getBySel(Selectors.CONFIRM_DELETE_BUTTON).click();
  });

  it("04-006: Rename Item (File/Folder)", () => {
    cy.getBySel(Selectors.FILE_BROWSER_TOGGLE).click();
    cy.wait(500);
    cy.get("body").then(($body) => {
      if ($body.find("[data-testid=file-tree-folder-TestFolder123]").length) {
        cy.getBySel("file-tree-folder-TestFolder123").click().type("{del}");
        cy.getBySel(Selectors.CONFIRM_DELETE_BUTTON).click();
        cy.wait(1000);
      }
    });

    cy.getBySel(Selectors.NEW_FOLDER_BUTTON).click();
    cy.get('input[placeholder="Enter folder name"]').type("TestFolder123");
    cy.contains("button", "Create").click();

    cy.getBySel("file-tree-folder-TestFolder123").trigger("keydown", {
      eventConstructor: "KeyboardEvent",
      code: "F2",
      key: "F2",
    });
    cy.getBySel("file-tree-folder-TestFolder123").trigger("keyup", {
      eventConstructor: "KeyboardEvent",
      code: "F2",
      key: "F2",
    });

    cy.get('input[aria-label="Rename folder"]')
      .clear()
      .type("RenamedFolder456{enter}");
    cy.wait(1000);
    cy.getBySel("file-tree-folder-RenamedFolder456").should("exist");
    cy.reload();
    cy.getBySel(Selectors.FILE_BROWSER_TOGGLE).click();
    cy.wait(500);
    cy.getBySel("file-tree-folder-RenamedFolder456").should("exist");
    cy.getBySel("file-tree-folder-RenamedFolder456").click().type("{del}");
    cy.getBySel(Selectors.CONFIRM_DELETE_BUTTON).click();
    cy.getBySel("file-tree-item-RenamedFolder456").should("not.exist");
  });

  it("04-007: Upload Files (Simulated via input)", () => {
    cy.fixture("example.json", "binary").then((fileContent) => {
      cy.getBySel(Selectors.FILE_BROWSER_TOGGLE).click();
      cy.wait(500);
      cy.getBySel(Selectors.UPLOAD_INPUT).selectFile(
        {
          contents: Cypress.Blob.binaryStringToBlob(
            fileContent,
            "application/json",
          ),
          fileName: "example.json",
          mimeType: "application/json",
        },
        { force: true },
      );
      cy.getBySel(Selectors.FILE_TREE).contains("example.json").should("exist");
      cy.getBySel("'file-tree-item-example.json'").click().type("{del}");
      cy.getBySel(Selectors.CONFIRM_DELETE_BUTTON).click();
      cy.getBySel(Selectors.FILE_TREE)
        .contains("example.json")
        .should("not.exist");
    });
  });

  it("04-008: Download File", () => {
    cy.fixture("example.json", "binary").then((fileContent) => {
      cy.getBySel(Selectors.FILE_BROWSER_TOGGLE).click();
      cy.wait(500);
      cy.getBySel(Selectors.UPLOAD_INPUT).selectFile(
        {
          contents: Cypress.Blob.binaryStringToBlob(
            fileContent,
            "application/json",
          ),
          fileName: "example.json",
          mimeType: "application/json",
        },
        { force: true },
      );
      cy.getBySel("'download-file-button-example.json'").click();
      cy.wait(1000);
      cy.readFile("cypress/downloads/example.json", { timeout: 15000 }).should(
        "exist",
      );
      cy.getBySel(Selectors.FILE_BROWSER_TOGGLE).click();
      cy.wait(500);
      cy.getBySel("'file-tree-item-example.json'").click().type("{del}");
      cy.getBySel(Selectors.CONFIRM_DELETE_BUTTON).click();
      cy.getBySel(Selectors.FILE_TREE)
        .contains("example.json")
        .should("not.exist");
    });
  });

  it("04-010: Transfer Queue and Progress Bar", () => {
    cy.fixture("example.json", "binary").then((fileContent) => {
      cy.getBySel(Selectors.FILE_BROWSER_TOGGLE).click();
      cy.getBySel(Selectors.UPLOAD_INPUT).selectFile(
        [
          {
            contents: Cypress.Blob.binaryStringToBlob(
              fileContent,
              "application/json",
            ),
            fileName: "example.json",
            mimeType: "application/json",
          },
          {
            contents: Cypress.Blob.binaryStringToBlob(
              fileContent,
              "application/json",
            ),
            fileName: "example1.json",
            mimeType: "application/json",
          },
        ],
        { force: true },
      );
      cy.getBySel(Selectors.TRANSFER_QUEUE).should("be.visible");
      cy.getBySel(Selectors.TRANSFER_PROGRESS_BAR).should("be.visible");
      cy.getBySel("'file-tree-item-example.json'")
        .click()
        .type("{shift}")
        .click();
      cy.getBySel("'file-tree-item-example1.json'")
        .click()
        .type("{shift}", { release: false })
        .click();
      cy.getBySel("'file-tree-item-example.json'").click().type("{del}");
      cy.getBySel(Selectors.CONFIRM_DELETE_BUTTON).click();

      cy.getBySel(Selectors.FILE_TREE)
        .contains("example.json")
        .should("not.exist");

      cy.getBySel(Selectors.FILE_TREE)
        .contains("example1.json")
        .should("not.exist");
    });
  });

  it("04-011: Conflict Resolution (Duplicate Folder)", () => {
    cy.getBySel(Selectors.FILE_BROWSER_TOGGLE).click();
    // Create initial folder
    cy.getBySel(Selectors.NEW_FOLDER_BUTTON).click();
    cy.get('input[placeholder="Enter folder name"]').type("ConflictFolder");
    cy.contains("button", "Create").click();
    cy.wait(2000);
    cy.get('[data-testid="file-tree-folder-ConflictFolder"]').should("exist");
    // Attempt duplicate
    cy.getBySel(Selectors.NEW_FOLDER_BUTTON).click();
    cy.get('input[placeholder="Enter folder name"]').type("ConflictFolder");
    cy.contains("button", "Create").click();
    cy.getBySel("conflict-dialog").should("be.visible");
  });
});
