"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/lib/types";

interface TasksContextValue {
  tasks: Task[];
  loading: boolean;
  refresh: () => Promise<void>;
  /** Optimistic complete with a 5-second undo toast (PRD §7.1). */
  completeWithUndo: (task: Task) => Promise<void>;
  snoozeTask: (task: Task, days: number) => Promise<void>;
  clearSnooze: (task: Task) => Promise<void>;
  setArchived: (task: Task, archived: boolean) => Promise<void>;
  createTask: (
    data: Omit<Partial<Task>, "id" | "created_at"> &
      Pick<Task, "kind" | "name" | "category">
  ) => Promise<Task | null>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<boolean>;
}

const TasksContext = createContext<TasksContextValue | null>(null);

export function useTasks(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks outside TasksProvider");
  return ctx;
}

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      toast.error(`Couldn't load tasks: ${error.message}`);
    } else {
      setTasks((data as Task[]) ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const patchLocal = useCallback((id: string, patch: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  }, []);

  const updateTask = useCallback(
    async (id: string, patch: Partial<Task>) => {
      const before = tasks.find((t) => t.id === id);
      patchLocal(id, patch);
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) {
        if (before) patchLocal(id, before);
        toast.error(`Save failed: ${error.message}`);
        return false;
      }
      return true;
    },
    [supabase, tasks, patchLocal]
  );

  const completeWithUndo = useCallback(
    async (task: Task) => {
      const completedAt = new Date().toISOString();
      const prev = {
        last_completed_at: task.last_completed_at,
        snooze_until: task.snooze_until,
        status: task.status,
      };
      const next: Partial<Task> =
        task.kind === "project"
          ? { status: "done" as const, last_completed_at: completedAt }
          : { last_completed_at: completedAt, snooze_until: null };

      patchLocal(task.id, next);

      const [{ data: completion, error: cErr }, { error: tErr }] =
        await Promise.all([
          supabase
            .from("completions")
            .insert({ task_id: task.id, completed_at: completedAt })
            .select("id")
            .single(),
          supabase.from("tasks").update(next).eq("id", task.id),
        ]);

      if (cErr || tErr) {
        patchLocal(task.id, prev);
        toast.error(
          `Couldn't complete: ${(cErr ?? tErr)?.message ?? "unknown error"}`
        );
        return;
      }

      toast(`${task.name} — done`, {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            patchLocal(task.id, prev);
            await Promise.all([
              supabase.from("completions").delete().eq("id", completion.id),
              supabase.from("tasks").update(prev).eq("id", task.id),
            ]);
          },
        },
      });
    },
    [supabase, patchLocal]
  );

  const snoozeTask = useCallback(
    async (task: Task, days: number) => {
      const until = new Date();
      until.setDate(until.getDate() + days);
      const ok = await updateTask(task.id, {
        snooze_until: until.toISOString(),
      });
      if (ok) toast(`${task.name} snoozed ${days} days`);
    },
    [updateTask]
  );

  const clearSnooze = useCallback(
    async (task: Task) => {
      await updateTask(task.id, { snooze_until: null });
    },
    [updateTask]
  );

  const setArchived = useCallback(
    async (task: Task, archived: boolean) => {
      const ok = await updateTask(task.id, {
        status: archived ? "archived" : "active",
      });
      if (ok) toast(archived ? `${task.name} archived` : `${task.name} restored`);
    },
    [updateTask]
  );

  const createTask = useCallback(
    async (
      data: Omit<Partial<Task>, "id" | "created_at"> &
        Pick<Task, "kind" | "name" | "category">
    ) => {
      const { data: created, error } = await supabase
        .from("tasks")
        .insert(data)
        .select("*")
        .single();
      if (error) {
        toast.error(`Couldn't add: ${error.message}`);
        return null;
      }
      setTasks((prev) => [...prev, created as Task]);
      return created as Task;
    },
    [supabase]
  );

  const value = useMemo(
    () => ({
      tasks,
      loading,
      refresh,
      completeWithUndo,
      snoozeTask,
      clearSnooze,
      setArchived,
      createTask,
      updateTask,
    }),
    [
      tasks,
      loading,
      refresh,
      completeWithUndo,
      snoozeTask,
      clearSnooze,
      setArchived,
      createTask,
      updateTask,
    ]
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}
