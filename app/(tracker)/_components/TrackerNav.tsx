"use client";

import { Bot, Camera, Flame, FlaskConical, LineChart, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { useFlag } from "./Flags";

const tabs = [
  { href: "/dashboard", label: "Today", icon: Flame },
  { href: "/history", label: "History", icon: LineChart },
  { href: "/scan", label: "Log meal", icon: Camera, primary: true },
  { href: "/coach", label: "Coach", icon: Bot },
  { href: "/profile", label: "Profile", icon: UserRound },
];

/** Only shown to admins (admin-users flag); the page and its API also check on the server. */
const adminTab = { href: "/api-test", label: "API test", icon: FlaskConical, primary: false };

export default function TrackerNav() {
  const pathname = usePathname();
  const items = useFlag("admin-users") ? [...tabs, adminTab] : tabs;

  return (
    <nav
      aria-label="App"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/90 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-lg lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-8 lg:border-t-0 lg:border-r lg:bg-sidebar lg:px-4 lg:py-7"
    >
      <Logo href="/dashboard" className="hidden px-3 lg:inline-flex" />
      <ul className={cn("mx-auto grid max-w-lg", items.length > 5 ? "grid-cols-6" : "grid-cols-5", "gap-1 lg:m-0 lg:max-w-none lg:grid-cols-1 lg:gap-1.5")}>
        {items.map(({ href, label, icon: Icon, primary }) => {
          const on = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-[0.7rem] font-semibold text-muted-foreground transition-colors lg:flex-row lg:gap-3 lg:px-4 lg:py-3 lg:text-sm",
                  on && "text-foreground lg:bg-sidebar-accent lg:text-sidebar-accent-foreground",
                  !on && "lg:hover:bg-muted lg:hover:text-foreground",
                  primary && "lg:bg-primary lg:text-primary-foreground lg:hover:bg-primary/90 lg:hover:text-primary-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid place-items-center",
                    primary &&
                      "-mt-7 size-14 rounded-full border-4 border-background bg-primary text-primary-foreground shadow-[0_8px_30px_rgb(198_255_0/0.35)] lg:m-0 lg:size-auto lg:border-0 lg:bg-transparent lg:shadow-none",
                  )}
                >
                  <Icon className={cn("size-5", primary && "size-6 lg:size-5")} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
