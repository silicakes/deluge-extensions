/// <reference types="cypress" />

enum Selectors {
  MIDI_INPUT_SELECT = "midi-input-select",
  MIDI_OUTPUT_SELECT = "midi-output-select",
  FILE_BROWSER_TOGGLE = "file-browser-toggle-button",
  FILE_BROWSER_PANEL = "file-browser-panel",
  FILE_TREE = "file-tree",
  FILE_TREE_FOLDER_PREFIX = "file-tree-folder-",
  FILE_TREE_ITEM_PREFIX = "file-tree-item-",
  NEW_FOLDER_BUTTON = "new-folder-button",
  RENAME_BUTTON = "rename-button",
  DELETE_BUTTON = "delete-button",
  CONFIRM_DELETE_BUTTON = "confirm-delete-button",
  UPLOAD_INPUT = "upload-file-input",
  TRANSFER_PROGRESS_BAR = "transfer-progress-bar",
  DOWNLOAD_FILE_BUTTON_PREFIX = "download-file-button-",
  TRANSFER_QUEUE = "transfer-queue",
  CONFLICT_DIALOG = "conflict-dialog",
  CONFLICT_DIALOG_OVERRIDE_BUTTON = "conflict-dialog-overwrite-button",
  CONFLICT_DIALOG_RENAME_BUTTON = "conflict-dialog-rename-button",
  CONFLICT_DIALOG_SKIP_BUTTON = "conflict-dialog-skip-button",
  DELETE_CONFIRMATION_DIALOG = "delete-confirmation-dialog",
  DELETE_CONFIRMATION_DIALOG_MESSAGE = "delete-confirmation-dialog-message",
  CANCEL_UPLOAD_BUTTON_PREFIX = "cancel-upload-button-",
  CANCEL_TRANSFER_DIALOG = "cancel-transfer-dialog",
  CLOSE_CANCEL_TRANSFER_DIALOG_BUTTON = "close-cancel-transfer-dialog-button",
  CONFIRM_CANCEL_TRANSFER_BUTTON = "confirm-cancel-transfer-button",
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
    cy.readFile("./cypress/fixtures/medium_file.wav", "binary")
      .then(Cypress.Buffer.from)
      .then((fileContent) => {
        cy.getBySel(Selectors.FILE_BROWSER_TOGGLE).click();
        cy.wait(500);
        cy.getBySel(Selectors.UPLOAD_INPUT).selectFile(
          [
            {
              contents: fileContent,
              fileName: "example.wav",
              mimeType: "audio/wav",
              lastModified: new Date().getTime(),
            },
            {
              contents: fileContent,
              fileName: "example1.wav",
              mimeType: "audio/wav",
              lastModified: new Date().getTime(),
            },
          ],
          { force: true },
        );
        cy.getBySel(Selectors.TRANSFER_QUEUE).should("be.visible");
        cy.getBySel(Selectors.TRANSFER_PROGRESS_BAR).should("be.visible");
        cy.wait(3000);
        cy.getBySel("'file-tree-item-example.wav'")
          .click()
          .type("{shift}")
          .click();
        cy.getBySel("'file-tree-item-example1.wav'")
          .click()
          .type("{shift}", { release: false })
          .click();
        cy.getBySel("'file-tree-item-example.wav'").click().type("{del}");
        cy.getBySel(Selectors.CONFIRM_DELETE_BUTTON).click();

        cy.getBySel(Selectors.FILE_TREE)
          .contains("example.wav")
          .should("not.exist");

        cy.getBySel(Selectors.FILE_TREE)
          .contains("example1.wav")
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

  it("04-012: Deletion of multi-selected files", () => {
    const file1Name = "multiDeleteTest1.txt";
    const file2Name = "multiDeleteTest2.txt";
    // file1Content and file2Content will come from the fixture

    cy.fixture("example.json", "binary").then((fileContent) => {
      cy.getBySel(Selectors.FILE_BROWSER_TOGGLE).click();
      cy.wait(500);

      // Upload file 1 and file 2 in a single operation using fixture content
      cy.getBySel(Selectors.UPLOAD_INPUT).selectFile(
        [
          {
            contents: Cypress.Blob.binaryStringToBlob(
              fileContent,
              "text/plain",
            ),
            fileName: file1Name,
            mimeType: "text/plain", // Even if fixture is json, treat as plain for this test
          },
          {
            contents: Cypress.Blob.binaryStringToBlob(
              fileContent,
              "text/plain",
            ),
            fileName: file2Name,
            mimeType: "text/plain", // Even if fixture is json, treat as plain for this test
          },
        ],
        { force: true },
      );

      cy.wait(500);
      // Verify both files exist
      cy.getBySel(`'${Selectors.FILE_TREE_ITEM_PREFIX}${file1Name}'`).should(
        "exist",
      );
      cy.getBySel(`'${Selectors.FILE_TREE_ITEM_PREFIX}${file2Name}'`).should(
        "exist",
      );

      // Select both files (using shift+click on the second element after clicking the first)
      cy.getBySel(`'${Selectors.FILE_TREE_ITEM_PREFIX}${file1Name}'`).click();
      cy.getBySel(`'${Selectors.FILE_TREE_ITEM_PREFIX}${file2Name}'`).click({
        shiftKey: true,
      });

      // Trigger delete action
      cy.focused().type("{del}");

      // Verify dialog and filenames
      cy.getBySel(Selectors.DELETE_CONFIRMATION_DIALOG).should("be.visible");
      cy.getBySel(Selectors.DELETE_CONFIRMATION_DIALOG_MESSAGE)
        .should("contain.text", file1Name)
        .and("contain.text", file2Name);

      // Confirm delete
      cy.getBySel(Selectors.CONFIRM_DELETE_BUTTON).click();
      cy.wait(1000); // Allow time for deletion

      // Verify files are deleted
      cy.getBySel(`'${Selectors.FILE_TREE_ITEM_PREFIX}${file1Name}'`).should(
        "not.exist",
      );
      cy.getBySel(`'${Selectors.FILE_TREE_ITEM_PREFIX}${file2Name}'`).should(
        "not.exist",
      );
    });
  });

  it("04-013: File upload conflict - Override", () => {
    const fileName = "overrideTest.txt";
    // initialContent and newContent will come from the fixture

    cy.fixture("example.json", "binary").then((fileContent) => {
      cy.getBySel(Selectors.FILE_BROWSER_TOGGLE).click();
      cy.wait(500);

      // Upload initial file
      cy.getBySel(Selectors.UPLOAD_INPUT).selectFile(
        {
          contents: Cypress.Blob.binaryStringToBlob(fileContent, "text/plain"),
          fileName: fileName,
          mimeType: "text/plain",
        },
        { force: true },
      );
      cy.getBySel(`'${Selectors.FILE_TREE_ITEM_PREFIX}${fileName}'`).should(
        "exist",
      );
      cy.wait(1000); // Allow indexing

      // Attempt to upload the same file (content will also be the same from fixture)
      cy.getBySel(Selectors.UPLOAD_INPUT).selectFile(
        {
          contents: Cypress.Blob.binaryStringToBlob(fileContent, "text/plain"),
          fileName: fileName,
          mimeType: "text/plain",
        },
        { force: true },
      );

      // Verify conflict dialog and click override
      cy.getBySel(Selectors.CONFLICT_DIALOG).should("be.visible");
      cy.getBySel(Selectors.CONFLICT_DIALOG_OVERRIDE_BUTTON).click();
      cy.wait(2000); // Allow for override operation

      cy.getBySel(`'${Selectors.FILE_TREE_ITEM_PREFIX}${fileName}'`).should(
        "exist",
      );

      // Cleanup: delete the test file
      cy.getBySel(`'${Selectors.FILE_TREE_ITEM_PREFIX}${fileName}'`)
        .click()
        .type("{del}");
      cy.getBySel(Selectors.CONFIRM_DELETE_BUTTON).click();
      cy.getBySel(`'${Selectors.FILE_TREE_ITEM_PREFIX}${fileName}'`).should(
        "not.exist",
      );
    });
  });

  it("04-014: Multiple file uploads are queued and completed", () => {
    const file1Name = "multiUpload1.txt";
    const file2Name = "multiUpload2.kic";
    // file1Content and file2Content will come from the fixture

    cy.readFile("./cypress/fixtures/medium_file.wav")
      .then(Cypress.Buffer.from)
      .then((fileContent) => {
        cy.getBySel(Selectors.FILE_BROWSER_TOGGLE).click();
        cy.wait(500);

        // Select multiple files for upload
        cy.getBySel(Selectors.UPLOAD_INPUT).selectFile(
          [
            {
              contents: fileContent,
              fileName: file1Name,
              mimeType: "audio/wav",
            },
            {
              contents: fileContent,
              fileName: file2Name,
              mimeType: "audio/wav", // Example for .kic
            },
          ],
          { force: true },
        );

        cy.wait(1000);
        cy.getBySel(Selectors.TRANSFER_QUEUE).should("be.visible");
        cy.getBySel(Selectors.TRANSFER_PROGRESS_BAR).should("be.visible");

        cy.getBySel(`'${Selectors.FILE_TREE_ITEM_PREFIX}${file1Name}'`).should(
          "exist",
        );
        cy.getBySel(`'${Selectors.FILE_TREE_ITEM_PREFIX}${file2Name}'`).should(
          "exist",
        );

        // Cleanup
        cy.getBySel(`'${Selectors.FILE_TREE_ITEM_PREFIX}${file1Name}'`).click();
        cy.getBySel(`'${Selectors.FILE_TREE_ITEM_PREFIX}${file2Name}'`).click({
          shiftKey: true,
        });
        cy.focused().type("{del}");
        cy.getBySel(Selectors.CONFIRM_DELETE_BUTTON).click();
        cy.wait(1000);
        cy.getBySel(`'${Selectors.FILE_TREE_ITEM_PREFIX}${file1Name}'`).should(
          "not.exist",
        );
        cy.getBySel(`'${Selectors.FILE_TREE_ITEM_PREFIX}${file2Name}'`).should(
          "not.exist",
        );
      });
  });

  it("04-015: Cancel file upload", () => {
    const fileName = "cancelTest.wav";
    // largeContent will come from the fixture

    cy.readFile("./cypress/fixtures/large_file.wav", "binary")
      .then(Cypress.Buffer.from)
      .then((fileContent) => {
        cy.getBySel(Selectors.FILE_BROWSER_TOGGLE).click();
        cy.wait(500);
        cy.getBySel(Selectors.UPLOAD_INPUT, { force: true }).selectFile(
          {
            fileName,
            contents: fileContent,
            mimeType: "audio/wav",
            lastModified: new Date().getTime(),
          },
          {
            force: true,
          },
        );

        cy.getBySel(Selectors.TRANSFER_QUEUE).should("be.visible");
        cy.getBySel(Selectors.TRANSFER_PROGRESS_BAR).should("be.visible");

        cy.getBySel(`'${Selectors.CANCEL_UPLOAD_BUTTON_PREFIX}/${fileName}'`)
          .should("be.visible")
          .click();

        cy.getBySel(Selectors.CANCEL_TRANSFER_DIALOG).should("be.visible");
        cy.getBySel(Selectors.CONFIRM_CANCEL_TRANSFER_BUTTON).click();

        cy.getBySel(Selectors.TRANSFER_QUEUE).should("not.exist");
        cy.getBySel(`'${Selectors.FILE_TREE_ITEM_PREFIX}${fileName}'`).should(
          "not.exist",
        );
      });
  });
});
