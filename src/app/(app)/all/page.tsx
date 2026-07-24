"use client";

import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CategoryIcon } from "@/components/category-icon";
import { dueInfo, formatCadence, isActiveInMonth } from "@/lib/dueness";
import { useTasks } from "@/lib/tasks-context";
import { CATEGORIES, type Task } from "@/lib/types";

/** PRD §7.3 — the maintenance-and-tuning surface, not a daily view. */
export default function AllTasksPage() {
  const { tasks, loading } = useTasks();
  const now = new Date();

  const recurring = tasks.filter((t) => t.kind === "recurring");
  const active = recurring.filter((t) => t.status === "active");
  const archived = recurring.filter((t) => t.status === "archived");

  return (
    <div>
      <header className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">All tasks</h1>
          <p className="text-sm text-muted-foreground">
            Recurring maintenance by room
          </p>
        </div>
        <Button asChild size="lg" className="h-11 gap-1.5 rounded-full px-4">
          <Link href="/task/new">
            <Plus className="size-5" />
            New
          </Link>
        </Button>
      </header>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-card" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map((category) => {
            const group = active.filter((t) => t.category === category);
            if (group.length === 0) return null;
            return (
              <section key={category}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <CategoryIcon category={category} className="size-4" />
                  {category}
                </h2>
                <div className="space-y-2">
                  {group.map((t) => (
                    <RecurringRow key={t.id} task={t} now={now} />
                  ))}
                </div>
              </section>
            );
          })}

          {archived.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="group flex w-full items-center gap-1.5 py-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Archived
                <span className="font-normal normal-case tracking-normal">
                  ({archived.length})
                </span>
                <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {archived.map((t) => (
                  <RecurringRow key={t.id} task={t} now={now} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}
    </div>
  );
}

function RecurringRow({ task, now }: { task: Task; now: Date }) {
  const due = task.status === "active" ? dueInfo(task, now) : null;
  const dormant = !isActiveInMonth(task, now);

  return (
    <Link
      href={`/task/${task.id}`}
      className="flex min-h-16 items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-xs active:bg-secondary"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium">
          {task.name}
        </span>
        <span className="block truncate text-sm text-muted-foreground">
          {formatCadence(task)}
        </span>
      </span>
      <span className="shrink-0 text-sm text-muted-foreground">
        {dormant
          ? "dormant"
          : due
            ? due.daysOverdue >= 0
              ? "due now"
              : `due ${due.dueDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}`
            : ""}
      </span>
    </Link>
  );
}
