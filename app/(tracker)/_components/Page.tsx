import { cn } from "@/lib/utils";

/** Consistent page padding, max width and header across the tracker. */
export function Page({ narrow, className, children }: { narrow?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("mx-auto grid gap-5 px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-6 sm:px-6 lg:gap-6 lg:p-10", narrow ? "max-w-3xl" : "max-w-5xl", className)}>
      {children}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: React.ReactNode; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="text-sm text-muted-foreground">{eyebrow}</p>}
        <h1 className="font-heading text-4xl tracking-wide sm:text-5xl">{title}</h1>
      </div>
      {children}
    </header>
  );
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase", className)}>{children}</h2>;
}
