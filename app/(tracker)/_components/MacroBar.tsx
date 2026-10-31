import { Progress } from "@/components/ui/progress";
import { fmt } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

const COLORS = {
  protein: "*:data-[slot=progress-indicator]:bg-protein",
  carbs: "*:data-[slot=progress-indicator]:bg-carbs",
  fat: "*:data-[slot=progress-indicator]:bg-fat",
};
const DOTS = { protein: "bg-protein", carbs: "bg-carbs", fat: "bg-fat" };

export default function MacroBar({
  label,
  value,
  goal,
  macro,
}: {
  label: string;
  value: number;
  goal?: number;
  macro: keyof typeof COLORS;
}) {
  const over = goal ? value > goal : false;
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between text-sm">
        <span className="flex items-center gap-2">
          <i className={cn("size-2.5 rounded-full", DOTS[macro])} />
          {label}
        </span>
        <b>
          {fmt(value, 1)}g{goal ? <small className="font-normal text-muted-foreground"> / {fmt(goal)}g</small> : null}
        </b>
      </div>
      {goal ? (
        <Progress
          value={Math.min((value / goal) * 100, 100)}
          className={cn("h-2.5", over ? "*:data-[slot=progress-indicator]:bg-destructive" : COLORS[macro])}
        />
      ) : null}
    </div>
  );
}
