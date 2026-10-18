"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, House, List, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useData } from "@/lib/data";
import { AppGate } from "./app-gate";
import { useExpenseSheet } from "./expense-sheet";
import { ICON, cx } from "./ui";

const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/activity/", label: "Activity", icon: List },
  { href: "/insights/", label: "Insights", icon: BarChart3 },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href.replace(/\/$/, ""));
}

function Avatar() {
  const { backend } = useData();
  const letter = (backend.email ?? "S").charAt(0).toUpperCase();
  return (
    <Link
      href="/settings/"
      aria-label="Settings"
      className="press flex h-9 w-9 items-center justify-center rounded-full border hairline text-sm font-medium text-muted hover:text-fg"
    >
      {letter}
    </Link>
  );
}

function AddButton({ className }: { className?: string }) {
  const sheet = useExpenseSheet();
  return (
    <button
      aria-label="Add expense"
      onClick={() => sheet.open()}
      className={cx("press flex items-center justify-center rounded-full bg-accent text-accent-fg", className)}
    >
      <Plus size={24} strokeWidth={1.75} />
    </button>
  );
}

/** Page frame for signed-in screens: header, centered column, bottom nav on mobile. */
export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const path = usePathname();
  return (
    <AppGate>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col md:max-w-3xl lg:max-w-5xl">
        <header className="flex h-16 items-center justify-between px-[max(1.25rem,env(safe-area-inset-left))] pt-[env(safe-area-inset-top)] md:h-20 md:px-8">
          <Link href="/" className="text-[15px] font-semibold tracking-tight">
            {title ?? "Spendly"}
          </Link>
          <div className="flex items-center gap-6">
            <nav className="hidden items-center gap-6 md:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx("text-sm transition-colors duration-150", isActive(path, item.href) ? "text-fg" : "text-muted hover:text-fg")}
                >
                  {item.label}
                </Link>
              ))}
              <AddButton className="h-9 w-9" />
            </nav>
            <Avatar />
          </div>
        </header>
        <main className="flex-1 px-[max(1.25rem,env(safe-area-inset-left))] pb-32 md:px-8 md:pb-16">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t hairline bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-4 items-center px-[env(safe-area-inset-left)]">
          {NAV.slice(0, 2).map((item) => (
            <NavItem key={item.href} {...item} active={isActive(path, item.href)} />
          ))}
          <div className="flex justify-center">
            <AddButton className="h-12 w-12" />
          </div>
          <NavItem {...NAV[2]} active={isActive(path, NAV[2].href)} />
        </div>
      </nav>
    </AppGate>
  );
}

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof House; active: boolean }) {
  return (
    <Link
      href={href}
      className={cx("press flex flex-col items-center gap-1 text-[11px] transition-colors duration-150", active ? "text-fg" : "text-faint")}
    >
      <Icon {...ICON} />
      {label}
    </Link>
  );
}
