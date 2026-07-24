"use client";

import Link from "next/link";
import { Circle, Clock, Package } from "lucide-react";
import { useTasks } from "@/lib/tasks-context";
import type { Task } from "@/lib/types";

/** PRD §7.2 — name, location, est. minutes, materials indicator. */
export function ProjectRow({ task }: { task: Task }) {
  const { completeWithUndo } = useTasks();

  return (
    <div className="flex min-h-16 items-center gap-2 rounded-xl bg-card py-2 pl-1 pr-4 shadow-xs">
      <button
        type="button"
        onClick={() => completeWithUndo(task)}
        aria-label={`Complete ${task.name}`}
        className="flex size-12 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors active:text-primary"
      >
        <Circle className="size-5" />
      </button>
      <Link href={`/task/${task.id}`} className="min-w-0 flex-1 py-1">
        <span className="block truncate text-base font-medium">
          {task.name}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
          {task.location && (
            <span className="max-w-40 truncate">{task.location}</span>
          )}
          {task.est_minutes != null && (
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {task.est_minutes} min
            </span>
          )}
          {task.materials && (
            <span className="flex items-center gap-1">
              <Package className="size-3.5" />
              materials
            </span>
          )}
        </span>
      </Link>
    </div>
  );
}

export const PRIORITY_ORDER = { next: 0, soon: 1, someday: 2 } as const;

export function sortProjects(a: Task, b: Task): number {
  const pa = a.priority ? PRIORITY_ORDER[a.priority] : 3;
  const pb = b.priority ? PRIORITY_ORDER[b.priority] : 3;
  if (pa !== pb) return pa - pb;
  return a.created_at.localeCompare(b.created_at);
}
