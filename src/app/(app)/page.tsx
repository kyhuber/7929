"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ProjectRow, sortProjects } from "@/components/project-row";
import {
  matchesTimeFilter,
  TimeFilterChips,
  type TimeFilter,
} from "@/components/time-filter";
import { TodayRow } from "@/components/today-row";
import {
  classifyForToday,
  formatDaysOverdue,
  nextUpcoming,
} from "@/lib/dueness";
import { useTasks } from "@/lib/tasks-context";

export default function TodayPage() {
  const { tasks, loading } = useTasks();
  const [filter, setFilter] = useState<TimeFilter>(null);

  const now = new Date();
  const items = classifyForToday(tasks, now);
  const visible = items.filter((i) =>
    matchesTimeFilter(filter, i.task.est_minutes)
  );

  const overdue = visible.filter((i) => i.bucket === "overdue");
  const dueToday = visible.filter((i) => i.bucket === "due");
  const upcoming = visible.filter((i) => i.bucket === "upcoming");

  // With a time filter active, surface backlog projects that fit the window —
  // the free half-hour becomes completed work (PRD §7.1).
  const backlogFits =
    filter === null
      ? []
      : tasks
          .filter(
            (t) =>
              t.kind === "project" &&
              t.status === "active" &&
              matchesTimeFilter(filter, t.est_minutes)
          )
          .sort(sortProjects)
          .slice(0, 5);

  const nothingDue =
    !loading &&
    items.filter((i) => i.bucket === "overdue" || i.bucket === "due")
      .length === 0;
  const next = nothingDue ? nextUpcoming(tasks, now) : null;

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        <p suppressHydrationWarning className="text-sm text-muted-foreground">
          {now.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </header>

      <div className="mb-5">
        <TimeFilterChips value={filter} onChange={setFilter} />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-card" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-overdue">
                Overdue
              </h2>
              <div className="space-y-2">
                {overdue.map((i) => (
                  <TodayRow key={i.task.id} item={i} />
                ))}
              </div>
            </section>
          )}

          {dueToday.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Due today
              </h2>
              <div className="space-y-2">
                {dueToday.map((i) => (
                  <TodayRow key={i.task.id} item={i} />
                ))}
              </div>
            </section>
          )}

          {nothingDue && (
            <section className="rounded-xl bg-card p-5">
              <p className="text-base">Nothing needs doing right now.</p>
              {next && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Next up: {next.task.name},{" "}
                  {formatDaysOverdue(next.due.daysOverdue)}.
                </p>
              )}
              <p className="mt-3 text-sm">
                Got some time anyway?{" "}
                <Link href="/projects" className="font-medium text-primary underline underline-offset-2">
                  The project backlog
                </Link>{" "}
                is waiting.
              </p>
            </section>
          )}

          {backlogFits.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                From the backlog
              </h2>
              <div className="space-y-2">
                {backlogFits.map((t) => (
                  <ProjectRow key={t.id} task={t} />
                ))}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="group flex w-full items-center gap-1.5 py-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Coming up
                <span className="font-normal normal-case tracking-normal">
                  ({upcoming.length})
                </span>
                <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {upcoming.map((i) => (
                  <TodayRow key={i.task.id} item={i} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}
    </div>
  );
}
