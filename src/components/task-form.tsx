"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MonthPicker } from "@/components/month-picker";
import { useTasks } from "@/lib/tasks-context";
import {
  CATEGORIES,
  type SeasonalOverride,
  type Task,
  type TaskCategory,
  type TaskKind,
  type TaskPriority,
} from "@/lib/types";

/** One form serving both kinds (PRD §7.5). */
export function TaskForm({ task }: { task?: Task }) {
  const router = useRouter();
  const { createTask, updateTask } = useTasks();

  const [kind, setKind] = useState<TaskKind>(task?.kind ?? "recurring");
  const [name, setName] = useState(task?.name ?? "");
  const [category, setCategory] = useState<TaskCategory>(
    task?.category ?? "kitchen"
  );
  const [est, setEst] = useState(task?.est_minutes?.toString() ?? "");
  const [interval, setInterval] = useState(
    task?.base_interval_days?.toString() ?? ""
  );
  const [overrides, setOverrides] = useState<SeasonalOverride[]>(
    task?.seasonal_overrides ?? []
  );
  const [activeMonths, setActiveMonths] = useState<number[]>(
    task?.active_months ?? []
  );
  const [priority, setPriority] = useState<TaskPriority>(
    task?.priority ?? "soon"
  );
  const [location, setLocation] = useState(task?.location ?? "");
  const [materials, setMaterials] = useState(task?.materials ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [steps, setSteps] = useState(task?.steps.join("\n") ?? "");
  const [saving, setSaving] = useState(false);

  const recurring = kind === "recurring";
  const valid =
    name.trim().length > 0 && (!recurring || Number(interval) >= 1);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);

    const data: Partial<Task> = {
      kind,
      name: name.trim(),
      category,
      est_minutes: est ? Number(est) : null,
      base_interval_days: recurring ? Number(interval) : null,
      seasonal_overrides: recurring
        ? overrides.filter((o) => o.months.length > 0 && o.interval_days >= 1)
        : null,
      active_months:
        recurring && activeMonths.length > 0 && activeMonths.length < 12
          ? activeMonths
          : null,
      priority: recurring ? null : priority,
      location: location.trim() || null,
      materials: materials.trim() || null,
      notes: notes.trim() || null,
      steps: steps
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    if (task) {
      const ok = await updateTask(task.id, data);
      setSaving(false);
      if (ok) router.push(`/task/${task.id}`);
    } else {
      const created = await createTask(
        data as Parameters<typeof createTask>[0]
      );
      setSaving(false);
      if (created) {
        router.push(created.kind === "project" ? "/projects" : "/all");
      }
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <Tabs value={kind} onValueChange={(v) => setKind(v as TaskKind)}>
        <TabsList className="h-11 w-full">
          <TabsTrigger value="recurring" className="flex-1 text-sm">
            Recurring
          </TabsTrigger>
          <TabsTrigger value="project" className="flex-1 text-sm">
            Project
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        <Label htmlFor="tf-name">Name</Label>
        <Input
          id="tf-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={recurring ? "Bathroom clean" : "Caulk back door frame"}
          className="h-12 text-base"
        />
        <p className="text-xs text-muted-foreground">
          Short — “Bathroom clean”, not “Clean the bathroom thoroughly”.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as TaskCategory)}
          >
            <SelectTrigger className="!h-12 w-full capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tf-est">Est. minutes</Label>
          <Input
            id="tf-est"
            type="number"
            inputMode="numeric"
            min={1}
            value={est}
            onChange={(e) => setEst(e.target.value)}
            className="h-12 text-base"
          />
        </div>
      </div>

      {recurring ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="tf-interval">Repeat every (days)</Label>
            <Input
              id="tf-interval"
              type="number"
              inputMode="numeric"
              min={1}
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              className="h-12 text-base"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Seasonal overrides</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-primary"
                onClick={() =>
                  setOverrides([...overrides, { months: [], interval_days: 7 }])
                }
              >
                <Plus className="size-4" />
                Add
              </Button>
            </div>
            {overrides.length === 0 && (
              <p className="text-xs text-muted-foreground">
                e.g. mow every 10 days April–September.
              </p>
            )}
            {overrides.map((o, i) => (
              <div key={i} className="space-y-2 rounded-xl bg-card p-3">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={o.interval_days || ""}
                    onChange={(e) => {
                      const next = [...overrides];
                      next[i] = { ...o, interval_days: Number(e.target.value) };
                      setOverrides(next);
                    }}
                    className="h-11 w-24 bg-background text-base"
                  />
                  <span className="text-sm text-muted-foreground">
                    days, during:
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto text-muted-foreground"
                    onClick={() =>
                      setOverrides(overrides.filter((_, j) => j !== i))
                    }
                    aria-label="Remove override"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <MonthPicker
                  value={o.months}
                  onChange={(months) => {
                    const next = [...overrides];
                    next[i] = { ...o, months };
                    setOverrides(next);
                  }}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Active months</Label>
            <p className="text-xs text-muted-foreground">
              Leave all off for year-round. Rain garden water is Jun–Sep only.
            </p>
            <MonthPicker value={activeMonths} onChange={setActiveMonths} />
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Label>Priority</Label>
          <ToggleGroup
            type="single"
            value={priority}
            onValueChange={(v) => v && setPriority(v as TaskPriority)}
            className="w-full gap-2"
          >
            {(["next", "soon", "someday"] as const).map((p) => (
              <ToggleGroupItem
                key={p}
                value={p}
                className="h-11 flex-1 rounded-lg border border-border bg-card capitalize data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {p}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="tf-steps">Steps (one per line)</Label>
        <Textarea
          id="tf-steps"
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          rows={4}
          placeholder={"Toilet\nSink and faucet\nMirror"}
          className="text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tf-location">Location</Label>
        <Input
          id="tf-location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Office, NE corner"
          className="h-12 text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tf-materials">Materials</Label>
        <Input
          id="tf-materials"
          value={materials}
          onChange={(e) => setMaterials(e.target.value)}
          placeholder="Exterior paintable caulk, white"
          className="h-12 text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tf-notes">Notes</Label>
        <Textarea
          id="tf-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="text-base"
        />
      </div>

      <div className="flex gap-2 pb-4">
        <Button
          type="button"
          variant="outline"
          className="h-12 flex-1 bg-card"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!valid || saving}
          className="h-12 flex-1 text-base"
        >
          {saving ? "Saving…" : task ? "Save" : "Add task"}
        </Button>
      </div>
    </form>
  );
}
