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
import * as db from "@/lib/mutations";
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
  createTask: (data: db.NewTask) => Promise<Task | null>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<boolean>;
}

const TasksContext = createContext<TasksContextValue | null>(null);

export function useTasks(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks outside TasksProvider");
  return ctx;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setTasks(await db.fetchTasks(supabase));
    } catch (e) {
      toast.error(message(e));
    } finally {
      setLoading(false);
    }
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
      try {
        await db.updateTask(supabase, id, patch);
        return true;
      } catch (e) {
        if (before) patchLocal(id, before);
        toast.error(message(e));
        return false;
      }
    },
    [supabase, tasks, patchLocal]
  );

  const completeWithUndo = useCallback(
    async (task: Task) => {
      const previous = db.completionUndoState(task);
      const completedAt = new Date().toISOString();
      patchLocal(task.id, db.completionPatch(task, completedAt));

      let completionId: string;
      try {
        ({ completionId } = await db.completeTask(supabase, task, { completedAt }));
      } catch (e) {
        patchLocal(task.id, previous);
        toast.error(message(e));
        return;
      }

      toast(`${task.name} — done`, {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            patchLocal(task.id, previous);
            try {
              await db.undoCompletion(supabase, task.id, completionId, previous);
            } catch (e) {
              toast.error(message(e));
              refresh();
            }
          },
        },
      });
    },
    [supabase, patchLocal, refresh]
  );

  const snoozeTask = useCallback(
    async (task: Task, days: number) => {
      const ok = await updateTask(task.id, { snooze_until: db.snoozeUntil(days) });
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
    async (data: db.NewTask) => {
      try {
        const created = await db.createTask(supabase, data);
        setTasks((prev) => [...prev, created]);
        return created;
      } catch (e) {
        toast.error(message(e));
        return null;
      }
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
