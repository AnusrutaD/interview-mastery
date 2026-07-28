import type { ReactNode } from "react";

export function EmptyState({
  icon = "📭",
  title,
  hint,
  action,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-5 py-12 text-center flex flex-col items-center gap-2">
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      <p className="text-sm text-gray-400 dark:text-gray-500">{title}</p>
      {hint && <p className="text-xs text-gray-300 dark:text-gray-700">{hint}</p>}
      {action}
    </div>
  );
}
