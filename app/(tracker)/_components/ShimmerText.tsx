import { cn } from "@/lib/utils";

/** A real label that is greyed out while its number loads, with a faint band of light running through it. */
export default function ShimmerText({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <span
      className={cn(
        "animate-text-shimmer bg-[linear-gradient(90deg,var(--muted-foreground)_32%,color-mix(in_oklab,var(--muted-foreground),var(--foreground)_40%)_50%,var(--muted-foreground)_68%)] bg-[length:250%_100%] bg-clip-text text-transparent opacity-60 motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-muted-foreground",
        className,
      )}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </span>
  );
}
