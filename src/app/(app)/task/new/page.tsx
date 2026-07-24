"use client";

import { TaskForm } from "@/components/task-form";

export default function NewTaskPage() {
  return (
    <div>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">New task</h1>
      <TaskForm />
    </div>
  );
}
