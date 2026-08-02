import { SD_LEVEL_CONFIG, type SDLevel } from "@/core/domain/systemDesign";
import { Badge } from "./Badge";
import { cn } from "@/lib/cn";

export function LevelBadge({ level, size = "sm" }: { level: SDLevel; size?: "xs" | "sm" }) {
  const c = SD_LEVEL_CONFIG[level] ?? SD_LEVEL_CONFIG.Fundamental;
  return (
    <Badge size={size} className={cn(c.bgColor, c.textColor, c.darkBgColor, c.darkTextColor)}>
      {level}
    </Badge>
  );
}
