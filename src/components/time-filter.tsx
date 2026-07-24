"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type TimeFilter = null | 15 | 30;

/** "I have 20 minutes, what can I do?" — PRD §7.1 */
export function TimeFilterChips({
  value,
  onChange,
}: {
  value: TimeFilter;
  onChange: (v: TimeFilter) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value === null ? "any" : String(value)}
      onValueChange={(v) => {
        if (!v || v === "any") onChange(null);
        else onChange(Number(v) as TimeFilter);
      }}
      className="w-full justify-start gap-2"
    >
      {[
        { v: "any", label: "Any" },
        { v: "15", label: "≤15 min" },
        { v: "30", label: "≤30 min" },
      ].map(({ v, label }) => (
        <ToggleGroupItem
          key={v}
          value={v}
          className="h-9 flex-none rounded-full border border-border bg-card px-4 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function matchesTimeFilter(
  filter: TimeFilter,
  estMinutes: number | null
): boolean {
  if (filter === null) return true;
  return estMinutes !== null && estMinutes <= filter;
}
