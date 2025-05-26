import { fileBrowserLayout, searchMode } from "../state";

const layouts = [
  { id: "tree", name: "Tree", icon: "🌳" },
  { id: "commander", name: "Commander", icon: "⚡" },
  { id: "icons", name: "Icons", icon: "🎯" },
  { id: "list", name: "List", icon: "📋" },
] as const;

export default function LayoutSwitcher() {
  return (
    <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      {layouts.map((layout) => (
        <button
          key={layout.id}
          onClick={() => {
            if (!searchMode.value) {
              fileBrowserLayout.value = layout.id;
            }
          }}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            fileBrowserLayout.value === layout.id
              ? "bg-white dark:bg-gray-700 shadow-sm"
              : "hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
          title={layout.name}
          // Disable layout switching during search mode for consistency
          disabled={searchMode.value}
        >
          <span className="mr-1">{layout.icon}</span>
          {layout.name}
        </button>
      ))}
    </div>
  );
}
