import type { SourceRef } from "@/lib/types";
import { ExternalLink, Building2, Newspaper, MessageSquare, Users, Code2, FlaskConical, PlayCircle, Globe } from "lucide-react";

const ICON: Record<string, typeof Globe> = {
  official: Building2,
  publication: Newspaper,
  aggregator: Newspaper,
  community: MessageSquare,
  social: Users,
  developer: Code2,
  research: FlaskConical,
  video: PlayCircle,
};

export function SourceList({ sources, limit }: { sources: SourceRef[]; limit?: number }) {
  const list = limit ? sources.slice(0, limit) : sources;
  return (
    <ul className="space-y-1.5">
      {list.map((s) => {
        const Icon = ICON[s.kind] ?? Globe;
        return (
          <li key={s.url} className="flex items-start gap-2 text-sm">
            <Icon size={15} className="mt-0.5 shrink-0 text-muted" />
            <a href={s.url} target="_blank" rel="noreferrer" className="group inline-flex flex-wrap items-baseline gap-x-1.5 hover:underline">
              <span className="font-medium">{s.name}</span>
              <span className="text-xs text-muted">{s.label}</span>
              <ExternalLink size={11} className="self-center text-muted opacity-0 group-hover:opacity-100" />
            </a>
          </li>
        );
      })}
      {limit && sources.length > limit && <li className="text-xs text-muted">+{sources.length - limit} more</li>}
    </ul>
  );
}
