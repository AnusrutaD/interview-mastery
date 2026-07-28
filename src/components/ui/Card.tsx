import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** The app's single surface treatment. Previously duplicated in ~20 places. */
export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl",
        padded && "p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
      {action}
    </div>
  );
}
