"use client";

import { use } from "react";
import { TaskForm } from "@/components/task-form";
import { useTasks } from "@/lib/tasks-context";

export default function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { tasks, loading } = useTasks();
  const task = tasks.find((t) => t.id === id);

  if (loading) {
    return <div className="h-40 animate-pulse rounded-xl bg-card" />;
  }
  if (!task) {
    return <p className="text-muted-foreground">Task not found.</p>;
  }

  return (
    <div>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Edit task</h1>
      <TaskForm task={task} />
    </div>
  );
}
