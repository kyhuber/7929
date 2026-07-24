import { TabBar } from "@/components/tab-bar";
import { TasksProvider } from "@/lib/tasks-context";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TasksProvider>
      <main className="mx-auto w-full max-w-md px-4 pb-32 pt-5">
        {children}
      </main>
      <TabBar />
    </TasksProvider>
  );
}
