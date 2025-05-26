import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { fileBrowserLayout, searchMode } from "../state";
import LayoutSwitcher from "../components/LayoutSwitcher";

describe("LayoutSwitcher", () => {
  beforeEach(() => {
    // Reset state before each test
    fileBrowserLayout.value = "tree";
    searchMode.value = false;
  });

  it("should render all layout options", () => {
    render(<LayoutSwitcher />);

    expect(screen.getByText("Tree")).toBeInTheDocument();
    expect(screen.getByText("Commander")).toBeInTheDocument();
    expect(screen.getByText("Icons")).toBeInTheDocument();
    expect(screen.getByText("List")).toBeInTheDocument();
  });

  it("should highlight the current layout", () => {
    fileBrowserLayout.value = "icons";
    render(<LayoutSwitcher />);

    const iconsButton = screen.getByText("Icons");
    expect(iconsButton).toHaveClass("bg-white");
  });

  it("should switch layouts when clicked", () => {
    render(<LayoutSwitcher />);

    const commanderButton = screen.getByText("Commander");
    fireEvent.click(commanderButton);

    expect(fileBrowserLayout.value).toBe("commander");
  });

  it("should disable buttons during search mode", () => {
    searchMode.value = true;
    render(<LayoutSwitcher />);

    const treeButton = screen.getByText("Tree");
    const commanderButton = screen.getByText("Commander");
    const iconsButton = screen.getByText("Icons");
    const listButton = screen.getByText("List");

    expect(treeButton).toBeDisabled();
    expect(commanderButton).toBeDisabled();
    expect(iconsButton).toBeDisabled();
    expect(listButton).toBeDisabled();
  });

  it("should not change layout when clicked during search mode", () => {
    searchMode.value = true;
    fileBrowserLayout.value = "tree";
    render(<LayoutSwitcher />);

    const iconsButton = screen.getByText("Icons");
    fireEvent.click(iconsButton);

    // Layout should remain unchanged
    expect(fileBrowserLayout.value).toBe("tree");
  });
});
