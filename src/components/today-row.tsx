"use client";

import Link from "next/link";
import { Circle, Clock } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { formatDaysOverdue, type TodayItem } from "@/lib/dueness";
import { useTasks } from "@/lib/tasks-context";
import { cn } from "@/lib/utils";

/**
 * PRD §7.1 — tap the row to complete (undo toast), tap the name to open
 * the task detail instead.
 */
export function TodayRow({ item }: { item: TodayItem }) {
  const { completeWithUndo } = useTasks();
  const { task, due, bucket } = item;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => completeWithUndo(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          completeWithUndo(task);
        }
      }}
      className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-xs transition-colors active:bg-secondary"
      aria-label={`Complete ${task.name}`}
    >
      <Circle className="size-5 shrink-0 text-muted-foreground/60" />
      <span className="w-6 shrink-0 text-muted-foreground">
        <CategoryIcon category={task.category} />
      </span>
      <span className="min-w-0 flex-1">
        <Link
          href={`/task/${task.id}`}
          onClick={(e) => e.stopPropagation()}
          className="block truncate py-0.5 text-base font-medium underline-offset-2 active:underline"
        >
          {task.name}
        </Link>
        {task.est_minutes != null && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="size-3.5" />
            {task.est_minutes} min
          </span>
        )}
      </span>
      <span
        className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
          bucket === "overdue" && "bg-overdue text-overdue-foreground",
          bucket === "due" && "bg-secondary text-secondary-foreground",
          bucket === "upcoming" && "text-muted-foreground"
        )}
      >
        {formatDaysOverdue(due.daysOverdue)}
      </span>
    </div>
  );
}
