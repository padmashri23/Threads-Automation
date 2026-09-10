export function ScoreRing({ value, label, size = 64, tone = "accent" }: { value: number; label: string; size?: number; tone?: "accent" | "info" | "ok" }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const color = tone === "accent" ? "var(--accent)" : tone === "info" ? "var(--info)" : "var(--ok)";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} ${value}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.3} fontWeight={700} fill="var(--fg)">
          {Math.round(value)}
        </text>
      </svg>
      <span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
    </div>
  );
}

export function ScoreBar({ value, label, max = 100 }: { value: number; label: string; max?: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-muted">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-border overflow-hidden">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
      <span className="w-8 text-right tabular-nums">{Math.round(value)}</span>
    </div>
  );
}
