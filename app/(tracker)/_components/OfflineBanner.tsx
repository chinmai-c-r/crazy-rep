"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useOnline } from "@/lib/offline";

/** A slim bar while there's no connection, and a note when it comes back. */
export default function OfflineBanner() {
  const online = useOnline();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) wasOffline.current = true;
    else if (wasOffline.current) {
      wasOffline.current = false;
      toast.success("Back online");
    }
  }, [online]);

  if (online) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 border-b border-warn/30 bg-background/95 px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 text-center text-xs font-medium text-warn backdrop-blur-lg animate-in slide-in-from-top-2"
    >
      <WifiOff className="size-3.5 shrink-0" aria-hidden />
      You&apos;re offline. You can read your saved data, but logging and edits are paused.
    </div>
  );
}

/** The message shown in place of something that needs a connection. */
export function OfflineNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p role="status" className={`flex items-start gap-2 rounded-2xl border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-warn ${className ?? ""}`}>
      <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
