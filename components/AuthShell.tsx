import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "./Logo";

export function AuthShell({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -top-48 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <Card className="relative w-full max-w-md gap-6 rounded-3xl border-border/80 bg-card/90 py-8 backdrop-blur">
        <CardHeader className="gap-3 px-6 sm:px-8">
          <Logo className="mb-2" />
          <CardTitle className="font-heading text-4xl font-normal tracking-wide">{title}</CardTitle>
          {description && <CardDescription className="text-base">{description}</CardDescription>}
        </CardHeader>
        <CardContent className="px-6 sm:px-8">{children}</CardContent>
      </Card>
    </main>
  );
}
