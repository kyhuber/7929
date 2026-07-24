"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hammer, House, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Today", icon: House },
  { href: "/projects", label: "Projects", icon: Hammer },
  { href: "/all", label: "All", icon: ListChecks },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs",
                active
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <Icon className={cn("size-5", active && "text-primary")} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
