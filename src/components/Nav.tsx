"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Compass, History, Settings2, ShieldCheck } from "lucide-react";

const LINKS = [
  { href: "/", label: "Today", icon: Flame },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Style", icon: Settings2 },
];

export function Nav() {
  const path = usePathname();
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[220px] flex-col bg-[#171918] px-3 py-5 text-white lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent text-white shadow-[0_6px_20px_rgba(240,82,58,.22)]"><Flame size={18} strokeWidth={2.4} /></span>
          <span className="text-sm font-semibold tracking-[-0.02em]">Threads AI Editor</span>
        </Link>
        <nav aria-label="Primary" className="space-y-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`group relative flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[13px] font-medium transition ${active ? "bg-white/[0.09] text-white" : "text-[#a7aaa5] hover:bg-white/[0.055] hover:text-white"}`}>
                {active ? <span className="absolute -left-3 h-6 w-[3px] rounded-r-full bg-accent" /> : null}
                <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-accent" : ""} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-white/10 px-2 pt-4">
          <div className="flex items-start gap-2.5 text-[11px] leading-relaxed text-[#8f938e]"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#79c99a]" /><span>Every draft is grounded in the sources shown.</span></div>
        </div>
      </aside>
      <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-bg/95 px-4 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight"><span className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] bg-accent text-white"><Flame size={16} /></span>Threads AI Editor</Link>
      </header>
      <nav aria-label="Mobile primary" className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 rounded-[14px] border border-white/10 bg-[#171918]/95 p-1.5 text-white shadow-[0_16px_50px_rgba(0,0,0,.25)] backdrop-blur lg:hidden">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-[9px] text-[10px] font-medium transition ${active ? "bg-white/10 text-white" : "text-[#a7aaa5]"}`}><Icon size={17} className={active ? "text-accent" : ""} />{label}</Link>;
        })}
      </nav>
    </>
  );
}
