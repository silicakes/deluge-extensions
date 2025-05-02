import { describe, it, expect } from "vitest";
import { isTypingTarget, modifiersMatch } from "../lib/shortcuts";

describe("Shortcut Modifier Guards", () => {
  // Test isTypingTarget function
  describe("isTypingTarget", () => {
    it("should return true for input elements", () => {
      const input = document.createElement("input");
      expect(isTypingTarget(input)).toBe(true);
    });

    it("should return true for textarea elements", () => {
      const textarea = document.createElement("textarea");
      expect(isTypingTarget(textarea)).toBe(true);
    });

    it("should return true for contenteditable elements", () => {
      const div = document.createElement("div");
      div.setAttribute("contenteditable", "true");
      expect(isTypingTarget(div)).toBe(true);
    });

    it("should return false for regular elements", () => {
      const div = document.createElement("div");
      expect(isTypingTarget(div)).toBe(false);
    });

    it("should return false for contenteditable='false' elements", () => {
      const div = document.createElement("div");
      div.setAttribute("contenteditable", "false");
      expect(isTypingTarget(div)).toBe(false);
    });

    it("should return false for null targets", () => {
      expect(isTypingTarget(null)).toBe(false);
    });
  });

  // Test modifiersMatch function
  describe("modifiersMatch", () => {
    it("should match when no modifiers are defined and no modifiers are pressed", () => {
      const event = new KeyboardEvent("keydown", {
        key: "a",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      });
      expect(modifiersMatch(event)).toBe(true);
    });

    it("should NOT match when no modifiers are defined but modifiers are pressed", () => {
      const event = new KeyboardEvent("keydown", {
        key: "a",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      });
      expect(modifiersMatch(event)).toBe(false);
    });

    it("should match when ctrl is required and pressed", () => {
      const event = new KeyboardEvent("keydown", {
        key: "a",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      });
      expect(modifiersMatch(event, { ctrl: true })).toBe(true);
    });

    it("should NOT match when ctrl is required but not pressed", () => {
      const event = new KeyboardEvent("keydown", {
        key: "a",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
      });
      expect(modifiersMatch(event, { ctrl: true })).toBe(false);
    });

    it("should match complex combinations correctly", () => {
      const event = new KeyboardEvent("keydown", {
        key: "a",
        ctrlKey: true,
        metaKey: false,
        altKey: true,
        shiftKey: false,
      });
      expect(modifiersMatch(event, { ctrl: true, alt: true })).toBe(true);
    });

    it("should NOT match when unexpected modifiers are pressed", () => {
      const event = new KeyboardEvent("keydown", {
        key: "a",
        ctrlKey: true,
        metaKey: false,
        altKey: true,
        shiftKey: true,
      });
      expect(modifiersMatch(event, { ctrl: true, alt: true })).toBe(false);
    });

    it("should match when shift is explicitly allowed", () => {
      const event = new KeyboardEvent("keydown", {
        key: "?", // Shift + /
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: true,
      });
      expect(modifiersMatch(event, { shift: true })).toBe(true);
    });
  });
});
