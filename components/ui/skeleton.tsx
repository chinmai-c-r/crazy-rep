import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        // A soft band of light glides across (transform only, so it stays cheap); still when motion is reduced
        "relative overflow-hidden rounded-md bg-muted before:absolute before:inset-0 before:-translate-x-full before:animate-skeleton before:bg-gradient-to-r before:from-transparent before:via-foreground/[0.09] before:to-transparent motion-reduce:before:animate-none",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
