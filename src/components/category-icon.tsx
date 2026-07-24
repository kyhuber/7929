import {
  BedDouble,
  CookingPot,
  FileText,
  ShowerHead,
  Sofa,
  TreePine,
  WashingMachine,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { TaskCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<TaskCategory, LucideIcon> = {
  kitchen: CookingPot,
  bathroom: ShowerHead,
  bedroom: BedDouble,
  living: Sofa,
  laundry: WashingMachine,
  exterior: TreePine,
  systems: Wrench,
  admin: FileText,
};

export function CategoryIcon({
  category,
  className,
}: {
  category: TaskCategory;
  className?: string;
}) {
  const Icon = ICONS[category];
  return <Icon className={cn("size-5", className)} aria-label={category} />;
}
