import { getHistory } from "@/lib/store";
import { HistoryTable } from "@/components/HistoryTable";

export const dynamic = "force-dynamic";

export default function HistoryPage() {
  const history = getHistory();
  const published = history.filter((h) => h.status === "published").length;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Content history</h1>
        <p className="mt-1 text-muted">
          Everything the editor has suggested, and what you published. This list is also what keeps tomorrow&apos;s picks from repeating today&apos;s.
          {history.length ? ` ${history.length} entries, ${published} published.` : ""}
        </p>
      </div>
      <HistoryTable entries={history} />
    </div>
  );
}
