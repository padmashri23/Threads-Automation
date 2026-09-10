"use client";

import { useState } from "react";
import type { Story } from "@/lib/types";
import { ThreadsEditor } from "./ThreadsEditor";
import { VisualsPanel } from "./VisualsPanel";

export function StoryEditorSection({ story: initial }: { story: Story }) {
  const [story, setStory] = useState(initial);
  return (
    <>
      <section className="card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Threads post</h2>
        <div className="mt-2">
          <ThreadsEditor storyId={story.id} post={story.post} historyId={`h-${story.id}`} onChange={(post) => setStory((s) => ({ ...s, post }))} />
        </div>
      </section>
      <section className="card p-5">
        <VisualsPanel storyId={story.id} visuals={story.visuals} onChange={(visuals) => setStory((s) => ({ ...s, visuals }))} />
      </section>
    </>
  );
}
