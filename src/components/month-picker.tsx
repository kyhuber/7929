"use client";

import { MONTH_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 12 toggle chips; `value` holds selected months 1–12. */
export function MonthPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (months: number[]) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {MONTH_LABELS.map((label, i) => {
        const month = i + 1;
        const on = value.includes(month);
        return (
          <button
            key={month}
            type="button"
            onClick={() =>
              onChange(
                on
                  ? value.filter((m) => m !== month)
                  : [...value, month].sort((a, b) => a - b)
              )
            }
            className={cn(
              "min-h-10 rounded-lg border text-sm transition-colors",
              on
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
