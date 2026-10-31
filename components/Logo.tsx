import { Zap } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ href = "/", className, compact }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} aria-label="Crazy Rep" className={cn("inline-flex items-center gap-2 font-heading text-2xl tracking-wide", className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Zap className="size-5 fill-current" />
      </span>
      {!compact && (
        <span>
          CRAZY <span className="text-primary">REP</span>
        </span>
      )}
    </Link>
  );
}
