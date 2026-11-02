import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Accent colours for a tile: the icon, and the soft glow in its corner. */
export const ACCENTS = {
  lime: { icon: "text-primary", glow: "bg-primary" },
  cyan: { icon: "text-chart-4", glow: "bg-chart-4" },
  orange: { icon: "text-chart-2", glow: "bg-chart-2" },
  pink: { icon: "text-chart-3", glow: "bg-chart-3" },
} as const;
export type Accent = keyof typeof ACCENTS;

const Glow = ({ accent }: { accent: Accent }) => (
  <i aria-hidden className={cn("pointer-events-none absolute -top-8 -right-8 size-24 rounded-full opacity-20 blur-2xl", ACCENTS[accent].glow)} />
);

type TileProps = { label: string; icon: LucideIcon; accent: Accent };

/**
 * Headline number with a label, icon and a line of context. The loading version shares this markup:
 * label row 16px, value 36px, context 16px, so both are the same size.
 */
export function StatTile({
  label,
  icon: Icon,
  accent,
  value,
  unit,
  sub,
  loading,
}: TileProps & { value?: string; unit?: string; sub?: React.ReactNode; loading?: boolean }) {
  return (
    <Card className="relative gap-1 overflow-hidden rounded-2xl px-4 py-4">
      <Glow accent={accent} />
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={cn("size-3.5", ACCENTS[accent].icon)} aria-hidden />
        {label}
      </span>
      {loading ? (
        <Skeleton className="h-9 w-20 rounded" />
      ) : (
        <b className="font-heading text-3xl font-normal">
          {value} {unit && <small className="font-sans text-xs text-muted-foreground">{unit}</small>}
        </b>
      )}
      {loading ? <Skeleton className="h-4 w-24 rounded" /> : <span className="block h-4 truncate text-xs leading-4 text-muted-foreground">{sub}</span>}
    </Card>
  );
}

/** Smaller card for a single finding ("on target", "peak day"). */
export function Highlight({
  label,
  icon: Icon,
  accent,
  value,
  sub,
  loading,
}: TileProps & { value?: string; sub?: React.ReactNode; loading?: boolean }) {
  return (
    <Card className="relative gap-0.5 overflow-hidden rounded-2xl px-3 py-3">
      <Glow accent={accent} />
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={cn("size-3.5 shrink-0", ACCENTS[accent].icon)} aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      {loading ? <Skeleton className="h-8 w-16 rounded" /> : <b className="block h-8 truncate font-heading text-2xl leading-8 font-normal">{value}</b>}
      {loading ? <Skeleton className="h-4 w-20 rounded" /> : <span className="block h-4 truncate text-xs leading-4 text-muted-foreground">{sub}</span>}
    </Card>
  );
}
