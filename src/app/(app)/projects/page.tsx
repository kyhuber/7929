"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProjectRow, sortProjects } from "@/components/project-row";
import {
  matchesTimeFilter,
  TimeFilterChips,
  type TimeFilter,
} from "@/components/time-filter";
import { useTasks } from "@/lib/tasks-context";
import type { Task, TaskPriority } from "@/lib/types";

const GROUPS: { priority: TaskPriority; label: string }[] = [
  { priority: "next", label: "Next" },
  { priority: "soon", label: "Soon" },
  { priority: "someday", label: "Someday" },
];

export default function ProjectsPage() {
  const { tasks, loading } = useTasks();
  const [filter, setFilter] = useState<TimeFilter>(null);

  const projects = useMemo(
    () =>
      tasks
        .filter(
          (t) =>
            t.kind === "project" &&
            t.status === "active" &&
            matchesTimeFilter(filter, t.est_minutes)
        )
        .sort(sortProjects),
    [tasks, filter]
  );

  const ungrouped = projects.filter((t) => !t.priority);

  return (
    <div>
      <header className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">The running backlog</p>
        </div>
        <QuickAdd />
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
      ) : projects.length === 0 ? (
        <p className="rounded-xl bg-card p-5 text-muted-foreground">
          {filter === null
            ? "The backlog is empty. When a caulk job occurs to you, capture it here."
            : "Nothing in the backlog fits that window."}
        </p>
      ) : (
        <div className="space-y-6">
          {GROUPS.map(({ priority, label }) => {
            const group = projects.filter((t) => t.priority === priority);
            if (group.length === 0) return null;
            return (
              <section key={priority}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </h2>
                <div className="space-y-2">
                  {group.map((t) => (
                    <ProjectRow key={t.id} task={t} />
                  ))}
                </div>
              </section>
            );
          })}
          {ungrouped.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Unsorted
              </h2>
              <div className="space-y-2">
                {ungrouped.map((t) => (
                  <ProjectRow key={t.id} task={t} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * PRD §7.2 — capture in ten seconds: name + est. minutes only,
 * everything else editable later.
 */
function QuickAdd() {
  const { createTask } = useTasks();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [est, setEst] = useState("");
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const created: Task | null = await createTask({
      kind: "project",
      name: name.trim(),
      category: "living",
      priority: "soon",
      est_minutes: est ? Number(est) : null,
      status: "active",
    });
    setSaving(false);
    if (created) {
      setName("");
      setEst("");
      setOpen(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button size="lg" className="h-11 gap-1.5 rounded-full px-4">
          <Plus className="size-5" />
          Add
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="pb-0">
          <DrawerTitle>New project</DrawerTitle>
        </DrawerHeader>
        <form onSubmit={add} className="space-y-4 p-4 pb-8">
          <div className="space-y-2">
            <Label htmlFor="qa-name">What needs doing?</Label>
            <Input
              id="qa-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Caulk back door frame"
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qa-est">Estimated minutes (optional)</Label>
            <Input
              id="qa-est"
              type="number"
              inputMode="numeric"
              min={1}
              value={est}
              onChange={(e) => setEst(e.target.value)}
              placeholder="30"
              className="h-12 text-base"
            />
          </div>
          <Button
            type="submit"
            disabled={saving || !name.trim()}
            className="h-12 w-full text-base"
          >
            {saving ? "Adding…" : "Add to backlog"}
          </Button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
