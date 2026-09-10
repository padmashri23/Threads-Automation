"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Compass, History, Settings2 } from "lucide-react";

const LINKS = [
  { href: "/", label: "Today", icon: Flame },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Style", icon: Settings2 },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 h-14">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white">
            <Flame size={16} />
          </span>
          <span>Threads AI Editor</span>
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                  active ? "bg-fg text-bg" : "text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
