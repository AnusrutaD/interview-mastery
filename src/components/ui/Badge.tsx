import type { ReactNode } from "react";
import { DIFFICULTY_CONFIG, type Difficulty } from "@/core/domain/difficulty";
import { MASTERY_CONFIG, type MasteryLevel } from "@/core/domain/mastery";
import { cn } from "@/lib/cn";

const SIZES = {
  xs: "text-[10px] px-1.5 py-0.5",
  sm: "text-xs px-2 py-0.5",
} as const;

export function Badge({
  children,
  className,
  size = "sm",
}: {
  children: ReactNode;
  className?: string;
  size?: keyof typeof SIZES;
}) {
  return (
    <span className={cn("font-semibold rounded-full whitespace-nowrap", SIZES[size], className)}>
      {children}
    </span>
  );
}

export function DifficultyBadge({
  difficulty,
  size = "sm",
}: {
  difficulty: Difficulty;
  size?: keyof typeof SIZES;
}) {
  const c = DIFFICULTY_CONFIG[difficulty];
  return (
    <Badge size={size} className={cn(c.bgColor, c.textColor, c.darkBgColor, c.darkTextColor)}>
      {difficulty}
    </Badge>
  );
}

export function MasteryBadge({
  mastery,
  size = "sm",
}: {
  mastery: MasteryLevel;
  size?: keyof typeof SIZES;
}) {
  const c = MASTERY_CONFIG[mastery];
  return (
    <Badge size={size} className={cn(c.bgColor, c.textColor, c.darkBgColor, c.darkTextColor)}>
      {c.label}
    </Badge>
  );
}
