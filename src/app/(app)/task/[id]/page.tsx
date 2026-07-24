"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronLeft,
  Clock,
  MapPin,
  Package,
  Pencil,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CategoryIcon } from "@/components/category-icon";
import { createClient } from "@/lib/supabase/client";
import {
  dueInfo,
  formatCadence,
  formatDaysOverdue,
  isActiveInMonth,
  isSnoozed,
} from "@/lib/dueness";
import { useTasks } from "@/lib/tasks-context";
import type { Completion } from "@/lib/types";

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const {
    tasks,
    loading,
    completeWithUndo,
    snoozeTask,
    clearSnooze,
    setArchived,
    updateTask,
  } = useTasks();
  const supabase = useMemo(() => createClient(), []);
  const [history, setHistory] = useState<Completion[] | null>(null);

  const task = tasks.find((t) => t.id === id);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("completions")
      .select("*")
      .eq("task_id", id)
      .order("completed_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (!cancelled) setHistory((data as Completion[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, id, task?.last_completed_at, task?.status]);

  if (loading) {
    return <div className="h-40 animate-pulse rounded-xl bg-card" />;
  }
  if (!task) {
    return (
      <div>
        <p className="text-muted-foreground">Task not found.</p>
        <Button variant="link" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    );
  }

  const now = new Date();
  const due = dueInfo(task, now);
  const snoozed = isSnoozed(task, now);
  const dormant = task.kind === "recurring" && !isActiveInMonth(task, now);

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "never";

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.back()}
        className="-ml-1 flex min-h-11 items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" />
        Back
      </button>

      <header>
        <div className="flex items-center gap-2 text-muted-foreground">
          <CategoryIcon category={task.category} className="size-4" />
          <span className="text-sm capitalize">{task.category}</span>
          {task.kind === "project" && task.priority && (
            <Badge variant="secondary" className="capitalize">
              {task.priority}
            </Badge>
          )}
          {task.status !== "active" && (
            <Badge variant="outline" className="capitalize">
              {task.status}
            </Badge>
          )}
          {dormant && <Badge variant="outline">dormant now</Badge>}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {task.name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {task.est_minutes != null && (
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {task.est_minutes} min
            </span>
          )}
          {task.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              {task.location}
            </span>
          )}
        </div>
      </header>

      {task.status === "active" && (
        <div className="space-y-3">
          <Button
            onClick={() => completeWithUndo(task)}
            className="h-13 w-full gap-2 text-base"
          >
            <Check className="size-5" />
            {task.kind === "project" ? "Mark done" : "Complete"}
          </Button>

          {snoozed ? (
            <div className="flex items-center justify-between rounded-lg bg-card px-4 py-3 text-sm">
              <span>
                Snoozed until{" "}
                {new Date(task.snooze_until!).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearSnooze(task)}
              >
                Clear
              </Button>
            </div>
          ) : (
            task.kind === "recurring" && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Snooze</span>
                {[3, 7, 14].map((d) => (
                  <Button
                    key={d}
                    variant="outline"
                    className="h-11 flex-1 bg-card"
                    onClick={() => snoozeTask(task, d)}
                  >
                    {d}d
                  </Button>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {task.status === "done" && (
        <Button
          variant="outline"
          className="h-12 w-full bg-card"
          onClick={() => updateTask(task.id, { status: "active" })}
        >
          Reopen project
        </Button>
      )}

      {task.kind === "recurring" && (
        <section className="rounded-xl bg-card p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Cadence
          </h2>
          <p className="mt-1">{formatCadence(task) || "—"}</p>
          <Separator className="my-3" />
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Last completed</dt>
              <dd className="font-medium">{fmtDate(task.last_completed_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Next due</dt>
              <dd className="font-medium">
                {dormant
                  ? "out of season"
                  : due
                    ? `${due.dueDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })} (${formatDaysOverdue(due.daysOverdue)})`
                    : "—"}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {task.steps.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Steps
          </h2>
          {/* Reference only — the session is the unit of tracking (PRD §5) */}
          <ul className="space-y-1.5 rounded-xl bg-card p-4">
            {task.steps.map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(task.materials || task.notes) && (
        <section className="space-y-3">
          {task.materials && (
            <div className="flex gap-2.5 rounded-xl bg-card p-4">
              <Package className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-sm">{task.materials}</p>
            </div>
          )}
          {task.notes && (
            <div className="rounded-xl bg-card p-4 text-sm">{task.notes}</div>
          )}
        </section>
      )}

      {history && history.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            History
          </h2>
          <ul className="divide-y divide-border rounded-xl bg-card px-4">
            {history.map((c) => (
              <li key={c.id} className="py-2.5 text-sm">
                <span className="font-medium">{fmtDate(c.completed_at)}</span>
                {c.notes && (
                  <span className="text-muted-foreground"> — {c.notes}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex gap-2 pb-4">
        <Button asChild variant="outline" className="h-12 flex-1 gap-1.5 bg-card">
          <Link href={`/task/${task.id}/edit`}>
            <Pencil className="size-4" />
            Edit
          </Link>
        </Button>
        {task.status !== "done" && (
          <Button
            variant="outline"
            className="h-12 flex-1 gap-1.5 bg-card"
            onClick={async () => {
              await setArchived(task, task.status === "active");
              router.back();
            }}
          >
            {task.status === "active" ? (
              <>
                <Archive className="size-4" />
                Archive
              </>
            ) : (
              <>
                <ArchiveRestore className="size-4" />
                Restore
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
