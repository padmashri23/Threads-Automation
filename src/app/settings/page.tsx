import { getSettings } from "@/lib/store";
import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Your writing style</h1>
        <p className="mt-1 text-muted">How the editor writes for you. Applies to every generated post and every rewrite. Defaults: professional, conversational, technically informed, human, curious.</p>
      </div>
      <SettingsForm initial={getSettings()} />
    </div>
  );
}
