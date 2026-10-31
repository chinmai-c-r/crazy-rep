import ClientOnly from "./_components/ClientOnly";
import { FlagsProvider } from "./_components/Flags";
import TrackerNav from "./_components/TrackerNav";

export default function TrackerLayout({ children }: { children: React.ReactNode }) {
  return (
    <FlagsProvider>
      <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
        <TrackerNav />
        <main className="pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10">
          <ClientOnly>{children}</ClientOnly>
        </main>
      </div>
    </FlagsProvider>
  );
}
