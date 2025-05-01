import { ComponentChildren } from "preact";

/**
 * Card – simple rounded container with optional title/header.
 * Usage:
 * <Card title="My Section"> ... </Card>
 */
export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ComponentChildren;
  className?: string;
}) {
  return (
    <div
      className={`card bg-[var(--color-bg-offset)] shadow-sm rounded-lg border border-[var(--color-border)] ${className}`}
    >
      {title && (
        <div className="px-4 py-2 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
