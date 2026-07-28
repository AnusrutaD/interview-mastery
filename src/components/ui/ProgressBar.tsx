import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  max,
  className,
  barClassName = "bg-blue-500",
  height = "h-1.5",
}: {
  value: number;
  max: number;
  className?: string;
  barClassName?: string;
  height?: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn("w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden", height, className)}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-500", barClassName)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
