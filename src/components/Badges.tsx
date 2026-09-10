import type { Category, Credibility } from "@/lib/types";
import { ShieldCheck, ShieldAlert, ShieldQuestion, BadgeCheck, AlertTriangle, Clock } from "lucide-react";

export function CategoryChip({ category }: { category: Category }) {
  return <span className="chip bg-surface-2 text-fg border-border">{category}</span>;
}

const CRED: Record<Credibility, { label: string; cls: string; Icon: typeof ShieldCheck }> = {
  official: { label: "Official", cls: "bg-ok-soft text-ok", Icon: BadgeCheck },
  reliable: { label: "Reliable reporting", cls: "bg-ok-soft text-ok", Icon: ShieldCheck },
  early: { label: "Early report", cls: "bg-warn-soft text-warn", Icon: Clock },
  rumor: { label: "Rumor", cls: "bg-bad-soft text-bad", Icon: ShieldAlert },
  unverified: { label: "Unverified", cls: "bg-bad-soft text-bad", Icon: ShieldQuestion },
  conflicting: { label: "Conflicting reports", cls: "bg-warn-soft text-warn", Icon: AlertTriangle },
};

export function CredibilityChip({ credibility, title }: { credibility: Credibility; title?: string }) {
  const c = CRED[credibility] ?? CRED.unverified;
  return (
    <span className={`chip ${c.cls}`} title={title}>
      <c.Icon size={12} /> {c.label}
    </span>
  );
}

export function FreshnessChip({ label, hoursOld }: { label: string; hoursOld: number }) {
  const cls = label === "Breaking" ? "bg-accent-soft text-accent" : label === "Fresh" ? "bg-info-soft text-info" : "bg-surface-2 text-muted";
  const t = hoursOld < 1 ? "under 1h" : hoursOld < 48 ? `${Math.round(hoursOld)}h` : `${Math.round(hoursOld / 24)}d`;
  return (
    <span className={`chip ${cls}`}>
      {label} · {t}
    </span>
  );
}

export function StatusChip({ status }: { status: "suggested" | "published" | "skipped" }) {
  const cls = status === "published" ? "bg-ok-soft text-ok" : status === "skipped" ? "bg-surface-2 text-muted" : "bg-info-soft text-info";
  return <span className={`chip ${cls} capitalize`}>{status}</span>;
}
